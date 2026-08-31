import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { razorpayWebhook } from './webhooks/razorpay';
import { serve } from 'inngest/hono';
import { inngest } from './inngest/client';
import { processRiskEvent, executeIntervention, evaluateEscalation } from './inngest/functions';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { db, merchants } from '@undertow/db';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Undertow API is running!');
});

// Attach tRPC with CORS and Context
app.use(
  '/trpc/*',
  cors(),
  trpcServer({
    router: appRouter,
    createContext: async (opts) => {
      // Stubbed authentication - fetch the seeded merchant dynamically
      const merchantList = await db.select({ id: merchants.id }).from(merchants).limit(1);
      const merchantId = merchantList.length > 0 ? merchantList[0].id : 'no-merchant';

      return {
        user: {
          id: 'user-1',
          role: 'analyst' as const, // matching UI
          merchantId,
        },
      };
    },
  })
);

// Attach Webhooks
app.route('/webhooks/razorpay', razorpayWebhook);

// Attach Inngest
app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [processRiskEvent, executeIntervention, evaluateEscalation],
  })
);

export default {
  port: 3001,
  fetch: app.fetch,
};
