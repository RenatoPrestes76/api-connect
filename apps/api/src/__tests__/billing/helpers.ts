import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerBillingRoutes } from '../../routes/v1/billing/index.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { signAdminAccessToken } from '../../modules/admin-identity/jwt.js';

export interface TestServer {
  server: Server;
  baseUrl: string;
}

export async function startServer(): Promise<TestServer> {
  const router = new Router();
  // ATLAS 46.26 — every billing route sits behind the generic Supabase-style
  // authMiddleware in production (server.ts registers it globally); the old
  // version of this helper didn't register it at all, so these tests never
  // actually exercised the auth layer they now depend on for tenant scoping.
  router.use(authMiddleware);
  registerBillingRoutes(router);

  const server = createServer((req, res) => {
    void router.dispatch(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Signs a Supabase-style JWT the same way middleware/auth.ts's verifyJWT
 * checks it — HMAC-SHA256 over `${headerB64}.${payloadB64}` with
 * SUPABASE_JWT_SECRET (empty string if unset, matching that module's own
 * fallback). A real signature over a real payload, not a bypass, so these
 * tests exercise the exact code path production traffic goes through.
 */
export function signSupabaseJWT(orgId: string | undefined, userId = randomUUID()): string {
  const secret = process.env['SUPABASE_JWT_SECRET'] ?? '';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    email: `${userId}@example.com`,
    app_metadata: orgId !== undefined ? { organization_id: orgId } : {},
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  return `${headerB64}.${payloadB64}.${base64Url(sig)}`;
}

/** Bearer header for a real (org-scoped) authenticated tenant session. */
export function orgBearer(orgId: string, userId?: string): Record<string, string> {
  return { Authorization: `Bearer ${signSupabaseJWT(orgId, userId)}` };
}

/** Bearer header for an authenticated session with no organization linked. */
export function noOrgBearer(userId?: string): Record<string, string> {
  return { Authorization: `Bearer ${signSupabaseJWT(undefined, userId)}` };
}

/**
 * Registers a fresh admin user holding the COMERCIAL role (which grants
 * billing.manage) via the real admin-identity store and signs a real admin
 * access token for it — used to test the now-permission-gated
 * billing/admin/* routes and the Stripe webhook handler.
 */
export async function adminBearer(): Promise<Record<string, string>> {
  const role = adminIdentityStore.getAllRoles().find((r) => r.name === 'COMERCIAL');
  if (!role) throw new Error('COMERCIAL role not seeded in admin-identity store');
  const user = adminIdentityStore.createUser({
    name: 'Test Billing Admin',
    email: `billing-admin-${randomUUID()}@test.atlasconnect.internal`,
    passwordHash: 'unused-in-tests',
    roleId: role.id,
  });
  const token = await signAdminAccessToken({
    sub: user.id,
    role: 'COMERCIAL',
    name: user.name,
    email: user.email,
  });
  return { Authorization: `Bearer ${token}` };
}

/** Bearer header for an admin user with NO permissions (AUDITOR role). */
export async function lowPrivAdminBearer(): Promise<Record<string, string>> {
  const role = adminIdentityStore.getAllRoles().find((r) => r.name === 'AUDITOR');
  if (!role) throw new Error('AUDITOR role not seeded in admin-identity store');
  const user = adminIdentityStore.createUser({
    name: 'Test Auditor',
    email: `auditor-${randomUUID()}@test.atlasconnect.internal`,
    passwordHash: 'unused-in-tests',
    roleId: role.id,
  });
  const token = await signAdminAccessToken({
    sub: user.id,
    role: 'AUDITOR',
    name: user.name,
    email: user.email,
  });
  return { Authorization: `Bearer ${token}` };
}

export async function get<T>(
  baseUrl: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const body = res.status === 204 ? undefined : ((await res.json()) as T);
  return { status: res.status, body: body as T };
}

export async function post<T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: payload != null ? JSON.stringify(payload) : undefined,
  });
  const body = res.status === 204 ? undefined : ((await res.json()) as T);
  return { status: res.status, body: body as T };
}
