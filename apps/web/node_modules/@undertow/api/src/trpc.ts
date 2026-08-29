import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok' };
  }),
});

export type AppRouter = typeof appRouter;
