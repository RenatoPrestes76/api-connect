import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Router } from '../../http/router.js';
import { registerOrchestratorRoutes } from '../../routes/v1/orchestrator/index.js';

export interface TestOrchestratorServer {
  server: Server;
  baseUrl: string;
}

export async function startOrchestratorServer(): Promise<TestOrchestratorServer> {
  const router = new Router();
  registerOrchestratorRoutes(router);

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

export async function get<T>(baseUrl: string, path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`);
  const body = res.status === 204 ? undefined : ((await res.json()) as T);
  return { status: res.status, body: body as T };
}

export async function post<T>(
  baseUrl: string,
  path: string,
  payload?: unknown
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload != null ? JSON.stringify(payload) : undefined,
  });
  const body = res.status === 204 ? undefined : ((await res.json()) as T);
  return { status: res.status, body: body as T };
}

export async function put<T>(
  baseUrl: string,
  path: string,
  payload?: unknown
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: payload != null ? JSON.stringify(payload) : undefined,
  });
  const body = res.status === 204 ? undefined : ((await res.json()) as T);
  return { status: res.status, body: body as T };
}

export async function del(baseUrl: string, path: string): Promise<{ status: number }> {
  const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE' });
  return { status: res.status };
}
