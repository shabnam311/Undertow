import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { razorpayWebhook } from './webhooks/razorpay';
import { serve } from 'inngest/hono';
import { inngest } from './inngest/client';
import { processRiskEvent, executeIntervention, evaluateEscalation } from './inngest/functions';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/', (c) => {
  return c.text('Undertow API is running!');
});

// Attach tRPC
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
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
