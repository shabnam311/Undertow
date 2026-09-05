import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { razorpayWebhook } from './webhooks/razorpay';
import { serve } from 'inngest/hono';
import { inngest } from './inngest/client';
import { processRiskEvent, executeIntervention, evaluateEscalation, processCaseClosed } from './inngest/functions';
import { appRouter } from './trpc';
import { cors } from 'hono/cors';
import { db, merchants } from '@undertow/db';
import { verifySessionToken } from './auth';

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

app.get('/seed', async (c) => {
  try {
    const caller = appRouter.createCaller({ user: null });
    const res = await caller.auth.seedDemoData();
    return c.json({ success: true, message: 'Seeded 60 benchmark recovery cases', data: res });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// Attach tRPC with CORS and Context
app.use(
  '/trpc/*',
  cors(),
  trpcServer({
    router: appRouter,
    createContext: async (opts, c) => {
      const authHeader = (opts?.req?.headers?.get && opts.req.headers.get('Authorization')) || 
                         (c?.req?.header && c.req.header('Authorization'));
                         
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null };
      }

      const token = authHeader.replace('Bearer ', '').trim();

      // 1. Verify cryptographic HMAC-SHA256 session token
      const verifiedSession = verifySessionToken(token);
      if (verifiedSession) {
        return {
          user: {
            id: verifiedSession.id,
            role: verifiedSession.role,
            merchantId: verifiedSession.merchantId,
            email: verifiedSession.email,
            name: verifiedSession.name,
            merchantName: verifiedSession.merchantName,
          }
        };
      }

      // 2. Reject all unsigned, invalid, or tampered tokens
      return { user: null };
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

const port = parseInt(process.env.PORT || '3001', 10);

console.log(`Undertow API server ready on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

