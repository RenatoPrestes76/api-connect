import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgWorkspaces,
  listOrgMembers,
} from '../../routes/v1/organizations.js';
import {
  listAgents,
  getAgent,
  registerAgent,
  agentHeartbeat,
  getAgentHeartbeats,
  retireAgent,
} from '../../routes/v1/agents.js';
import {
  listPlugins,
  getPlugin,
  listInstalledPlugins,
  installPlugin,
  uninstallPlugin,
} from '../../routes/v1/plugins.js';

export interface TestServer {
  server: Server;
  baseUrl: string;
}

/**
 * Mirrors __tests__/security/helpers.ts's startServer() — a minimal router
 * with just the real authMiddleware plus the exact routes registered in
 * server.ts for organizations/agents/plugins, so these tests exercise the
 * real ctx.orgId-derived auth path, not a bypass.
 */
export async function startServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);

  router.get('/api/v1/organizations', listOrganizations);
  router.post('/api/v1/organizations', createOrganization);
  router.get('/api/v1/organizations/:id', getOrganization);
  router.put('/api/v1/organizations/:id', updateOrganization);
  router.delete('/api/v1/organizations/:id', deleteOrganization);
  router.get('/api/v1/organizations/:id/workspaces', listOrgWorkspaces);
  router.get('/api/v1/organizations/:id/members', listOrgMembers);
  router.get('/api/v1/organizations/:orgId/plugins', listInstalledPlugins);
  router.post('/api/v1/organizations/:orgId/plugins/:pluginId/install', installPlugin);
  router.delete('/api/v1/organizations/:orgId/plugins/:pluginId', uninstallPlugin);

  router.get('/api/v1/agents', listAgents);
  router.post('/api/v1/agents/register', registerAgent);
  router.get('/api/v1/agents/:id', getAgent);
  router.post('/api/v1/agents/:id/heartbeat', agentHeartbeat);
  router.get('/api/v1/agents/:id/heartbeats', getAgentHeartbeats);
  router.delete('/api/v1/agents/:id', retireAgent);

  router.get('/api/v1/plugins', listPlugins);
  router.get('/api/v1/plugins/:id', getPlugin);

  const server = createServer((req, res) => {
    void router.dispatch(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
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

/** Real HMAC-signed Supabase-style JWT — same convention as __tests__/security/helpers.ts. */
export function signSupabaseJWT(orgId: string | undefined, userId: string = randomUUID()): string {
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

export function orgBearer(orgId: string, userId?: string): Record<string, string> {
  return { Authorization: `Bearer ${signSupabaseJWT(orgId, userId)}` };
}

export function noOrgBearer(userId?: string): Record<string, string> {
  return { Authorization: `Bearer ${signSupabaseJWT(undefined, userId)}` };
}

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: unknown
): Promise<{ status: number; body: T }> {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body !== undefined) (init as { body?: string }).body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, init);
  const parsed = (await res.json().catch(() => null)) as T;
  return { status: res.status, body: parsed };
}

export const get = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'GET', path, headers);
export const post = <T>(
  baseUrl: string,
  path: string,
  headers?: Record<string, string>,
  body?: unknown
) => request<T>(baseUrl, 'POST', path, headers, body);
export const put = <T>(
  baseUrl: string,
  path: string,
  headers?: Record<string, string>,
  body?: unknown
) => request<T>(baseUrl, 'PUT', path, headers, body);
export const del = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'DELETE', path, headers);
