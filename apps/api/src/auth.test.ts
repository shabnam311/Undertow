import { describe, it, expect } from 'bun:test';
import { signSessionToken, verifySessionToken, type SessionUser } from './auth';

describe('Cryptographic Authentication (auth.ts)', () => {
  const sampleUser: Omit<SessionUser, 'exp'> = {
    id: 'user-analyst-1',
    role: 'analyst',
    merchantId: 'merchant-test-123',
    email: 'analyst@undertow.demo',
    name: 'Shabnam',
    merchantName: 'Meridian Textiles',
  };

  it('signs and verifies a valid session token successfully', () => {
    const token = signSessionToken(sampleUser, 'test_secret_1234567890');
    expect(token.startsWith('ut_')).toBe(true);

    const verified = verifySessionToken(token, 'test_secret_1234567890');
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe('user-analyst-1');
    expect(verified?.role).toBe('analyst');
    expect(verified?.email).toBe('analyst@undertow.demo');
    expect(verified?.merchantName).toBe('Meridian Textiles');
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered tokens where signature does not match payload', () => {
    const token = signSessionToken(sampleUser, 'test_secret_1234567890');
    // Tamper with the base64 payload
    const parts = token.slice(3).split('.');
    const tamperedPayload = parts[0].slice(0, -4) + 'AAAA';
    const tamperedToken = `ut_${tamperedPayload}.${parts[1]}`;

    const verified = verifySessionToken(tamperedToken, 'test_secret_1234567890');
    expect(verified).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signSessionToken(sampleUser, 'correct_secret_key_1');
    const verified = verifySessionToken(token, 'attacker_secret_key_2');
    expect(verified).toBeNull();
  });

  it('rejects malformed tokens without ut_ prefix or improper format', () => {
    expect(verifySessionToken('random_string')).toBeNull();
    expect(verifySessionToken('ut_invalid')).toBeNull();
    expect(verifySessionToken('')).toBeNull();
  });

  it('rejects expired tokens', () => {
    // Construct expired token payload manually
    const expiredPayload = {
      ...sampleUser,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
    };
    const bodyBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const { createHmac } = require('crypto');
    const signature = createHmac('sha256', 'test_secret').update(bodyBase64).digest('base64url');
    const expiredToken = `ut_${bodyBase64}.${signature}`;

    const verified = verifySessionToken(expiredToken, 'test_secret');
    expect(verified).toBeNull();
  });

  it('correctly models RBAC permissions across owner, analyst, and viewer', () => {
    const ownerToken = signSessionToken({ ...sampleUser, role: 'owner' }, 'secret');
    const analystToken = signSessionToken({ ...sampleUser, role: 'analyst' }, 'secret');
    const viewerToken = signSessionToken({ ...sampleUser, role: 'viewer' }, 'secret');

    const owner = verifySessionToken(ownerToken, 'secret');
    const analyst = verifySessionToken(analystToken, 'secret');
    const viewer = verifySessionToken(viewerToken, 'secret');

    expect(owner?.role).toBe('owner');
    expect(analyst?.role).toBe('analyst');
    expect(viewer?.role).toBe('viewer');

    // Role check logic matching requireAnalyst middleware in trpc.ts
    const canMutate = (role?: string) => role === 'owner' || role === 'analyst';
    expect(canMutate(owner?.role)).toBe(true);
    expect(canMutate(analyst?.role)).toBe(true);
    expect(canMutate(viewer?.role)).toBe(false);
  });

  describe('Razorpay Webhook Cryptographic HMAC Ingestion', () => {
    const { createHmac, timingSafeEqual } = require('crypto');
    const webhookSecret = 'rzp_test_webhook_secret_9988';
    const samplePayload = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            amount: 50000,
            currency: 'INR',
            error_code: 'BAD_REQUEST_ERROR'
          }
        }
      }
    });

    const verifyWebhookSignature = (body: string, sig: string, secret: string) => {
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      if (expected.length !== sig.length) return false;
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    };

    it('accepts valid Razorpay HMAC-SHA256 signature', () => {
      const validSig = createHmac('sha256', webhookSecret).update(samplePayload).digest('hex');
      expect(verifyWebhookSignature(samplePayload, validSig, webhookSecret)).toBe(true);
    });

    it('rejects tampered webhook payload body', () => {
      const validSig = createHmac('sha256', webhookSecret).update(samplePayload).digest('hex');
      const tamperedPayload = samplePayload.replace('50000', '99999');
      expect(verifyWebhookSignature(tamperedPayload, validSig, webhookSecret)).toBe(false);
    });

    it('rejects webhook with incorrect secret key', () => {
      const forgedSig = createHmac('sha256', 'attacker_secret_key').update(samplePayload).digest('hex');
      expect(verifyWebhookSignature(samplePayload, forgedSig, webhookSecret)).toBe(false);
    });

    it('rejects malformed or empty signature', () => {
      expect(verifyWebhookSignature(samplePayload, '', webhookSecret)).toBe(false);
      expect(verifyWebhookSignature(samplePayload, 'short_sig', webhookSecret)).toBe(false);
    });
  });
});
