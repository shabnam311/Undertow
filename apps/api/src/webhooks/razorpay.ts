import { Hono } from 'hono';
import { inngest } from '../inngest/client';

export const razorpayWebhook = new Hono();

import { db, riskEvents, cases, customers } from '@undertow/db';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';

razorpayWebhook.post('/', async (c) => {
  const bodyText = await c.req.text();
  const signature = c.req.header('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }

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
  // According to Razorpay docs, webhook payloads contain account_id and events have 'x-razorpay-event-id' header
  // Usually body.id is the event ID for webhooks. Or x-razorpay-event-id header. Let's use header or body.id.
  const eventId = c.req.header('x-razorpay-event-id') || body.id;
  
  const payload = body.payload;

  if (eventName === 'payment.failed') {
    const payment = payload.payment.entity;
    const externalCustomerId = payment.customer_id || 'guest-' + randomUUID();
    const amountPaise = payment.amount;

    // Find or create customer
    const existingCustomer = await db.query.customers.findFirst({
      where: eq(customers.externalRef, externalCustomerId)
    });

    let customerId;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const [newCustomer] = await db.insert(customers).values({
        merchantId: 'merchant-test-1',
        externalRef: externalCustomerId,
        name: 'Guest Customer',
        email: payment.email || null,
        phone: payment.contact || null
      }).returning();
      customerId = newCustomer.id;
    }

    // Insert risk_event with idempotency
    const riskEventInsert = await db.insert(riskEvents).values({
      merchantId: 'merchant-test-1', // Mock merchant for now
      customerId: customerId,
      source: 'razorpay_webhook',
      externalEventId: eventId,
      eventType: 'payment_failed',
      amountPaise,
      currency: payment.currency,
      rawPayload: body,
      occurredAt: new Date(),
    }).onConflictDoNothing({ target: riskEvents.externalEventId }).returning();

    if (riskEventInsert.length === 0) {
      return c.json({ status: 'already_processed' });
    }
    
    const riskEvent = riskEventInsert[0];

    // Open a case
    const [newCase] = await db.insert(cases).values({
      merchantId: 'merchant-test-1',
      customerId: customerId,
      riskEventId: riskEvent.id,
      amountAtRiskPaise: amountPaise,
      status: 'detected',
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
