import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { registerPortalRoutes } from '../../routes/v1/portal/index.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
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
): Promise<{ status: number; body: T }> {
  const url = `${baseUrl}${path}`;
  const hdrs: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  const init: RequestInit = { method, headers: hdrs };
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
