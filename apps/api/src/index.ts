import { Hono } from 'hono';
import { razorpayWebhook } from './webhooks/razorpay';
import { serve } from 'inngest/hono';
import { inngest } from './inngest/client';
import { processRiskEvent, executeIntervention, evaluateEscalation } from './inngest/functions';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Undertow API is running!');
});

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
