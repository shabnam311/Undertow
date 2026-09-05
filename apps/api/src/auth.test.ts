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
});
