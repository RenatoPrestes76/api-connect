import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerConnectorManagementRoutes } from '../../routes/v1/connector-management/index.js';
import { registerDemoRuntime as registerDemoRuntimeCore } from '../runtime-registration/helpers.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerAdminIdentityRoutes(router);
  registerRuntimeRegistrationRoutes(router);
  registerConnectorManagementRoutes(router);

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
  ip = '10.50.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

/** Registers a fresh, active Runtime (via the Sprint 46.3 flow) and returns its runtimeId. */
export async function registerActiveRuntime(
  baseUrl: string,
  runtimeVersion = '1.2.0'
): Promise<string> {
  const auth = await superAdminAuth(baseUrl);
  const issued = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode: 'ORG-0001' },
    auth
  );
  const reg = await registerDemoRuntimeCore(baseUrl, {
    activationKey: issued.body.activationKey.code,
    fingerprint: `fp-cm-${Math.random()}`,
    runtimeVersion,
  });
  return reg.body.data!.runtimeId;
}

/** Creates a connector with one published stable version through the new connector-management endpoints. */
export async function createConnectorWithVersion(
  baseUrl: string,
  auth: Record<string, string>,
  overrides: Partial<{
    identifier: string;
    name: string;
    minRuntimeVersion: string;
    version: string;
  }> = {}
): Promise<{ connectorId: string; version: string }> {
  const identifier = overrides.identifier ?? `conn-${Math.random().toString(36).slice(2, 8)}`;
  const created = await post<{ connector: { id: string } }>(
    baseUrl,
    '/connectors',
    {
      identifier,
      name: overrides.name ?? 'Test Connector',
      category: 'ERP',
      vendor: 'TestVendor',
      description: 'Integration test connector',
      minRuntimeVersion: overrides.minRuntimeVersion ?? '1.0.0',
    },
    auth
  );
  const connectorId = created.body.connector.id;
  const version = overrides.version ?? '1.0.0';
  await post(
    baseUrl,
    '/connectors/publish',
    {
      connectorId,
      version,
      changelog: 'Initial release',
      status: 'stable',
      minRuntimeVersion: overrides.minRuntimeVersion ?? '1.0.0',
      dependencies: [],
    },
    auth
  );
  return { connectorId, version };
}
