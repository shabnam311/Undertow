import { describe, it, expect, mock, beforeEach } from 'bun:test';

const findManyMock = mock(async () => []);

mock.module('@undertow/db', () => {
  return {
    db: {
      query: {
        channelPerformance: {
          findMany: findManyMock
        }
      }
    },
    channelPerformance: {}
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
    expect(result.decision).toEqual({ channel: 'none', tier: 0 });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('routes voluntary_cancellation_signal to none tier 0 deterministically', async () => {
    const result = await decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'voluntary_cancellation_signal', confidence: 99 }
    });
    expect(result.decision).toEqual({ channel: 'none', tier: 0 });
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
});
