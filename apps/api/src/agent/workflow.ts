import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';

// Define the state shape
type AgentState = {
  event: any;
  diagnosis?: { rootCause: string; confidence: number };
  decision?: { channel: string; tier: number };
};

// 1. Detect Node (Deterministic)
const detectNode = (state: AgentState) => {
  // Logic to determine if case should be opened
  return { ...state };
};

// 2. Diagnose Node (LLM/Deterministic mix with Embeddings)
const diagnoseNode = async (state: AgentState) => {
  // Mock check for structured data first:
  if (state.event?.rawPayload?.error?.reason === 'insufficient_funds') {
    return {
      ...state,
      diagnosis: { rootCause: 'insufficient_funds', confidence: 100 }
    };
  }

  // 1. Generate local embedding (mocked for zero latency, real would use local ONNX model)
  const eventString = JSON.stringify(state.event);
  const arr = new Array(384).fill(0.01);
  let h = 0;
  for (let i = 0; i < eventString.length; i++) h = Math.imul(31, h) + eventString.charCodeAt(i) | 0;
  arr[Math.abs(h) % 384] = 0.99; // naive deterministic vector

  // 2. Retrieve few-shot examples via pgvector (cosine distance)
  const vectorStr = `[${arr.join(',')}]`;
  
  // Note: For a real setup, we would run `await db.execute(sql\`SELECT id, root_cause FROM cases ORDER BY embedding <=> ${vectorStr} LIMIT 3\`)`
  // But we'll omit raw SQL here to avoid syntax crashes if the extension isn't loaded yet.
  const fewShotContext = "Example 1: payment_failed -> insufficient_funds\nExample 2: checkout_abandoned -> checkout_friction";

  // 3. LLM fallback for ambiguous cases
  const llm = new ChatAnthropic({ 
    modelName: 'claude-haiku-4-5-20251001', 
    temperature: 0,
    maxTokens: 512
  });

  const diagnosisSchema = z.object({
    rootCause: z.enum([
      'insufficient_funds', 'issuer_risk_block', 'expired_or_invalid_instrument',
      'technical_gateway_failure', 'voluntary_cancellation_signal',
      'checkout_friction', 'buyer_side_approval_delay', 'disputed_or_service_issue',
      'undiagnosable'
    ]).describe('The primary reason for the revenue leakage event.'),
    confidence: z.number().min(0).max(100).describe('Confidence score of the diagnosis from 0 to 100.')
  });

  const structuredLlm = llm.withStructuredOutput(diagnosisSchema);

  const prompt = `
    You are a revenue recovery diagnosis agent. 
    Analyze the following payment or billing event and classify its root cause.
    
    Here are similar historical cases for context:
    ${fewShotContext}

    Event Data:
    ${JSON.stringify(state.event, null, 2)}
  `;

  try {
    const result = await structuredLlm.invoke(prompt);
    return {
      ...state,
      diagnosis: { rootCause: result.rootCause, confidence: result.confidence }
    };
  } catch (error) {
    return {
      ...state,
      diagnosis: { rootCause: 'undiagnosable', confidence: 0 }
    };
  }
};

import { db, channelPerformance } from '@undertow/db';
import { eq, and } from 'drizzle-orm';

function sampleGammaInteger(k: number): number {
  let u = 1.0;
  for (let i = 0; i < k; i++) {
    u *= Math.random();
  }
  return -Math.log(u);
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGammaInteger(alpha);
  const y = sampleGammaInteger(beta);
  return x / (x + y);
}

// 3. Decide Node (Policy Table replaced by Contextual Bandit)
export const decideNode = async (state: AgentState) => {
  const rootCause = state.diagnosis?.rootCause || 'undiagnosable';
  const merchantId = state.event?.merchantId || 'mock-merchant-id'; // Passed in event payload ideally

  // Hard stop cases
  if (rootCause === 'disputed_or_service_issue' || rootCause === 'voluntary_cancellation_signal') {
    return { ...state, decision: { channel: 'none', tier: 0 } };
  }

  // Fetch performance parameters for this context (Thompson Sampling)
  let performances = await db.query.channelPerformance.findMany({
    where: and(
      eq(channelPerformance.merchantId, merchantId),
      eq(channelPerformance.rootCause, rootCause)
    )
  });

  // Fallback to global defaults if no specific context exists
  if (performances.length === 0) {
    performances = await db.query.channelPerformance.findMany({
      where: eq(channelPerformance.rootCause, rootCause)
    });
  }

  // If still empty, seed default arms
  if (performances.length === 0) {
    performances = [
      { channel: 'email', tier: 1, alpha: 1, beta: 1 },
      { channel: 'sms', tier: 2, alpha: 1, beta: 1 },
      { channel: 'whatsapp', tier: 2, alpha: 1, beta: 1 },
      { channel: 'payment_link_retry', tier: 1, alpha: 1, beta: 1 }
    ] as any;
  }

  let bestChannel = 'email';
  let bestTier = 1;
  let maxSample = -1;

  for (const p of performances) {
    // Sample from the Beta distribution for this arm
    const sampledProb = sampleBeta(p.alpha, p.beta);
    if (sampledProb > maxSample) {
      maxSample = sampledProb;
      bestChannel = p.channel;
      bestTier = p.tier;
    }
  }

  return { ...state, decision: { channel: bestChannel, tier: bestTier } };
};

// Define the graph
export const workflow = new StateGraph<AgentState>({
  channels: {
    event: { value: (a, b) => b, default: () => null },
    diagnosis: { value: (a, b) => b },
    decision: { value: (a, b) => b },
  }
})
  .addNode('detect', detectNode)
  .addNode('diagnose', diagnoseNode)
  .addNode('decide', decideNode)
  .addEdge(START, 'detect')
  .addEdge('detect', 'diagnose')
  .addEdge('diagnose', 'decide')
  .addEdge('decide', END);

export const compiledWorkflow = workflow.compile();
