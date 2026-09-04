import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { razorpayWebhook } from './webhooks/razorpay';
import { serve } from 'inngest/hono';
import { inngest } from './inngest/client';
import { processRiskEvent, executeIntervention, evaluateEscalation, processCaseClosed } from './inngest/functions';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { db, merchants } from '@undertow/db';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Undertow API is running!');
});

app.get('/health', async (c) => {
  let dbStatus = 'connected';
  try {
    const m = await db.select({ id: merchants.id }).from(merchants).limit(1);
    if (m.length === 0) dbStatus = 'empty_merchants';
  } catch (err) {
    dbStatus = 'unreachable';
  }

  return c.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      groq_lpu: process.env.GROQ_API_KEY ? 'configured' : 'missing',
      anthropic_fallback: process.env.ANTHROPIC_API_KEY ? 'configured' : 'standby',
      inngest_orchestrator: process.env.INNGEST_EVENT_KEY ? 'active' : 'local_dev',
      razorpay_webhook_gate: process.env.RAZORPAY_WEBHOOK_SECRET ? 'active' : 'unconfigured',
    }
  });
});

// Attach tRPC with CORS and Context
app.use(
  '/trpc/*',
  cors(),
  trpcServer({
    router: appRouter,
    createContext: async (opts, c) => {
      // In @hono/trpc-server, opts.req is a standard Fetch Request (use .headers.get) or c is Hono Context
      const authHeader = (opts?.req?.headers?.get && opts.req.headers.get('Authorization')) || 
                         (c?.req?.header && c.req.header('Authorization')) || 
                         'Bearer demo-secret-key';
                         
      if (authHeader !== 'Bearer demo-secret-key') {
        return { user: null };
      }

      // Fetch the merchant that owns the latest seeded cases dynamically
      const latestCase = await db.query.cases.findFirst({
        orderBy: (cases, { desc }) => [desc(cases.openedAt)]
      });
      let merchantId = latestCase?.merchantId;
      
      if (!merchantId) {
        const merchantList = await db.select({ id: merchants.id }).from(merchants).limit(1);
        merchantId = merchantList.length > 0 ? merchantList[0].id : 'no-merchant';
      }

      return {
        user: {
          id: 'user-1',
          role: 'analyst' as const, // matching UI
          merchantId: merchantId || 'no-merchant',
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
    functions: [processRiskEvent, executeIntervention, evaluateEscalation, processCaseClosed],
  })
);

const port = Number(process.env.PORT) || 3001;

console.log(`Undertow API server starting on port ${port}...`);

export default {
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
