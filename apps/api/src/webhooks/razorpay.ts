import { Hono } from 'hono';
import { inngest } from '../inngest/client';
import { db, riskEvents, cases, customers, merchants } from '@undertow/db';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';

export const razorpayWebhook = new Hono();

const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

razorpayWebhook.use('/', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxHits = 100;
  
  let record = rateLimitMap.get(ip);
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + windowMs };
  }
  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > maxHits) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});

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
  
  // Fetch a valid merchant instead of hardcoding
  const merchantList = await db.select({ id: merchants.id }).from(merchants).limit(1);
  if (merchantList.length === 0) {
    throw new Error('No merchants found in database');
  }
  const merchantId = merchantList[0].id;

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
        merchantId: merchantId,
        externalRef: externalCustomerId,
        displayName: 'Guest Customer',
        consentChannels: ['email'],
        email: payment.email || null,
        phone: payment.contact || null
      }).returning();
      customerId = newCustomer.id;
    }

    // Insert risk_event with idempotency
    const riskEventInsert = await db.insert(riskEvents).values({
      merchantId: merchantId,
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
      merchantId: merchantId,
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
        merchantId: merchantId,
        source: 'razorpay_webhook',
        eventType: 'payment_failed',
        amountPaise,
        currency: payment.currency,
        customerId,
        rawPayload: body,
      }
    });
  } else if (eventName === 'subscription.halted' || eventName === 'subscription.charged') {
    const subscription = payload.subscription?.entity || payload.payment?.entity;
    const amountPaise = subscription?.amount || 0;
    const externalCustomerId = subscription?.customer_id || 'mandate-cust-' + randomUUID();
    const isFailure = eventName === 'subscription.halted';

    if (isFailure) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.externalRef, externalCustomerId)
      });
      let customerId = existingCustomer?.id;
      if (!customerId) {
        const [newCust] = await db.insert(customers).values({
          merchantId,
          externalRef: externalCustomerId,
          displayName: 'Recurring Mandate User',
          consentChannels: ['whatsapp', 'sms', 'email'],
          email: subscription?.email || null,
          phone: subscription?.contact || null
        }).returning();
        customerId = newCust.id;
      }

      const riskEventInsert = await db.insert(riskEvents).values({
        merchantId,
        customerId,
        source: 'razorpay_webhook',
        externalEventId: eventId,
        eventType: 'mandate_failed',
        amountPaise,
        currency: subscription?.currency || 'INR',
        rawPayload: body,
        occurredAt: new Date(),
      }).onConflictDoNothing({ target: riskEvents.externalEventId }).returning();

      if (riskEventInsert.length > 0) {
        const [newCase] = await db.insert(cases).values({
          merchantId,
          customerId,
          riskEventId: riskEventInsert[0].id,
          amountAtRiskPaise: amountPaise,
          status: 'detected',
        }).returning();

        await inngest.send({
          name: 'case/detected',
          data: {
            caseId: newCase.id,
            merchantId,
            source: 'razorpay_webhook',
            eventType: 'mandate_failed',
            amountPaise,
            currency: subscription?.currency || 'INR',
            customerId,
            attemptCount: subscription?.auth_attempts || 1,
            rawPayload: body,
          }
        });
      }
    }
  } else if (eventName === 'invoice.expired' || eventName === 'invoice.paid') {
    const invoice = payload.invoice?.entity;
    const amountPaise = invoice?.amount || 0;
    const externalCustomerId = invoice?.customer_id || 'inv-cust-' + randomUUID();
    const isOverdue = eventName === 'invoice.expired';

    if (isOverdue) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.externalRef, externalCustomerId)
      });
      let customerId = existingCustomer?.id;
      if (!customerId) {
        const [newCust] = await db.insert(customers).values({
          merchantId,
          externalRef: externalCustomerId,
          displayName: invoice?.customer_name || 'B2B Enterprise Client',
          consentChannels: ['email', 'whatsapp'],
          email: invoice?.customer_email || null,
          phone: invoice?.customer_contact || null
        }).returning();
        customerId = newCust.id;
      }

      const riskEventInsert = await db.insert(riskEvents).values({
        merchantId,
        customerId,
        source: 'razorpay_webhook',
        externalEventId: eventId,
        eventType: 'invoice_overdue',
        amountPaise,
        currency: invoice?.currency || 'INR',
        rawPayload: body,
        occurredAt: new Date(),
      }).onConflictDoNothing({ target: riskEvents.externalEventId }).returning();

      if (riskEventInsert.length > 0) {
        const [newCase] = await db.insert(cases).values({
          merchantId,
          customerId,
          riskEventId: riskEventInsert[0].id,
          amountAtRiskPaise: amountPaise,
          status: 'detected',
        }).returning();

        await inngest.send({
          name: 'case/detected',
          data: {
            caseId: newCase.id,
            merchantId,
            source: 'razorpay_webhook',
            eventType: 'invoice_overdue',
            amountPaise,
            currency: invoice?.currency || 'INR',
            customerId,
            rawPayload: body,
          }
        });
      }
    }
  } else if (eventName === 'payment.captured' || eventName === 'payment.authorized' || eventName === 'invoice.paid' || eventName === 'subscription.charged') {
    const payment = payload.payment?.entity || payload.invoice?.entity || payload.subscription?.entity;
    const externalCustomerId = payment?.customer_id;
    const amountPaise = payment?.amount || 0;
    
    // Idempotency check using externalEventId
    if (eventId) {
      const existingEvent = await db.query.riskEvents.findFirst({
        where: eq(riskEvents.externalEventId, eventId)
      });
      if (existingEvent) {
        return c.json({ status: 'already_processed' });
      }
    }

    // Attempt to match by customer
    if (externalCustomerId) {
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.externalRef, externalCustomerId)
      });
      
      if (existingCustomer) {
        // Record risk event for audit / idempotency
        await db.insert(riskEvents).values({
          merchantId: merchantId,
          customerId: existingCustomer.id,
          source: 'razorpay_webhook',
          externalEventId: eventId,
          eventType: 'payment_captured',
          amountPaise,
          currency: payment?.currency || 'INR',
          rawPayload: body,
          occurredAt: new Date(),
        }).onConflictDoNothing({ target: riskEvents.externalEventId });

        // Find most recent open case for this customer
        const openCase = await db.query.cases.findFirst({
          where: eq(cases.customerId, existingCustomer.id),
          orderBy: (cases, { desc }) => [desc(cases.openedAt)]
        });
        
        if (openCase && openCase.status !== 'recovered' && !openCase.status.startsWith('stopped')) {
          // Update DB
          await db.update(cases)
            .set({ status: 'recovered', amountRecoveredPaise: amountPaise, closedAt: new Date() })
            .where(eq(cases.id, openCase.id));

          // Emit recovery for Bandit updates
          await inngest.send({
            name: 'case/closed',
            data: { caseId: openCase.id, status: 'recovered' }
          });
        }
      }
    }
  }

  return c.json({ status: 'ok' });
});
