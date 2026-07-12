/**
 * Auth middleware — validates Bearer JWT (Supabase) or X-Api-Key header.
 * Sets ctx.userId and ctx.orgId on success.
 */
import { createHmac } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware, RouteContext } from '../http/router.js';
import { apiError } from '../http/router.js';

const JWT_SECRET = process.env['SUPABASE_JWT_SECRET'] ?? '';

// ─── JWT Verification (HMAC-SHA256 only — Supabase default) ────────────────

interface JWTPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
  role?: string;
  app_metadata?: { organization_id?: string };
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const padded2 = pad ? padded + '='.repeat(4 - pad) : padded;
  return Buffer.from(padded2, 'base64').toString('utf8');
}

function verifyJWT(token: string): JWTPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const sig = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expected = createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest();

  if (!sig.equals(expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/** Routes that bypass Supabase/API-key auth (handled by agent-auth middleware or public) */
const PUBLIC_PATHS = new Set([
  '/health',
  '/api/v1/health',
  '/api/v1/activate',
  '/api/v1/provision',
  '/api/v1/heartbeat',
  '/api/v1/sync-status',
  '/api/v1/me',
  '/api/v1/atlas/openapi',
]);

/**
 * Path prefixes with their own dedicated auth scheme (the Atlas Control Plane
 * admin-identity system — see middleware/admin-auth.ts) that must bypass
 * Supabase auth entirely rather than being 401'd before reaching their handler.
 */
const PUBLIC_PATH_PREFIXES = [
  '/admin/auth/',
  '/admin/audit-log',
  '/admin/control-plane/',
  '/admin/fleet',
  '/admin/chaos',
];

export const authMiddleware: Middleware = async (
  ctx: RouteContext,
  _req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => {
  if (
    PUBLIC_PATHS.has(ctx.pathname) ||
    PUBLIC_PATH_PREFIXES.some((p) => ctx.pathname.startsWith(p))
  ) {
    return next();
  }

  const authHeader = ctx.headers['authorization'] as string | undefined;
  const apiKey = ctx.headers['x-api-key'] as string | undefined;

  // API Key path (agents use this)
  if (apiKey) {
    // TODO: validate against database; for now accept any non-empty key in dev
    if (process.env['NODE_ENV'] === 'development' && apiKey.startsWith('dev_')) {
      ctx.userId = 'dev-user';
      ctx.orgId = ctx.headers['x-organization-id'] as string | undefined;
      return next();
    }
    apiError(res, 'Invalid API key', 401, 'INVALID_API_KEY');
    return;
  }

  // Bearer JWT path
  if (!authHeader?.startsWith('Bearer ')) {
    apiError(res, 'Missing Authorization header', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.slice(7);

  // In development with no JWT secret, accept any token
  if (!JWT_SECRET && process.env['NODE_ENV'] === 'development') {
    try {
      const parts = token.split('.');
      if (parts[1]) {
        const payload = JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;
        ctx.userId = payload.sub;
        ctx.orgId = payload.app_metadata?.organization_id;
      }
    } catch {
      /* ignore */
    }
    return next();
  }

  const payload = verifyJWT(token);
  if (!payload) {
    apiError(res, 'Invalid or expired token', 401, 'INVALID_TOKEN');
    return;
  }

  ctx.userId = payload.sub;
  ctx.orgId = payload.app_metadata?.organization_id;
  return next();
};
