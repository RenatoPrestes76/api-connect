import { createServer } from 'node:http';
import type { AddressInfo } from 'node:http';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerPrometheusRoutes } from '../../routes/v1/prometheus/index.js';
import { authHeader } from '../setup/test-auth.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerPrometheusRoutes(router);

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
  orgId?: string
): Promise<{ status: number; body: T }> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader(orgId) },
  };
  if (payload !== undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    (init as any).body = JSON.stringify(payload);
  }
  const resp = await fetch(`${baseUrl}${path}`, init);
  let body: T;
  try {
    body = await resp.json();
  } catch {
    body = null as T;
  }
  return { status: resp.status, body };
}

/** Unscoped/platform-admin caller by default — pass orgId as the last arg to scope the request to a tenant. */
export const get = <T>(baseUrl: string, path: string, orgId?: string) =>
  request<T>(baseUrl, 'GET', path, undefined, orgId);
export const post = <T>(baseUrl: string, path: string, payload?: unknown, orgId?: string) =>
  request<T>(baseUrl, 'POST', path, payload, orgId);
