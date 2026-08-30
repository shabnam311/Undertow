import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db, cases, riskEvents, customers } from '@undertow/db';
import { eq, desc } from 'drizzle-orm';

export type Context = {
  user: {
    id: string;
    role: 'owner' | 'analyst' | 'viewer';
    merchantId: string;
  } | null;
};

const t = initTRPC.context<Context>().create();

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
        ? (totalCost / 100) / (recoveredAmount / 100) 
        : 0;

      return {
        recoveredAmountPaise: recoveredAmount,
        atRiskAmountPaise: atRiskAmount,
        openCasesCount,
        stoppedCount,
        costPerRecoveredRupee,
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
          customerName: c.customer?.name || 'Unknown',
          eventType: c.riskEvent?.eventType,
          openedAt: c.openedAt,
          currentTier,
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
          customerName: caseRecord.customer?.name || 'Unknown',
          eventType: caseRecord.riskEvent?.eventType,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
