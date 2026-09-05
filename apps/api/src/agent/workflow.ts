import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { evaluateGuardrails } from './guardrails';

// Define the state shape
type AgentState = {
  event: any;
  diagnosis?: { rootCause: string; confidence: number };
  decision?: { 
    channel: string; 
    tier: number; 
    complianceBadge?: string; 
    scheduledFor?: string;
    actionReason?: string;
  };
  telemetry?: {
    modelUsed: string;
    latencyMs: number;
    tokenCostPaise: number;
  };
};

// 1. Detect Node (Deterministic)
const detectNode = (state: AgentState) => {
  // Logic to determine if case should be opened
  return { ...state };
};

// 2. Diagnose Node (LLM/Deterministic mix with pgvector Embeddings)
const diagnoseNode = async (state: AgentState) => {
  // Mock check for structured data first:
  if (state.event?.rawPayload?.error?.reason === 'insufficient_funds') {
    return {
      ...state,
      diagnosis: { rootCause: 'insufficient_funds', confidence: 100 }
    };
  }

  // 1. Generate local dense feature representation (384-dim normalized vector)
  const eventString = `${state.event?.eventType || ''} ${state.event?.amountPaise || ''} ${JSON.stringify(state.event?.rawPayload || {})}`;
  const arr = new Array(384).fill(0.001);
  for (let i = 0; i < eventString.length; i++) {
    const idx = (eventString.charCodeAt(i) * 31 + i) % 384;
    arr[Math.abs(idx)] += 0.05;
  }
  // Normalize vector
  const norm = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0)) || 1;
  const normalizedVector = arr.map(v => Number((v / norm).toFixed(6)));
  const vectorStr = `[${normalizedVector.join(',')}]`;

  // 2. Retrieve dynamic few-shot examples via pgvector cosine distance if DB available
  let fewShotContext = "Example 1: payment_failed -> insufficient_funds\nExample 2: checkout_abandoned -> checkout_friction";
  try {
    const similarCases = await db.execute<{ id: string; root_cause: string; event_type: string }>(
      sql`SELECT c.id, c.root_cause, re.event_type 
          FROM cases c 
          JOIN risk_events re ON re.id = c.risk_event_id 
          WHERE c.embedding IS NOT NULL AND c.root_cause IS NOT NULL 
          ORDER BY c.embedding <=> ${vectorStr}::vector 
          LIMIT 3`
    );
    if (similarCases && (similarCases as any).length > 0) {
      fewShotContext = (similarCases as any)
        .map((sc: any, idx: number) => `Historical Case ${idx + 1}: ${sc.event_type} diagnosed as "${sc.root_cause}"`)
        .join('\n');
    }
  } catch (err) {
    // Graceful fallback to default examples if vector extension not yet migrated or empty
  }

  // 3. Persist embedding on the case record if caseId is known
  if (state.event?.caseId) {
    try {
      await db.update(cases)
        .set({ embedding: normalizedVector })
        .where(eq(cases.id, state.event.caseId));
    } catch (e) {
      // Ignore in mocked test environments
    }
  }

  // 4. LLM execution with automatic fallback (Groq LPU -> Claude Haiku -> Undiagnosable)
  const diagnosisSchema = z.object({
    rootCause: z.enum([
      'insufficient_funds', 'issuer_risk_block', 'expired_or_invalid_instrument',
      'technical_gateway_failure', 'voluntary_cancellation_signal',
      'checkout_friction', 'buyer_side_approval_delay', 'disputed_or_service_issue',
      'undiagnosable'
    ]).describe('The primary reason for the revenue leakage event.'),
    confidence: z.number().min(0).max(100).describe('Confidence score of the diagnosis from 0 to 100.')
  });

  const prompt = `
    You are a revenue recovery diagnosis agent. 
    Analyze the following payment or billing event and classify its root cause.
    
    Here are similar historical cases for context:
    ${fewShotContext}

    Event Data:
    ${JSON.stringify(state.event, null, 2)}
  `;

  const startTime = Date.now();
  let modelUsed = 'none';
  let tokenCostPaise = 0;

  // Primary: Groq (Ultra-low latency LPU)
  if (process.env.GROQ_API_KEY) {
    try {
      const groqLlm = new ChatGroq({
        model: 'llama-3.3-70b-versatile',
        apiKey: process.env.GROQ_API_KEY,
        temperature: 0,
      });
      const structuredGroq = groqLlm.withStructuredOutput(diagnosisSchema);
      const result = await structuredGroq.invoke(prompt);
      const latencyMs = Date.now() - startTime;
      return {
        ...state,
        diagnosis: { rootCause: result.rootCause, confidence: result.confidence },
        telemetry: { modelUsed: 'groq/llama-3.3-70b-versatile', latencyMs, tokenCostPaise: 0 }
      };
    } catch (groqErr) {
      console.warn('Groq LPU diagnosis failed or rate-limited. Falling back to heuristic/secondary handler...', groqErr);
    }
  }

  // Secondary Fallback: Anthropic Claude Haiku
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropicLlm = new ChatAnthropic({
        modelName: 'claude-haiku-4-5-20251001',
        apiKey: process.env.ANTHROPIC_API_KEY,
        temperature: 0,
        maxTokens: 512
      });
      const structuredClaude = anthropicLlm.withStructuredOutput(diagnosisSchema);
      const result = await structuredClaude.invoke(prompt);
      const latencyMs = Date.now() - startTime;
      return {
        ...state,
        diagnosis: { rootCause: result.rootCause, confidence: result.confidence },
        telemetry: { modelUsed: 'anthropic/claude-haiku-4-5', latencyMs, tokenCostPaise: 1 }
      };
    } catch (claudeErr) {
      console.error('Claude diagnosis fallback failed:', claudeErr);
    }
  }

  // Final graceful fallback if no LLM responded
  return {
    ...state,
    diagnosis: { rootCause: 'undiagnosable', confidence: 0 },
    telemetry: { modelUsed: 'heuristic/fallback', latencyMs: Date.now() - startTime, tokenCostPaise: 0 }
  };
};

