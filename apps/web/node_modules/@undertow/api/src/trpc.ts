import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok' };
  }),
  cases: router({
    list: publicProcedure.query(() => {
      // Mock data until DB is connected
      return [
        { id: 1, name: "Kavya Menon", sub: "UPI · repeat customer", cause: "Issuer risk block", tier: 2, amt: "₹18,400", status: "escalated", trend: [3,4,3,5,6,5,7] },
        { id: 2, name: "Whitefield Fabrics", sub: "Invoice INV-2291 · 12d overdue", cause: "Buyer approval delay", tier: 1, amt: "₹2,84,000", status: "sent", trend: [2,2,3,3,4,4,4] }
      ];
    }),
    get: publicProcedure.input(z.string()).query(({ input }) => {
      return { id: input, name: 'Kavya Menon' };
    }),
  }),
});

export type AppRouter = typeof appRouter;
