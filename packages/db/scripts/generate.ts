import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { db, riskEvents, cases } from '../client'; // Now we actually seed the DB!

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Generate a right-skewed amount
const generateAmount = () => {
  const isLarge = Math.random() > 0.8;
  if (isLarge) return rand(50000, 500000) * 100;
  return rand(500, 5000) * 100;
};

const CUSTOMERS = [
  'Kavya Menon', 'Whitefield Fabrics', 'Rohit Bhatia', 'Nimble Retail Co.',
  'Priya Suresh', 'Kestrel Apparel', 'Farhan Sheikh', 'Meera Iyer',
  'Alkem Traders', 'Devika Nair', 'Acme Corp', 'Startup Inc'
];

export async function runSeed() {
  console.log("Generating and seeding synthetic batch...");
  
  const casesData = [];
  
  for (let i = 0; i < 60; i++) {
    const isB2B = Math.random() > 0.7; // Right skew: more D2C than B2B
    let eventType, rootCause, status;

    if (isB2B) {
      eventType = 'invoice_overdue';
      rootCause = sample(['buyer_side_approval_delay', 'disputed_or_service_issue', 'undiagnosable']);
    } else {
      eventType = sample(['payment_failed', 'checkout_abandoned', 'mandate_failed']);
      if (eventType === 'checkout_abandoned') {
        rootCause = 'checkout_friction';
      } else if (eventType === 'mandate_failed') {
        rootCause = sample(['insufficient_funds', 'issuer_risk_block', 'expired_or_invalid_instrument']);
      } else {
        rootCause = sample(['insufficient_funds', 'issuer_risk_block', 'technical_gateway_failure', 'voluntary_cancellation_signal']);
      }
    }

    const tier = rand(1, 4);

    // Guardrail: Disputed cannot be recovered or escalated
    if (rootCause === 'disputed_or_service_issue') {
      status = 'stopped_unrecovered'; 
    } else {
      status = sample(['detected', 'diagnosing', 'intervention_sent', 'escalated', 'recovered']);
    }

    const amountPaise = generateAmount();
    const customerId = randomUUID();
    const customerName = sample(CUSTOMERS);
    const merchantId = 'merchant-test-1';

    // 1. Insert Risk Event
    const [riskEvent] = await db.insert(riskEvents).values({
      merchantId,
      customerId,
      source: 'synthetic_seed',
      eventType,
      amountPaise,
      currency: 'INR',
      occurredAt: new Date(Date.now() - rand(1, 45) * 86400000),
      rawPayload: { generated: true }
    }).returning();

    // 2. Insert Case
    const [newCase] = await db.insert(cases).values({
      merchantId,
      customerId,
      riskEventId: riskEvent.id,
      amountAtRiskPaise: amountPaise,
      status: status as any,
      tier,
    }).returning();

    casesData.push({
      ...newCase,
      customerName,
      rootCause,
      eventType
    });
  }

  const outputPath = path.join(__dirname, 'synthetic_batch.json');
  fs.writeFileSync(outputPath, JSON.stringify(casesData, null, 2));
  console.log(`Successfully generated and seeded 60 cases. Log written to ${outputPath}`);
}

runSeed().catch(console.error);
