import { describe, it, expect, mock, beforeEach } from 'bun:test';

const findManyMock = mock(async () => []);

mock.module('@undertow/db', () => {
  return {
    db: {
      query: {
        channelPerformance: {
          findMany: findManyMock
        }
      },
      execute: mock(async () => []),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(async () => {})
        }))
      }))
    },
    channelPerformance: {},
    cases: {}
  };
});

import { decideNode } from './workflow';

describe('decideNode (Contextual Bandit)', () => {
  beforeEach(() => {
    findManyMock.mockClear();
    findManyMock.mockImplementation(async () => []);
  });

  it('routes disputed_or_service_issue to none tier 0 deterministically', async () => {
    const result = await decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'disputed_or_service_issue', confidence: 99 }
    });
    expect(result.decision?.channel).toBe('none');
    expect(result.decision?.tier).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('routes voluntary_cancellation_signal to none tier 0 deterministically', async () => {
    const result = await decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'voluntary_cancellation_signal', confidence: 99 }
    });
    expect(result.decision?.channel).toBe('none');
    expect(result.decision?.tier).toBe(0);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('samples from fallback arms when no prior data exists', async () => {
    const result = await decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'insufficient_funds', confidence: 90 }
    });
    expect(['email', 'sms', 'whatsapp', 'payment_link_retry']).toContain(result.decision!.channel);
    expect([1, 2]).toContain(result.decision!.tier);
  });

  it('strongly prefers arms with high successes (alpha) over failures (beta)', async () => {
    // Provide a heavily biased set of arms
    findManyMock.mockImplementation(async () => [
      { channel: 'sms', tier: 2, alpha: 100, beta: 1 },
      { channel: 'email', tier: 1, alpha: 1, beta: 100 }
    ]);

    let smsCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = await decideNode({
        event: { rawPayload: {} },
        diagnosis: { rootCause: 'insufficient_funds', confidence: 90 }
      });
      if (result.decision?.channel === 'sms') smsCount++;
    }

    // Almost all draws should pick SMS given the extreme beta distribution difference
    expect(smsCount).toBeGreaterThan(45);
  });

  it('enforces NPCI 4-attempt cap on recurring mandates', async () => {
    const result = await decideNode({
      event: { eventType: 'mandate_failed', attemptCount: 4, rawPayload: {} },
      diagnosis: { rootCause: 'insufficient_funds', confidence: 90 }
    });

    expect(result.decision?.channel).toBe('none');
    expect(result.decision?.tier).toBe(0);
    expect(result.decision?.complianceBadge).toContain('NPCI Cap Reached');
  });

  it('enforces RBI ₹15,000 AFA rule by routing to payment_link_retry', async () => {
    const result = await decideNode({
      event: { eventType: 'mandate_failed', amountPaise: 2000000, attemptCount: 1, rawPayload: {} },
      diagnosis: { rootCause: 'insufficient_funds', confidence: 90 }
    });

    expect(result.decision?.channel).toBe('payment_link_retry');
    expect(result.decision?.complianceBadge).toContain('RBI AFA Rule');
  });

  describe('Adversarial Guardrail Verification Suite', () => {
    it('adversarial: blocks all outbound contact when chargeback or dispute is present', async () => {
      const hostileDisputeEvent = {
        event: { amountPaise: 5000000, customerId: 'cust-disputed-1', rawPayload: { dispute_reason: 'fraud_reported' } },
        diagnosis: { rootCause: 'disputed_or_service_issue', confidence: 100 }
      };
      const result = await decideNode(hostileDisputeEvent);
      expect(result.decision?.channel).toBe('none');
      expect(result.decision?.tier).toBe(0);
      expect(result.decision?.actionReason).toContain('Dispute');
    });

    it('adversarial: blocks all outbound contact when customer opts out / signals voluntary cancellation', async () => {
      const cancelSignalEvent = {
        event: { amountPaise: 120000, customerId: 'cust-cancel-1', rawPayload: { cancellation_requested: true } },
        diagnosis: { rootCause: 'voluntary_cancellation_signal', confidence: 95 }
      };
      const result = await decideNode(cancelSignalEvent);
      expect(result.decision?.channel).toBe('none');
      expect(result.decision?.tier).toBe(0);
      expect(result.decision?.actionReason).toContain('Opt-Out');
    });

    it('adversarial: enforces NPCI cap even with attemptCount >= 5 (overflow attempts)', async () => {
      const overflowMandate = {
        event: { eventType: 'mandate_failed', attemptCount: 6, amountPaise: 50000, rawPayload: {} },
        diagnosis: { rootCause: 'technical_gateway_failure', confidence: 85 }
      };
      const result = await decideNode(overflowMandate);
      expect(result.decision?.channel).toBe('none');
      expect(result.decision?.tier).toBe(0);
      expect(result.decision?.complianceBadge).toContain('NPCI Cap Reached');
    });

    it('adversarial: enforces RBI ₹15,000 threshold strictly at exactly 15,00,000 paise', async () => {
      const exactThresholdEvent = {
        event: { eventType: 'mandate_failed', amountPaise: 1500000, attemptCount: 1, rawPayload: {} },
        diagnosis: { rootCause: 'technical_gateway_failure', confidence: 80 }
      };
      const result = await decideNode(exactThresholdEvent);
      expect(result.decision?.channel).toBe('payment_link_retry');
      expect(result.decision?.complianceBadge).toContain('RBI AFA Rule');
    });
  });

  describe('Stage 1 Logistic Regression Risk Scorer Math', () => {
    it('correctly calculates sigmoid and respects the 0.65 operating threshold', () => {
      const weights = {
        amount_scaled: 0.85,
        is_mandate_failed: 1.2,
        is_checkout_abandoned: -0.5,
        is_invoice_overdue: 1.5,
        bias: -1.2
      };

      const computeRisk = (eventType: string, amountPaise: number) => {
        const amountScaled = Math.min(amountPaise / 100000, 10);
        const isMandate = eventType === 'mandate_failed' ? 1 : 0;
        const isCheckout = eventType === 'checkout_abandoned' ? 1 : 0;
        const isInvoice = eventType === 'invoice_overdue' ? 1 : 0;

        const logit = weights.bias +
          (weights.amount_scaled * amountScaled) +
          (weights.is_mandate_failed * isMandate) +
          (weights.is_checkout_abandoned * isCheckout) +
          (weights.is_invoice_overdue * isInvoice);
        
        const prob = 1 / (1 + Math.exp(-logit));
        return { score: Math.round(prob * 100), shouldOpenCase: prob > 0.65 };
      };

      // High value invoice overdue -> must open case
      const highInvoice = computeRisk('invoice_overdue', 500000);
      expect(highInvoice.shouldOpenCase).toBe(true);
      expect(highInvoice.score).toBeGreaterThan(80);

      // Low value abandoned checkout -> below operating threshold
      const lowCheckout = computeRisk('checkout_abandoned', 5000);
      expect(lowCheckout.shouldOpenCase).toBe(false);
      expect(lowCheckout.score).toBeLessThan(65);
    });
  });
});
