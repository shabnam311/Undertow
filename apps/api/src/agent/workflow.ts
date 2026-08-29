import { StateGraph, START, END } from '@langchain/langgraph';

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
  // In a real app, we'd check Razorpay reason codes first, 
  // then fallback to an LLM if unstructured (e.g. email reply)
  
  return {
    ...state,
    diagnosis: {
      rootCause: 'insufficient_funds',
      confidence: 90,
    }
  };
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
