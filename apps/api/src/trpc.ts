import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db, cases, riskEvents, customers, merchants, stopEvents } from '@undertow/db';
import { eq, desc } from 'drizzle-orm';
import { inngest } from './inngest/client';

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

export const appRouter = t.router({
  cases: t.router({
    kpis: protectedProcedure.query(async ({ ctx }) => {
      const allCases = await db.query.cases.findMany({
        where: eq(cases.merchantId, ctx.user.merchantId),
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
        where: eq(cases.merchantId, ctx.user.merchantId),
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
      // Get cases with interventions to compute current tier
      const caseList = await db.query.cases.findMany({
        where: eq(cases.merchantId, ctx.user.merchantId),
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

        if (!caseRecord || caseRecord.merchantId !== ctx.user.merchantId) {
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
          email: z.string().email(),
          password: z.string().min(1),
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
        
        // Construct structured session token
        const tokenPayload = {
          userId: 'user-' + input.email.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15),
          email: input.email,
          name,
          role,
          merchantId: merchantId || 'no-merchant',
          merchantName,
        };

        const token = 'demo_' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

        return {
          token,
          user: tokenPayload,
        };
      }),

    signup: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(6),
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
          userId: 'user-' + input.email.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15),
          email: input.email,
          name: input.name,
          role: input.role,
          merchantId: merchantId || 'no-merchant',
          merchantName,
        };

        const token = 'demo_' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

        return {
          token,
          user: tokenPayload,
        };
      })
  })
});

export type AppRouter = typeof appRouter;
