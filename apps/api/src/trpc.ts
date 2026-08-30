import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { db, cases, riskEvents, customers } from '@undertow/db';
import { eq, desc } from 'drizzle-orm';

const t = initTRPC.create();

export const appRouter = t.router({
  cases: t.router({
    list: t.procedure.query(async () => {
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
        .orderBy(desc(cases.openedAt))
        .limit(100);

      return caseList;
    }),
    
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
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
          customerName: caseRecord.customer?.name || 'Unknown',
          eventType: caseRecord.riskEvent?.eventType,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
