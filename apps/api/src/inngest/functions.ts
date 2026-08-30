import { inngest } from './client';
import { compiledWorkflow, decideNode } from '../agent/workflow';
import { db, agentRuns, interventions, cases, stopEvents } from '@undertow/db';
import { eq, sql } from 'drizzle-orm';

export const processRiskEvent = inngest.createFunction(
  { id: 'process-risk-event' },
  { event: 'case/detected' },
  async ({ event, step }) => {
    // 1. Detect node (deterministic rules)
    const detectionResult = await step.run('detect-risk', async () => {
      let score = 0;
      let shouldOpenCase = true;
      
      const eventType = event.data.eventType;
      const amount = event.data.amountPaise;

      // Rule 1: High value cases get higher score
      if (amount > 500000) score += 40;
      else if (amount > 50000) score += 20;

      // Rule 2: Event type risks
      if (eventType === 'mandate_failed') score += 30;
      if (eventType === 'checkout_abandoned') score += 10;
      if (eventType === 'invoice_overdue') score += 50;

      // Threshold
      if (score < 20) {
        shouldOpenCase = false;
      }

      return { score, shouldOpenCase };
    });

    if (!detectionResult.shouldOpenCase) {
      return { status: 'ignored' };
    }

    // 2. Diagnose node (LLM call via LangGraph)
    const diagnosis = await step.run('diagnose-root-cause', async () => {
      const state = await compiledWorkflow.invoke({ event: event.data });
      
      // Audit trail
      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'diagnose',
        reasoningSummary: `LLM identified root cause: ${state.diagnosis?.rootCause} with ${state.diagnosis?.confidence}% confidence`,
        inputSnapshot: { event: event.data },
        outputSnapshot: { diagnosis: state.diagnosis }
      });

      return { rootCause: state.diagnosis?.rootCause, confidence: state.diagnosis?.confidence };
    });

    // 3. Decide node (policy table)
    const decision = await step.run('decide-intervention', async () => {
      // Use exported decideNode rather than invoking the whole compiled workflow again
      const state = { event: event.data, diagnosis };
      const nextState = decideNode(state);
      const finalDecision = nextState.decision || { channel: 'email', tier: 1 };
      
      // Audit trail
      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'decide',
        reasoningSummary: `Policy mapped ${diagnosis.rootCause} to channel: ${finalDecision.channel} at tier ${finalDecision.tier}`,
        inputSnapshot: { diagnosis },
        outputSnapshot: { decision: finalDecision }
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
      const { caseId, channel, tier } = event.data;

      // Ensure we don't spam if channel is none
      if (channel === 'none') return;

      // Basic consent / opt-out check would go here

      // Spend ceiling check
      const costMap: Record<string, number> = {
        'email': 5,
        'whatsapp': 25,
        'payment_link_retry': 10
      };
      const costPaise = costMap[channel] || 0;

      // Real provider call (mocked for demo)
      // await sendResendEmail(...)
      
      // Write intervention to DB
      await db.insert(interventions).values({
        caseId,
        channel,
        tier,
        status: 'sent',
        costPaise,
        messageId: `mock-msg-${Date.now()}`
      });

      // Update case status
      await db.update(cases)
        .set({ status: 'intervention_sent' })
        .where(eq(cases.id, caseId));
    });
  }
);

export const evaluateEscalation = inngest.createFunction(
  { id: 'evaluate-escalation' },
  { cron: '0 * * * *' }, // Run every hour
  async ({ step }) => {
    await step.run('check-open-cases', async () => {
      // Find cases that have been stuck in 'intervention_sent' for too long
      const stuckCases = await db.query.cases.findMany({
        where: eq(cases.status, 'intervention_sent'),
        with: { interventions: { orderBy: (invs, { desc }) => [desc(invs.createdAt)], limit: 1 } }
      });

      for (const caseRecord of stuckCases) {
        const latestIntervention = caseRecord.interventions[0];
        if (!latestIntervention) continue;

        // If older than 24 hours
        const ageHours = (Date.now() - latestIntervention.createdAt.getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 24) {
          // Escalate tier
          const newTier = (latestIntervention.tier || 1) + 1;
          if (newTier > 3) {
            // Stop condition
            await db.update(cases)
              .set({ status: 'stopped_unrecovered', closeReason: 'max_escalation_reached' })
              .where(eq(cases.id, caseRecord.id));
              
            await db.insert(stopEvents).values({
              caseId: caseRecord.id,
              reasonCode: 'escalation_ceiling_reached',
              isSystemTriggered: true,
            });
          } else {
            // Escalate
            await db.update(cases)
              .set({ status: 'escalated' })
              .where(eq(cases.id, caseRecord.id));
            
            // Queue next intervention
            await inngest.send({
              name: 'intervention/intended',
              data: {
                caseId: caseRecord.id,
                channel: 'whatsapp', // Escalate to higher touch channel
                tier: newTier
              }
            });
          }
        }
      }
    });
  }
);
