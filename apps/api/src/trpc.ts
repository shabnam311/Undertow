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
    list: protectedProcedure.query(async ({ ctx }) => {
      const caseList = await db
        .select({
          id: cases.id,
          status: cases.status,
          rootCause: cases.rootCause,
          amountAtRiskPaise: cases.amountAtRiskPaise,
          customerName: customers.name,
          eventType: riskEvents.eventType,
          openedAt: cases.openedAt,
        })
        .from(cases)
        .leftJoin(customers, eq(cases.customerId, customers.id))
        .leftJoin(riskEvents, eq(cases.riskEventId, riskEvents.id))
        .where(eq(cases.merchantId, ctx.user.merchantId))
        .orderBy(desc(cases.openedAt))
        .limit(100);

      return caseList;
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
