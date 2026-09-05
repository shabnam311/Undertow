import { createHmac, timingSafeEqual } from 'crypto';

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || 'undertow_jwt_signing_secret_2026';

export type SessionUser = {
  id: string;
  role: 'owner' | 'analyst' | 'viewer';
  merchantId: string;
  email: string;
  name: string;
  merchantName: string;
  exp: number; // unix timestamp in seconds
};

export function signSessionToken(payload: Omit<SessionUser, 'exp'>): string {
  const fullPayload: SessionUser = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours expiry
  };
  const bodyBase64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', AUTH_SECRET).update(bodyBase64).digest('base64url');
  return `ut_${bodyBase64}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  if (!token || !token.startsWith('ut_')) {
    return null;
  }
  const raw = token.slice(3); // remove 'ut_'
  const parts = raw.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [bodyBase64, signature] = parts;
  const expectedSig = createHmac('sha256', AUTH_SECRET).update(bodyBase64).digest('base64url');

  if (
    signature.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(bodyBase64, 'base64url').toString('utf8')) as SessionUser;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }
    return payload;
  } catch {
    return null;
  }
}
