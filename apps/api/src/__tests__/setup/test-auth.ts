import { createHmac } from 'node:crypto';

const TEST_JWT_SECRET = process.env['SUPABASE_JWT_SECRET'] ?? 'test-only-secret-do-not-use-in-prod';

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Signs a JWT matching apps/api/src/middleware/auth.ts's verifyJWT (HMAC-SHA256).
 * Pass no orgId to simulate an unscoped/platform-admin caller.
 */
export function signTestJWT(orgId?: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: 'test-user',
      exp: Math.floor(Date.now() / 1000) + 3600,
      app_metadata: orgId ? { organization_id: orgId } : {},
    })
  );
  const signature = createHmac('sha256', TEST_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.${signature}`;
}

export function authHeader(orgId?: string): Record<string, string> {
  return { Authorization: `Bearer ${signTestJWT(orgId)}` };
}
