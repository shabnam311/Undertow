import { Hono } from 'hono';
import { inngest } from '../inngest/client';

export const razorpayWebhook = new Hono();

import { db, riskEvents, cases } from '@undertow/db';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';

razorpayWebhook.post('/', async (c) => {
  const bodyText = await c.req.text();
  const signature = c.req.header('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(bodyText)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  if (
    expectedSignature.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  ) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  const body = JSON.parse(bodyText);
  
  // Idempotency check against event ID
  const eventName = body.event;
  const eventId = body.id || (body.payload?.payment?.entity?.id); // Razorpay webhooks have 'id' at root or entity
  
  const existingEvent = await db.query.riskEvents.findFirst({
    where: eq(riskEvents.source, `razorpay_${eventId}`)
  });

  if (existingEvent) {
    return c.json({ status: 'already_processed' });
  }

  const payload = body.payload;

  if (eventName === 'payment.failed') {
    const payment = payload.payment.entity;
    const customerId = payment.customer_id || 'synthetic-customer-1';
    const amountPaise = payment.amount;

    // Insert risk_event
    const [riskEvent] = await db.insert(riskEvents).values({
      merchantId: 'merchant-test-1', // Mock merchant for now
      customerId: customerId,
      source: `razorpay_${eventId}`,
      eventType: 'payment_failed',
      amountPaise,
      currency: payment.currency,
      rawPayload: body,
      occurredAt: new Date(),
    }).returning();

    // Open a case (mock logic for "should open case")
    const [newCase] = await db.insert(cases).values({
      merchantId: 'merchant-test-1',
      customerId: customerId,
      riskEventId: riskEvent.id,
      amountAtRiskPaise: amountPaise,
      status: 'detected',
      tier: 0,
    }).returning();
    
    // Emit the intent to our durable orchestration
    await inngest.send({
      name: 'case/detected',
      data: {
        caseId: newCase.id,
        source: 'razorpay_webhook',
        eventType: 'payment_failed',
        amountPaise,
        currency: payment.currency,
        customerId,
        rawPayload: body,
      }
    });
  }

  return c.json({ status: 'ok' });
});
