import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Helper to generate a random number within a range
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to pick a random item from an array
const sample = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const CUSTOMERS = [
  'Kavya Menon', 'Whitefield Fabrics', 'Rohit Bhatia', 'Nimble Retail Co.',
  'Priya Suresh', 'Kestrel Apparel', 'Farhan Sheikh', 'Meera Iyer',
  'Alkem Traders', 'Devika Nair', 'Acme Corp', 'Startup Inc'
];

const ROOT_CAUSES = [
  'insufficient_funds', 'issuer_risk_block', 'expired_or_invalid_instrument',
  'technical_gateway_failure', 'voluntary_cancellation_signal',
  'checkout_friction', 'buyer_side_approval_delay', 'disputed_or_service_issue',
  'undiagnosable'
];

const generateCase = () => {
  const isB2B = Math.random() > 0.5;
  const rootCause = sample(ROOT_CAUSES);
  const amountPaise = rand(1000, 500000) * 100; // amounts in paise
  const tier = rand(1, 4);

  return {
    id: randomUUID(),
    merchantId: 'merchant-test-1',
    customerId: randomUUID(),
    customerName: sample(CUSTOMERS),
    riskEvent: {
      source: 'synthetic_seed',
      eventType: isB2B ? 'invoice_overdue' : sample(['payment_failed', 'checkout_abandoned', 'mandate_failed']),
      amountPaise,
      currency: 'INR',
      occurredAt: new Date(Date.now() - rand(1, 45) * 86400000).toISOString(),
    },
    rootCause,
    amountAtRiskPaise: amountPaise,
    status: sample(['detected', 'diagnosing', 'intervention_sent', 'escalated', 'recovered', 'stopped_unrecovered']),
    tier,
  };
};

// Generate exactly 60 synthetic cases to meet the Buildathon Track 3 requirement
const cases = Array.from({ length: 60 }, generateCase);

const outputPath = path.join(__dirname, 'synthetic_batch.json');
fs.writeFileSync(outputPath, JSON.stringify(cases, null, 2));

console.log(`Generated 60 synthetic cases and wrote to ${outputPath}`);
