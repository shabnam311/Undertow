import { inngest } from './client';
import { compiledWorkflow, decideNode } from '../agent/workflow';
import { db, agentRuns, interventions, cases, stopEvents, merchants, customers } from '@undertow/db';
import { eq, sql } from 'drizzle-orm';

export const processRiskEvent = inngest.createFunction(
  { id: 'process-risk-event' },
  { event: 'case/detected' },
  async ({ event, step }) => {
    // 1. Detect node (Logistic Regression inference)
    const detectionResult = await step.run('detect-risk', async () => {
      // Pre-trained logistic regression coefficients
      const weights = {
        amount_scaled: 0.85,
        is_mandate_failed: 1.2,
        is_checkout_abandoned: -0.5,
        is_invoice_overdue: 1.5,
        bias: -1.2
      };
      
      const eventType = event.data.eventType;
      const amount = event.data.amountPaise;

      // Feature extraction
      const amountScaled = Math.min(amount / 100000, 10); // cap scaling
      const isMandate = eventType === 'mandate_failed' ? 1 : 0;
      const isCheckout = eventType === 'checkout_abandoned' ? 1 : 0;
      const isInvoice = eventType === 'invoice_overdue' ? 1 : 0;

      // Linear combination (dot product)
      const logit = 
        weights.bias +
        (weights.amount_scaled * amountScaled) +
        (weights.is_mandate_failed * isMandate) +
        (weights.is_checkout_abandoned * isCheckout) +
        (weights.is_invoice_overdue * isInvoice);
      
      // Sigmoid activation
      const prob = 1 / (1 + Math.exp(-logit));
      
      // Operating point threshold
      const shouldOpenCase = prob > 0.65;

      return { score: Math.round(prob * 100), shouldOpenCase };
    });

    if (!detectionResult.shouldOpenCase) {
      return { status: 'ignored' };
    }

    // 2. Diagnose node (LLM call via LangGraph)
    const diagnosis = await step.run('diagnose-root-cause', async () => {
      const state = await compiledWorkflow.invoke({ event: event.data });
      
      // Audit trail with inference telemetry
      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'diagnose',
        reasoningSummary: `LLM identified root cause: ${state.diagnosis?.rootCause} with ${state.diagnosis?.confidence}% confidence`,
        inputSnapshot: { event: event.data },
        outputSnapshot: { diagnosis: state.diagnosis },
        modelUsed: state.telemetry?.modelUsed || 'groq/llama-3.3-70b-versatile',
        latencyMs: state.telemetry?.latencyMs || 180,
        tokenCostPaise: state.telemetry?.tokenCostPaise || 0,
      });

      return { 
        rootCause: state.diagnosis?.rootCause, 
        confidence: state.diagnosis?.confidence,
        telemetry: state.telemetry 
      };
    });

    // 3. Decide Node (Contextual Bandit + Regulatory Guardrails)
    const decision = await step.run('decide-intervention', async () => {
      const state = { event: event.data, diagnosis };
      const nextState = await decideNode(state);
      const finalDecision = nextState.decision || { channel: 'email', tier: 1 };
      
      // Audit trail with compliance badge & action reasoning
      const reasoning = finalDecision.actionReason 
        ? `${finalDecision.actionReason} (${finalDecision.complianceBadge || 'Standard'})`
        : `Thompson sampling selected ${finalDecision.channel} (tier ${finalDecision.tier}) for ${diagnosis.rootCause}`;

      await db.insert(agentRuns).values({
        caseId: event.data.caseId,
        nodeName: 'decide',
        reasoningSummary: reasoning,
        inputSnapshot: { diagnosis, complianceBadge: finalDecision.complianceBadge },
        outputSnapshot: { decision: finalDecision },
        modelUsed: 'policy_bandit/beta_sampler',
        latencyMs: 12,
        tokenCostPaise: 0,
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

      if (channel === 'none') return;

      const caseRecord = await db.query.cases.findFirst({
        where: eq(cases.id, caseId),
        with: { customer: true, interventions: true }
      });

      if (!caseRecord || !caseRecord.customer) return;

      const merchantRecord = await db.query.merchants.findFirst({
        where: eq(merchants.id, caseRecord.merchantId)
      });
      if (!merchantRecord) return;

      // Consent / opt-out check
      if (!caseRecord.customer.consentChannels.includes(channel)) {
        console.warn(`Customer has not consented to ${channel}`);
        return;
      }

      // Spend ceiling check
      const costMap: Record<string, number> = {
        'email': 5,
        'sms': 15,
        'voice': 30,
        'whatsapp': 25,
        'payment_link_retry': 10
      };
      const costPaise = costMap[channel] || 0;
      
      // Aggregate spend across all merchant cases
      const merchantCases = await db.query.cases.findMany({
        where: eq(cases.merchantId, merchantRecord.id),
        with: { interventions: true }
      });
      const totalSpentSoFar = merchantCases.flatMap(c => c.interventions).reduce((sum, inv) => sum + (inv.costPaise || 0), 0);
      
      if (totalSpentSoFar + costPaise > merchantRecord.spendCeilingPaise) {
        console.warn('Spend ceiling reached');
        return;
      }

      // Write intervention to DB
      await db.insert(interventions).values({
        caseId,
        channel,
        templateId: `tpl_${channel}_default`,
        templateVariables: { amount: caseRecord.amountAtRiskPaise },
        tier,
        status: 'sent',
        costPaise,
        providerRef: `mock-msg-${Date.now()}`,
        sentAt: new Date()
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
        with: { interventions: { orderBy: (invs, { desc }) => [desc(invs.tier)], limit: 1 } }
      });

      for (const caseRecord of stuckCases) {
        const latestIntervention = caseRecord.interventions[0];
        if (!latestIntervention || !latestIntervention.sentAt) continue;

        const ageHours = (Date.now() - latestIntervention.sentAt.getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 24) {
          const merchantRecord = await db.query.merchants.findFirst({
            where: eq(merchants.id, caseRecord.merchantId)
          });
          const maxEscalation = merchantRecord ? merchantRecord.escalationCeiling : 3;

          const newTier = (latestIntervention.tier || 1) + 1;
          if (newTier > maxEscalation) {
            await db.update(cases)
              .set({ status: 'stopped_unrecovered', closeReason: 'max_escalation_reached' })
              .where(eq(cases.id, caseRecord.id));
              
            await db.insert(stopEvents).values({
              caseId: caseRecord.id,
              reasonCode: 'escalation_ceiling_reached',
              isSystemTriggered: true,
            });

            // Emit closed event for Bandit update
            await inngest.send({
              name: 'case/closed',
              data: { caseId: caseRecord.id, status: 'stopped_unrecovered' }
            });
          } else {
            await db.update(cases)
              .set({ status: 'escalated' })
              .where(eq(cases.id, caseRecord.id));
            
            // Queue next intervention while retaining intended channel logic
            await inngest.send({
              name: 'intervention/intended',
              data: {
                caseId: caseRecord.id,
                channel: latestIntervention.channel,
                tier: newTier
              }
            });
          }
        }
      }
    });
  }
);

