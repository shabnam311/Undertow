import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db, cases, riskEvents, customers, merchants, stopEvents, interventions, evaluationBatches, agentRuns } from '@undertow/db';
import { eq, desc } from 'drizzle-orm';
import { inngest } from './inngest/client';
import { signSessionToken } from './auth';
import { randomUUID } from 'crypto';


export type Context = {
  user: {
    id: string;
    role: 'owner' | 'analyst' | 'viewer';
    merchantId: string;
    email?: string;
    name?: string;
    merchantName?: string;
  } | null;
};

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error('Unauthorized');
  }
  return next({
    ctx: { user: ctx.user }
  });
});

export const requireAnalyst = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === 'viewer') {
    throw new Error('Forbidden: Requires analyst role');
  }
  return next();
});

// Helper to resolve merchantId gracefully
async function resolveMerchantId(userMerchantId?: string): Promise<string | null> {
  if (userMerchantId && userMerchantId !== 'no-merchant' && userMerchantId !== 'merchant-default') {
    return userMerchantId;
  }
  const firstMerchant = await db.query.merchants.findFirst();
  return firstMerchant ? firstMerchant.id : null;
}

export const appRouter = t.router({
  cases: t.router({
    kpis: protectedProcedure.query(async ({ ctx }) => {
      const activeMerchantId = await resolveMerchantId(ctx.user.merchantId);
      const allCases = await db.query.cases.findMany({
        where: activeMerchantId ? eq(cases.merchantId, activeMerchantId) : undefined,
        with: { interventions: true }
      });

      let recoveredAmount = 0;
      let atRiskAmount = 0;
      let openCasesCount = 0;
      let stoppedCount = 0;
      let totalCost = 0;

      for (const c of allCases) {
        if (c.status === 'recovered') {
          recoveredAmount += (c.amountRecoveredPaise || c.amountAtRiskPaise);
        } else if (c.status === 'stopped_unrecovered') {
          stoppedCount += 1;
        } else {
          atRiskAmount += c.amountAtRiskPaise;
          openCasesCount += 1;
        }

        for (const inv of c.interventions) {
          totalCost += (inv.costPaise || 0);
        }
      }

      const costPerRecoveredRupee = recoveredAmount > 0
        ? Number(((totalCost / 100) / (recoveredAmount / 100)).toFixed(4))
        : 0;

      // Find latest closed case for real empty-state and summary timestamps
      const latestClosed = await db.query.cases.findFirst({
        where: activeMerchantId ? eq(cases.merchantId, activeMerchantId) : undefined,
        orderBy: (cases, { desc }) => [desc(cases.closedAt)]
      });

      return {
        recoveredAmountPaise: recoveredAmount,
        atRiskAmountPaise: atRiskAmount,
        openCasesCount,
        stoppedCount,
        costPerRecoveredRupee,
        lastClosedAt: latestClosed?.closedAt || null,
        isShadowMode: process.env.ENABLE_SHADOW_MODE !== 'false',
      };
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const activeMerchantId = await resolveMerchantId(ctx.user.merchantId);
      const caseList = await db.query.cases.findMany({
        where: activeMerchantId ? eq(cases.merchantId, activeMerchantId) : undefined,
        with: {
          customer: true,
          riskEvent: true,
          interventions: true,
        },
        orderBy: (cases, { desc }) => [desc(cases.openedAt)],
        limit: 100,
      });

      return caseList.map(c => {
        const currentTier = c.interventions.reduce((max, inv) => Math.max(max, inv.tier), 0);
        return {
          id: c.id,
          status: c.status,
          rootCause: c.rootCause,
          amountAtRiskPaise: c.amountAtRiskPaise,
          customerName: c.customer?.displayName || 'Unknown',
          eventType: c.riskEvent?.eventType,
          openedAt: c.openedAt,
          currentTier,
          interventions: c.interventions,
        };
      });
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const caseRecord = await db.query.cases.findFirst({
          where: eq(cases.id, input.id),
          with: {
            customer: true,
            riskEvent: true,
            agentRuns: {
              orderBy: (runs, { desc }) => [desc(runs.createdAt)]
            },
            interventions: true,
            stopEvents: true,
          }
        });

        if (!caseRecord) {
          throw new Error('Case not found');
        }

        return {
          ...caseRecord,
          customerName: caseRecord.customer?.displayName || 'Unknown',
          eventType: caseRecord.riskEvent?.eventType,
        };
      }),

    approveNextTier: requireAnalyst

      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const caseRecord = await db.query.cases.findFirst({
          where: eq(cases.id, input.id),
          with: { interventions: { orderBy: (invs, { desc }) => [desc(invs.tier)], limit: 1 } }
        });
        
        if (!caseRecord || caseRecord.merchantId !== ctx.user.merchantId) {
          throw new Error('Case not found');
        }

        const latestInv = caseRecord.interventions[0];
        const newTier = (latestInv?.tier || 1) + 1;
        const channel = latestInv?.channel || 'email';

        // Fetch merchant escalation ceiling
        const merchantRecord = await db.query.merchants.findFirst({
          where: eq(merchants.id, ctx.user.merchantId)
        });
        const maxEscalation = merchantRecord?.escalationCeiling ?? 3;

        if (newTier > maxEscalation) {
          await db.update(cases)
            .set({ status: 'stopped_unrecovered', closeReason: 'max_escalation_reached' })
            .where(eq(cases.id, input.id));

          await db.insert(stopEvents).values({
            caseId: input.id,
            reasonCode: 'escalation_ceiling_reached',
            isSystemTriggered: false,
            merchantUserId: ctx.user.id !== 'user-1' ? ctx.user.id : undefined,
          });

          await inngest.send({
            name: 'case/closed',
            data: { caseId: input.id, status: 'stopped_unrecovered' }
          });

          return { success: false, reason: 'max_escalation_reached' };
        }

        // Escalate case status
        await db.update(cases)
          .set({ status: 'escalated' })
          .where(eq(cases.id, input.id));

        // Trigger real Inngest orchestration event
        await inngest.send({
          name: 'intervention/intended',
          data: {
            caseId: input.id,
            channel,
            tier: newTier,
          }
        });
        
        return { success: true };
      }),

    pauseCase: requireAnalyst
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const caseRecord = await db.query.cases.findFirst({
          where: eq(cases.id, input.id)
        });
        
        if (!caseRecord || caseRecord.merchantId !== ctx.user.merchantId) {
          throw new Error('Case not found');
        }

        await db.update(cases)
          .set({ status: 'stopped_manual' })
          .where(eq(cases.id, input.id));

        // Insert manual stopEvent
        await db.insert(stopEvents).values({
          caseId: input.id,
          reasonCode: 'manual_pause',
          isSystemTriggered: false,
          merchantUserId: ctx.user.id !== 'user-1' ? ctx.user.id : undefined, // record user if valid uuid
        });

        return { success: true };
      }),
  }),

  evaluation: t.router({
    getBatchResults: protectedProcedure.query(async ({ ctx }) => {
      const allCases = await db.query.cases.findMany({
        where: ctx.user.merchantId !== 'no-merchant' 
          ? eq(cases.merchantId, ctx.user.merchantId)
          : undefined,
        with: { stopEvents: true, interventions: true }
      });

      const totalCases = allCases.length || 1;
      let recovered = 0;
      let totalRecoveredPaise = 0;
      let totalAtRiskPaise = 0;
      let stopReasons: Record<string, number> = {};
      let totalCost = 0;

      for (const c of allCases) {
        totalAtRiskPaise += (c.amountAtRiskPaise || 0);
        if (c.status === 'recovered') {
          recovered++;
          totalRecoveredPaise += (c.amountRecoveredPaise || c.amountAtRiskPaise || 0);
        }
        if (c.stopEvents && Array.isArray(c.stopEvents)) {
          for (const se of c.stopEvents) {
            if (se.reasonCode) {
              stopReasons[se.reasonCode] = (stopReasons[se.reasonCode] || 0) + 1;
            }
          }
        }
        if (c.interventions && Array.isArray(c.interventions)) {
          for (const inv of c.interventions) {
            totalCost += (inv.costPaise || 0);
          }
        }
      }

      // Convert counts to percentages
      const stopReasonPercentages = Object.entries(stopReasons).map(([reason, count]) => ({
        reason,
        percentage: Math.round((count / totalCases) * 100)
      }));

      // Naive Baseline calculation
      const naiveBaselineRecoveryRate = 25; 
      const estimatedNaiveRecoveredPaise = totalAtRiskPaise * (naiveBaselineRecoveryRate / 100);
      const naiveBaselineTotalCostPaise = totalCases * 5; // 5 paise per email
      
      const naiveBaselineCostPerRupee = estimatedNaiveRecoveredPaise > 0 
        ? Number(((naiveBaselineTotalCostPaise / 100) / (estimatedNaiveRecoveredPaise / 100)).toFixed(4))
        : 0;
      
      const undertowCostPerRupee = totalRecoveredPaise > 0
        ? Number(((totalCost / 100) / (totalRecoveredPaise / 100)).toFixed(4))
        : 0;

      return {
        recoveryRate: Math.round((recovered / totalCases) * 100),
        stopReasons: stopReasonPercentages.sort((a, b) => b.percentage - a.percentage),
        totalCostPaise: totalCost,
        undertowCostPerRupee: isNaN(undertowCostPerRupee) ? 0 : undertowCostPerRupee,
        naiveBaselineRecoveryRate,
        naiveBaselineCostPerRupee: isNaN(naiveBaselineCostPerRupee) ? 0 : naiveBaselineCostPerRupee
      };
    })
  }),

  auth: t.router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return {
        user: ctx.user,
      };
    }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(100),
          password: z.string().min(1).max(128),
          role: z.enum(['owner', 'analyst', 'viewer']).optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Query merchant from DB
        const latestCase = await db.query.cases.findFirst({
          orderBy: (cases, { desc }) => [desc(cases.openedAt)]
        });
        let merchantId = latestCase?.merchantId;
        let merchantName = 'Meridian Textiles';
        
        if (merchantId) {
          const m = await db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) });
          if (m?.name) merchantName = m.name;
        } else {
          const merchantList = await db.select({ id: merchants.id, name: merchants.name }).from(merchants).limit(1);
          if (merchantList.length > 0) {
            merchantId = merchantList[0].id;
            merchantName = merchantList[0].name;
          }
        }

        const role = input.role || (input.email.includes('owner') ? 'owner' : input.email.includes('viewer') ? 'viewer' : 'analyst');
        const name = input.email.includes('shabnam') ? 'Shabnam' : 'Recovery Operator';
        
        // Construct structured session token and sign with HMAC-SHA256
        const tokenPayload = {
          id: 'user-' + input.email.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20),
          email: input.email.toLowerCase(),
          name,
          role,
          merchantId: merchantId || 'no-merchant',
          merchantName,
        };

        const token = signSessionToken(tokenPayload);

        return {
          token,
          user: tokenPayload,
        };
      }),

    signup: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(60),
          email: z.string().trim().email().max(100),
          password: z.string().min(6).max(128),
          role: z.enum(['owner', 'analyst', 'viewer']).default('owner'),
        })
      )
      .mutation(async ({ input }) => {
        const latestCase = await db.query.cases.findFirst({
          orderBy: (cases, { desc }) => [desc(cases.openedAt)]
        });
        let merchantId = latestCase?.merchantId;
        let merchantName = 'Meridian Textiles';
        
        if (merchantId) {
          const m = await db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) });
          if (m?.name) merchantName = m.name;
        } else {
          const merchantList = await db.select({ id: merchants.id, name: merchants.name }).from(merchants).limit(1);
          if (merchantList.length > 0) {
            merchantId = merchantList[0].id;
            merchantName = merchantList[0].name;
          }
        }

        const tokenPayload = {
          id: 'user-' + input.email.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15),
          email: input.email,
          name: input.name,
          role: input.role,
          merchantId: merchantId || 'no-merchant',
          merchantName,
        };

        const token = signSessionToken(tokenPayload);

        return {
          token,
          user: tokenPayload,
        };
      }),

    seedDemoData: publicProcedure
      .mutation(async () => {
        // Ensure merchant exists
        let merchantList = await db.select().from(merchants).limit(1);
        let merchantId: string;
        if (merchantList.length === 0) {
          const [m] = await db.insert(merchants).values({
            name: 'Meridian Textiles & Apparel',
            razorpayAccountId: 'acc_meridian_prod_99',
            spendCeilingPaise: 500000,
            escalationCeiling: 3,
          }).returning();
          merchantId = m.id;
        } else {
          merchantId = merchantList[0].id;
        }

        const [evalBatch] = await db.insert(evaluationBatches).values({
          merchantId,
          label: `Production Benchmark Batch ${Date.now()}`,
        }).returning();

        const CUSTOMERS = [
          'Kavya Menon', 'Whitefield Fabrics Ltd', 'Rohit Bhatia', 'Nimble Retail Co.',
          'Priya Suresh', 'Kestrel Apparel', 'Farhan Sheikh', 'Meera Iyer',
          'Alkem Traders', 'Devika Nair', 'Acme Lifestyle Corp', 'Startup Logistics Inc',
          'Aarav Sharma', 'Zenith Exports', 'Ananya Deshmukh', 'Indigo Mills'
        ];

        const ROOT_CAUSES = [
          'insufficient_funds',
          'issuer_risk_block',
          'technical_gateway_failure',
          'checkout_friction',
          'expired_or_invalid_instrument',
          'buyer_side_approval_delay',
          'disputed_or_service_issue',
          'voluntary_cancellation_signal',
          'undiagnosable'
        ];

        const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
        const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

        for (let i = 0; i < 60; i++) {
          const isB2B = i % 3 === 0;
          let eventType: string;
          let rootCause: string;
          let status: 'detected' | 'diagnosing' | 'intervention_sent' | 'escalated' | 'recovered' | 'stopped_unrecovered';

          if (i < 9) {
            rootCause = ROOT_CAUSES[i];
          } else {
            rootCause = sample(ROOT_CAUSES);
          }

          if (isB2B) {
            eventType = 'invoice_overdue';
          } else if (i % 4 === 1) {
            eventType = 'mandate_failed';
          } else if (i % 4 === 2) {
            eventType = 'checkout_abandoned';
          } else {
            eventType = 'payment_failed';
          }

          if (rootCause === 'disputed_or_service_issue' || rootCause === 'voluntary_cancellation_signal') {
            status = 'stopped_unrecovered';
          } else if (i % 2 === 0) {
            status = 'recovered';
          } else if (i % 5 === 1) {
            status = 'escalated';
          } else {
            status = 'intervention_sent';
          }

          const isLarge = Math.random() > 0.75;
          const amountPaise = isLarge ? rand(45000, 280000) * 100 : rand(850, 9500) * 100;
          const customerName = sample(CUSTOMERS);

          const [cust] = await db.insert(customers).values({
            merchantId,
            externalRef: `cust-ref-${randomUUID().slice(0, 8)}`,
            displayName: customerName,
            consentChannels: ['email', 'whatsapp', 'sms'],
            email: `${customerName.toLowerCase().replace(/[^a-z]/g, '')}@merchant-client.in`,
            phone: `+91 98${rand(10000000, 99999999)}`
          }).returning();

          const occurredDaysAgo = rand(1, 14);
          const occurredAt = new Date(Date.now() - occurredDaysAgo * 86400000);

          const [riskEvent] = await db.insert(riskEvents).values({
            merchantId,
            customerId: cust.id,
            source: 'razorpay_webhook',
            externalEventId: `evt_${randomUUID().slice(0, 12)}`,
            eventType,
            amountPaise,
            currency: 'INR',
            occurredAt,
            rawPayload: { seeded: true, source: 'production_demo' }
          }).returning();

          const [newCase] = await db.insert(cases).values({
            merchantId,
            customerId: cust.id,
            riskEventId: riskEvent.id,
            evaluationBatchId: evalBatch.id,
            amountAtRiskPaise: amountPaise,
            amountRecoveredPaise: status === 'recovered' ? amountPaise : 0,
            status,
            rootCause,
            rootCauseConfidence: rand(82, 98),
            openedAt: occurredAt,
            closedAt: (status === 'recovered' || status === 'stopped_unrecovered') ? new Date(occurredAt.getTime() + rand(2, 48) * 3600000) : null,
            closeReason: status === 'stopped_unrecovered' ? (rootCause === 'voluntary_cancellation_signal' ? 'voluntary_cancellation' : 'disputed') : (status === 'recovered' ? 'paid_via_recovery' : null)
          }).returning();

          // Add Agent Diagnosis Run
          await db.insert(agentRuns).values({
            caseId: newCase.id,
            nodeName: 'diagnose',
            reasoningSummary: `Groq LPU identified root cause: ${rootCause} with ${rand(84, 98)}% confidence based on bank failure taxonomy.`,
            inputSnapshot: { eventType, amountPaise },
            outputSnapshot: { rootCause },
            modelUsed: 'groq/llama-3.3-70b-versatile',
            latencyMs: rand(110, 190),
            tokenCostPaise: 1,
            createdAt: new Date(occurredAt.getTime() + 15000)
          });

          // Add Interventions
          if (status !== 'detected' && status !== 'diagnosing') {
            const tiers = status === 'escalated' ? 2 : 1;
            for (let t = 1; t <= tiers; t++) {
              await db.insert(interventions).values({
                caseId: newCase.id,
                channel: sample(['whatsapp', 'email', 'sms', 'payment_link_retry']),
                templateId: `tpl_recovery_tier_${t}`,
                templateVariables: { amount: `₹${(amountPaise / 100).toLocaleString('en-IN')}` },
                tier: t,
                status: 'sent',
                costPaise: t === 1 ? 5 : 25,
                sentAt: new Date(occurredAt.getTime() + t * 3600000)
              });
            }
          }

          // Add Stop Events
          if (status === 'stopped_unrecovered') {
            await db.insert(stopEvents).values({
              caseId: newCase.id,
              reasonCode: rootCause === 'voluntary_cancellation_signal' ? 'voluntary_cancellation' : 'disputed',
              isSystemTriggered: true,
              createdAt: new Date(occurredAt.getTime() + 7200000)
            });
          }
        }

        return { success: true, count: 60 };
      })
  })
});

export type AppRouter = typeof appRouter;

