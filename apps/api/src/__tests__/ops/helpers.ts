import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHmac, randomUUID } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerOpsRoutes } from '../../routes/v1/ops/index.js';
import { signPortalSessionToken } from '../../modules/portal-identity/jwt.js';
import { signRuntimeAccessToken } from '../../modules/runtime-registration/runtime-jwt.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { signAdminAccessToken } from '../../modules/admin-identity/jwt.js';
import type { AdminRoleName } from '../../modules/admin-identity/types.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * ATLAS 46.27 — ops/* now requires admin-identity's requirePermission,
 * not the generic Supabase-style authMiddleware, but the middleware is
 * still registered here (mirroring production's server.ts) to exercise
 * the real auth chain end-to-end, including the PUBLIC_PATH_PREFIXES
 * bypass this sprint added — the exact class of routing bug ATLAS 46.26
 * found (and fixed) more than once for other admin-gated surfaces.
 */
export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerOpsRoutes(router);

  const srv = createServer((req, res) => void router.dispatch(req, res));
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => srv.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  payload?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: T }> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  const init: RequestInit = { method, headers };
  if (payload !== undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    (init as any).body = JSON.stringify(payload);
  }
  const resp = await fetch(url, init);
  let body: T;
  try {
    body = (await resp.json()) as T;
  } catch {
    body = null as T;
  }
  return { status: resp.status, body };
}

export const get = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'GET', path, undefined, headers);
export const post = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'POST', path, payload, headers);
export const put = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'PUT', path, payload, headers);
export const del = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'DELETE', path, payload, headers);

async function adminBearerForRole(
  role: AdminRoleName,
  label: string
): Promise<Record<string, string>> {
  const roleRecord = adminIdentityStore.getAllRoles().find((r) => r.name === role);
  if (!roleRecord) throw new Error(`${role} role not seeded in admin-identity store`);
  const user = adminIdentityStore.createUser({
    name: `Test ${label}`,
    email: `${label.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}@test.atlasconnect.internal`,
    passwordHash: 'unused-in-tests',
    roleId: roleRecord.id,
  });
  const token = await signAdminAccessToken({
    sub: user.id,
    role,
    name: user.name,
    email: user.email,
  });
  return { Authorization: `Bearer ${token}` };
}

/** Holds both ops.read and ops.manage. */
export const adminBearer = () => adminBearerForRole('ATLAS_ADMIN', 'Ops Admin');

/** Holds ops.read only — no ops.manage. */
export const readOnlyOpsBearer = () => adminBearerForRole('SUPORTE', 'Ops Read Only');

/** Holds neither ops.read nor ops.manage (billing/sales-focused role). */
export const noOpsPermissionBearer = () => adminBearerForRole('COMERCIAL', 'No Ops Permission');

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * A real, validly-signed GENERIC (Supabase-style) session — this is what
 * "any authenticated caller" used to be enough to reach ops/* before this
 * sprint. Now must be rejected: ops/* requires an admin-identity Bearer
 * token, a different scheme entirely, and this path is no longer even
 * routed through the generic authMiddleware (see PUBLIC_PATH_PREFIXES).
 */
export function genericAuthBearer(): Record<string, string> {
  const secret = process.env['SUPABASE_JWT_SECRET'] ?? '';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: randomUUID(),
    email: 'generic-user@test.atlasconnect.internal',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  return { Authorization: `Bearer ${headerB64}.${payloadB64}.${base64Url(sig)}` };
}

/** A real portal-identity session token — different signing secret than admin-identity expects. */
export async function portalUserBearer(): Promise<Record<string, string>> {
  const token = await signPortalSessionToken({
    sub: randomUUID(),
    organizationId: randomUUID(),
    role: 'OWNER',
    name: 'Test Portal User',
    email: 'portal-user@test.atlasconnect.internal',
  });
  return { Authorization: `Bearer ${token}` };
}

/** A real Runtime access token — different signing secret than admin-identity expects. */
export async function runtimeBearer(): Promise<Record<string, string>> {
  const token = await signRuntimeAccessToken({
    runtimeId: randomUUID(),
    organizationId: randomUUID(),
  });
  return { Authorization: `Bearer ${token}` };
}