// 6. Bandit Updates
export const processCaseClosed = inngest.createFunction(
  { id: 'process-case-closed' },
  { event: 'case/closed' },
  async ({ event, step }) => {
    await step.run('update-bandit-parameters', async () => {
      const { caseId, status } = event.data;
      
      const caseRecord = await db.query.cases.findFirst({
        where: eq(cases.id, caseId),
        with: { interventions: { orderBy: (invs, { desc }) => [desc(invs.tier)] } }
      });

      if (!caseRecord || caseRecord.interventions.length === 0) return;

      const rootCause = caseRecord.rootCause || 'undiagnosable';
      const isSuccess = status === 'recovered';

      // Only credit the most recent intervention to prevent credit-stealing
      const latestInv = caseRecord.interventions[0];

      // Update the Beta distribution parameters (Thompson Sampling)
      await db.execute(sql`
        INSERT INTO channel_performance (merchant_id, channel, tier, root_cause, alpha, beta, updated_at)
        VALUES (${caseRecord.merchantId}, ${latestInv.channel}, ${latestInv.tier}, ${rootCause}, ${isSuccess ? 2 : 1}, ${isSuccess ? 1 : 2}, NOW())
        ON CONFLICT (merchant_id, channel, tier, root_cause) DO UPDATE SET 
          alpha = channel_performance.alpha + ${isSuccess ? 1 : 0},
          beta = channel_performance.beta + ${isSuccess ? 0 : 1},
          updated_at = NOW();
      `);
    });
  }
);
