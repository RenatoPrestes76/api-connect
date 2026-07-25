import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { gatewayMiddleware } from '../../middleware/gateway.js';
import { registerPortalRoutes } from '../../routes/v1/portal/index.js';
import { liveHandler, readyHandler } from '../../routes/live-ready.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  router.use(gatewayMiddleware);
  router.get('/live', liveHandler);
  router.get('/ready', readyHandler);
  registerPortalRoutes(router);

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
  headers?: Record<string, string>
): Promise<{ status: number; body: T; headers: Headers }> {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (payload !== undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    (init as { body?: string }).body = JSON.stringify(payload);
  }
  const resp = await fetch(`${baseUrl}${path}`, init);
  let body: T;
  try {
    body = (await resp.json()) as T;
  } catch {
    body = null as T;
  }
  return { status: resp.status, body, headers: resp.headers };
}

export const get = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'GET', path, undefined, headers);
export const post = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'POST', path, payload, headers);
export const patch = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'PATCH', path, payload, headers);
export const del = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'DELETE', path, undefined, headers);

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const SEED_OWNER_EMAIL = 'owner@enterprise.demo';
const SEED_OWNER_PASSWORD = 'TrocarNoPrimeiroLogin!';

/** Logs in as the seeded demo organization's Owner and returns a ready-to-use Authorization header. */
export async function seededOwnerAuth(baseUrl: string): Promise<Record<string, string>> {
  const { body } = await post<{ token: string }>(baseUrl, '/api/v1/portal/auth/login', {
    email: SEED_OWNER_EMAIL,
    password: SEED_OWNER_PASSWORD,
  });
  return bearer(body.token);
}

/** Registers a brand-new organization + Owner, isolated from the seeded demo org — useful when a test needs its own rate-limit/log namespace. */
export async function registerFreshOrg(
  baseUrl: string,
  suffix: string
): Promise<{ auth: Record<string, string>; organizationId: string }> {
  const { body } = await post<{
    organization: { id: string };
    user: { organizationId: string };
    token: string;
  }>(baseUrl, '/api/v1/portal/auth/register', {
    name: `Gateway Test Org ${suffix}`,
    razaoSocial: `Gateway Test Org ${suffix} Ltda`,
    cnpj: '00.000.000/0001-00',
    internalCode: `GW-${suffix}`,
    owner: {
      name: 'Gateway Tester',
      email: `owner-${suffix}@gateway.test`,
      password: 'S3nhaForte!',
    },
  });
  return { auth: bearer(body.token), organizationId: body.user.organizationId };
}
