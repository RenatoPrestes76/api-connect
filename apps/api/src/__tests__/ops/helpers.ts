import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHmac, randomUUID } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerOpsRoutes } from '../../routes/v1/ops/index.js';
import { signPortalSessionToken } from '../../modules/portal-identity/jwt.js';
import { signRuntimeAccessToken } from '../../modules/runtime-registration/runtime-jwt.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
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

/**
 * ATLAS 46.26 — final hardening, Part 6: ops/* in production sits behind
 * server.ts's global authMiddleware (it's not in PUBLIC_PATH_PREFIXES),
 * but the pre-existing `startTestServer()` above never registered it, so
 * the original 40-odd tests never exercised that boundary at all — same
 * class of test gap Parts A/B/C found and fixed for portal/billing/
 * security. Added as a SEPARATE server-start helper (rather than retrofit
 * every existing call site with auth headers) to keep this an additive
 * confirmation, not the cross-cutting ops rewrite Part 6 explicitly rules
 * out.
 */
export async function startTestServerWithAuth(): Promise<TestServer> {
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

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** A real, validly-signed generic (Supabase-style) staff/system session. */
export function genericAuthBearer(): Record<string, string> {
  const secret = process.env['SUPABASE_JWT_SECRET'] ?? '';
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: randomUUID(),
    email: 'staff@atlasconnect.internal',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  return { Authorization: `Bearer ${headerB64}.${payloadB64}.${base64Url(sig)}` };
}

/** A real portal-identity session token — signed with PORTAL_JWT_SECRET, a different secret than ops's generic auth expects. */
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

/** A real Runtime access token — signed with RUNTIME_JWT_SECRET, a different secret than ops's generic auth expects. */
export async function runtimeBearer(): Promise<Record<string, string>> {
  const token = await signRuntimeAccessToken({
    runtimeId: randomUUID(),
    organizationId: randomUUID(),
  });
  return { Authorization: `Bearer ${token}` };
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
