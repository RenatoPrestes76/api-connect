import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerErpConnectivityRoutes } from '../../routes/v1/erp-connectivity/index.js';
import { registerRuntimeConnectorExecutionRoutes } from '../../routes/v1/runtime-connector-execution/index.js';
import { registerActiveRuntimeWithKeys } from '../job-orchestration/helpers.js';
import { obtainRuntimeAccessToken } from '../erp-connectivity/helpers.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerAdminIdentityRoutes(router);
  registerRuntimeRegistrationRoutes(router);
  registerErpConnectivityRoutes(router);
  registerRuntimeConnectorExecutionRoutes(router);

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

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const SEED_ADMIN_EMAIL = 'admin@atlasconnect.com.br';
const SEED_ADMIN_PASSWORD = 'root102030';

export async function superAdminAuth(
  baseUrl: string,
  ip = '10.63.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

export { registerActiveRuntimeWithKeys, obtainRuntimeAccessToken };

/** Creates an ERP connection profile for the given Runtime via the already-built erp-connectivity module. */
export async function createConnectionProfile(
  baseUrl: string,
  auth: Record<string, string>,
  input: { runtimeId: string; organizationId: string }
): Promise<string> {
  const { body } = await post<{ profile: { id: string } }>(
    baseUrl,
    '/erp-connectivity/profiles',
    {
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      name: 'ERP de teste',
      dbType: 'POSTGRESQL',
      host: 'db.cliente.local',
      port: 5432,
      database: 'erp_prod',
      username: 'erp_user',
      password: 'S3nhaSuperSecreta!',
    },
    auth
  );
  return body.profile.id;
}
