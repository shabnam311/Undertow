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
});
