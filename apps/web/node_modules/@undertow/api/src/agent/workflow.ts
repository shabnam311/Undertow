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

// 2. Diagnose Node (LLM/Deterministic mix)
const diagnoseNode = async (state: AgentState) => {
  // In a real app, we check Razorpay reason codes first here.
  // If unstructured (e.g. email reply), fallback to LLM.
  
  // Mock check for structured data first:
  if (state.event?.rawPayload?.error?.reason === 'insufficient_funds') {
    return {
      ...state,
      diagnosis: { rootCause: 'insufficient_funds', confidence: 100 }
    };
  }

  // LLM fallback for ambiguous cases
  const llm = new ChatAnthropic({ 
    modelName: 'claude-3-haiku-20240307', 
    temperature: 0 
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

// 3. Decide Node (Policy Table)
const decideNode = (state: AgentState) => {
  // Map diagnosis to intervention
  let channel = 'email';
  let tier = 1;

  if (state.diagnosis?.rootCause === 'insufficient_funds') {
    channel = 'payment_link_retry';
    tier = 1;
  }

  return {
    ...state,
    decision: { channel, tier }
  };
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
