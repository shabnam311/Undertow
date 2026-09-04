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
                         
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null };
      }

      const token = authHeader.replace('Bearer ', '').trim();

      // Fetch the merchant that owns the latest seeded cases dynamically
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

      if (token.startsWith('demo_')) {
        try {
          const decoded = JSON.parse(Buffer.from(token.replace('demo_', ''), 'base64').toString('utf8'));
          return {
            user: {
              id: decoded.userId || 'user-1',
              role: decoded.role || 'analyst',
              merchantId: merchantId || decoded.merchantId || 'no-merchant',
              email: decoded.email || 'analyst@undertow.demo',
              name: decoded.name || 'Shabnam',
              merchantName: merchantName || decoded.merchantName || 'Meridian Textiles',
            }
          };
        } catch (e) {
          // fallback to standard demo session
        }
      }

      return {
        user: {
          id: 'user-1',
          role: 'analyst' as const,
          merchantId: merchantId || 'no-merchant',
          email: 'analyst@undertow.demo',
          name: 'Shabnam',
          merchantName: merchantName || 'Meridian Textiles',
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

console.log(`Undertow API server listening on 0.0.0.0:${port}`);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

export default {
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
