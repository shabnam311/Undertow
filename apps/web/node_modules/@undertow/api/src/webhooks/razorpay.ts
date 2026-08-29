import { Hono } from 'hono';
import { inngest } from '../inngest/client';

export const razorpayWebhook = new Hono();

razorpayWebhook.post('/', async (c) => {
  // In production, we'd verify the Razorpay signature here using crypto
  // const signature = c.req.header('x-razorpay-signature');
  
  const body = await c.req.json();
  
  // Normalize the event
  const event = body.event;
  const payload = body.payload;

  if (event === 'payment.failed') {
    const payment = payload.payment.entity;
    
    // In a real flow, we'd insert the risk_event into the DB first
    // For now, emit the intent to our durable orchestration
    
    await inngest.send({
      name: 'case/detected',
      data: {
        source: 'razorpay_webhook',
        eventType: 'payment_failed',
        amountPaise: payment.amount,
        currency: payment.currency,
        customerId: payment.customer_id || 'synthetic-customer-1',
        rawPayload: body,
      }
    });
  }

  return c.json({ status: 'ok' });
});