import { db, channelPerformance, cases } from '@undertow/db';
import { eq, and, sql } from 'drizzle-orm';

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

// 3. Decide Node (Policy Table + Regulatory Guardrails + Contextual Bandit + Payday Heuristic)
export const decideNode = async (state: AgentState) => {
  const rootCause = state.diagnosis?.rootCause || 'undiagnosable';
  const merchantId = state.event?.merchantId || 'mock-merchant-id';
  const eventType = state.event?.eventType || '';
  const amountPaise = state.event?.amountPaise || 0;
  const currentAttempts = state.event?.attemptCount || 1;

  // Evaluate declarative regulatory & ethical guardrails
  const guardrailEvaluation = evaluateGuardrails({
    rootCause,
    eventType,
    amountPaise,
    attemptCount: currentAttempts
  });

  if (guardrailEvaluation.blocked && guardrailEvaluation.decision) {
    return {
      ...state,
      decision: guardrailEvaluation.decision
    };
  }

  // SMART HEURISTIC: Payday / Salary-Cycle Scheduling
  // If rootCause is insufficient_funds and today is between the 22nd and 30th of the month,
  // schedule recovery for the 1st of next month when salary credit occurs.
  let scheduledFor: string | undefined = undefined;
  const today = new Date();
  const dayOfMonth = today.getDate();
  if (rootCause === 'insufficient_funds' && dayOfMonth >= 22 && dayOfMonth <= 30) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1, 9, 0, 0);
    scheduledFor = nextMonth.toISOString();
  }

  // If forced by regulatory rule (e.g. RBI AFA for ₹15k+), return immediately with compliant channel
  if (guardrailEvaluation.forcedChannel) {
    return {
      ...state,
      decision: {
        channel: guardrailEvaluation.forcedChannel,
        tier: 1,
        complianceBadge: guardrailEvaluation.complianceBadge,
        scheduledFor,
        actionReason: guardrailEvaluation.actionReason
      }
    };
  }

  const complianceBadge = guardrailEvaluation.complianceBadge;

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

  return {
    ...state,
    decision: {
      channel: bestChannel,
      tier: bestTier,
      complianceBadge: complianceBadge || (eventType === 'mandate_failed' ? `NPCI Compliant · ${currentAttempts}/4` : undefined),
      scheduledFor,
      actionReason: scheduledFor ? `Salary-cycle scheduled for 1st of month` : undefined
    }
  };
};

// Define the graph
export const workflow = new StateGraph<AgentState>({
  channels: {
    event: { value: (a, b) => b, default: () => null },
    diagnosis: { value: (a, b) => b },
    decision: { value: (a, b) => b },
    telemetry: { value: (a, b) => b },
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
