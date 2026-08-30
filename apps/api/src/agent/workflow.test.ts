import { describe, it, expect } from 'bun:test';
import { decideNode } from './workflow';

describe('decideNode', () => {
  it('routes insufficient_funds to payment_link_retry', () => {
    const result = decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'insufficient_funds', confidence: 90 }
    });
    expect(result.decision).toEqual({ channel: 'payment_link_retry', tier: 1 });
  });

  it('routes checkout_friction to whatsapp tier 2', () => {
    const result = decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'checkout_friction', confidence: 95 }
    });
    expect(result.decision).toEqual({ channel: 'whatsapp', tier: 2 });
  });

  it('routes disputed_or_service_issue to none tier 0', () => {
    const result = decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'disputed_or_service_issue', confidence: 99 }
    });
    expect(result.decision).toEqual({ channel: 'none', tier: 0 });
  });

  it('routes unknown root causes to email tier 1 by default', () => {
    const result = decideNode({
      event: { rawPayload: {} },
      diagnosis: { rootCause: 'some_unknown_issue' as any, confidence: 50 }
    });
    expect(result.decision).toEqual({ channel: 'email', tier: 1 });
  });
});
