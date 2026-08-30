import { inngest } from './client';
import { compiledWorkflow } from '../agent/workflow';
import { db, agentRuns } from '@undertow/db';

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
      
      // Audit trail
      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'diagnose',
        reasoningSummary: `LLM identified root cause: ${state.diagnosis?.rootCause} with ${state.diagnosis?.confidence}% confidence`,
        metadata: { diagnosis: state.diagnosis }
      });

      return { rootCause: state.diagnosis?.rootCause, confidence: state.diagnosis?.confidence };
    });

    // 3. Decide node (policy table)
    const decision = await step.run('decide-intervention', async () => {
      // In a real app, this queries the DB for the active policy mapping
      const state = await compiledWorkflow.invoke({ event: event.data, diagnosis });
      const finalDecision = state.decision || { channel: 'email', tier: 1 };
      
      // Audit trail
      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'decide',
        reasoningSummary: `Policy mapped ${diagnosis.rootCause} to channel: ${finalDecision.channel} at tier ${finalDecision.tier}`,
        metadata: { decision: finalDecision }
      });

      return finalDecision;
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
