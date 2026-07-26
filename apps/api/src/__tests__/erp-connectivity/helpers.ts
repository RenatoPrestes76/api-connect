import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { sign } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerJobOrchestrationRoutes } from '../../routes/v1/job-orchestration/index.js';
import { registerErpConnectivityRoutes } from '../../routes/v1/erp-connectivity/index.js';
import {
  canonicalHealthReportPayload,
  canonicalDiagnosticsReportPayload,
} from '../../modules/erp-connectivity/signature.js';
import { registerActiveRuntimeWithKeys } from '../job-orchestration/helpers.js';
import type { RuntimeKeyPair } from '../runtime-registration/helpers.js';
import { canonicalAuthTokenPayload } from '../../modules/runtime-registration/signature.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerAdminIdentityRoutes(router);
  registerRuntimeRegistrationRoutes(router);
  registerJobOrchestrationRoutes(router);
  registerErpConnectivityRoutes(router);

  const srv = createServer((req, res) => void router.dispatch(req, res));
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => srv.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function request<T = any>(
  baseUrl: string,
  method: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: T }> {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (payload !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    (init as { body?: string }).body = JSON.stringify(payload);
  }
  const resp = await fetch(`${baseUrl}${path}`, init);
  let body: T;
  try {
    body = (await resp.json()) as T;
  } catch {
    body = null as T;
  }
  return { status: resp.status, body };
}

export const get = <T = any>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'GET', path, undefined, headers);
export const post = <T = any>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'POST', path, payload, headers);
export const patch = <T = any>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'PATCH', path, payload, headers);
export const del = <T = any>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'DELETE', path, payload, headers);

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const SEED_ADMIN_EMAIL = 'admin@atlasconnect.com.br';
const SEED_ADMIN_PASSWORD = 'root102030';

export async function superAdminAuth(
  baseUrl: string,
  ip = '10.62.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

export { registerActiveRuntimeWithKeys, type RuntimeKeyPair };

export function signHealthReport(
  privateKeyPem: string,
  input: {
    profileId: string;
    runtimeId: string;
    success: boolean;
    responseTimeMs?: number;
    activeConnections?: number;
    avgQueryTimeMs?: number;
    error?: string;
    timestamp: string;
  }
): string {
  const payload = canonicalHealthReportPayload(input);
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

export function signDiagnosticsReport(
  privateKeyPem: string,
  input: {
    profileId: string;
    runtimeId: string;
    dns: string;
    tcp: string;
    authentication: string;
    database: string;
    latencyMs?: number;
    permissions: string;
    driver: string;
    encryption: string;
    timestamp: string;
  }
): string {
  const payload = canonicalDiagnosticsReportPayload(input);
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

/** Exchanges a Runtime's signed proof-of-identity for a JWT access token (Sprint 46.7). */
export async function obtainRuntimeAccessToken(
  baseUrl: string,
  runtimeId: string,
  privateKeyPem: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = canonicalAuthTokenPayload({ runtimeId, timestamp });
  const signature = sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
  const { body } = await post<{ accessToken: string }>(baseUrl, '/runtime/auth/token', {
    runtimeId,
    timestamp,
    signature,
  });
  return body.accessToken;
}
