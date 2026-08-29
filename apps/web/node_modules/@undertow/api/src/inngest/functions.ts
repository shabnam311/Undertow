import { inngest } from './client';
import { compiledWorkflow } from '../agent/workflow';

export const processRiskEvent = inngest.createFunction(
  { id: 'process-risk-event' },
  { event: 'case/detected' },
  async ({ event, step }) => {
    // 1. Detect node (deterministic)
    const detectionResult = await step.run('detect-risk', async () => {
      // Implement detection logic
      return { score: 85, shouldOpenCase: true };
    });

    if (!detectionResult.shouldOpenCase) {
      return { status: 'ignored' };
    }

    // 2. Diagnose node (LLM call via LangGraph)
    const diagnosis = await step.run('diagnose-root-cause', async () => {
      // Call LangGraph workflow here
      const state = await compiledWorkflow.invoke({ event: event.data });
      return { rootCause: state.diagnosis?.rootCause, confidence: state.diagnosis?.confidence };
    });

    // 3. Decide node (policy table)
    const decision = await step.run('decide-intervention', async () => {
      // Table lookup
      return { channel: 'email', tier: 1 };
    });

    // 4. Act node (emit intent)
    await step.sendEvent('emit-intervention-intent', {
      name: 'intervention/intended',
      data: {
        caseId: event.data.caseId,
        channel: decision.channel,
        tier: decision.tier,
      },
    });

    return { status: 'intervention_pending' };
  }
);

export const executeIntervention = inngest.createFunction(
  { id: 'execute-intervention' },
  { event: 'intervention/intended' },
  async ({ event, step }) => {
    await step.run('execute-channel', async () => {
      // Final hard spend ceiling and consent check before execution
      // Send to Resend, MSG91, etc.
    });
  }
);

export const evaluateEscalation = inngest.createFunction(
  { id: 'evaluate-escalation' },
  { cron: '0 * * * *' }, // Run every hour
  async ({ step }) => {
    await step.run('check-open-cases', async () => {
      // Scan cases, evaluate escalation ladder, or stop
    });
  }
);
