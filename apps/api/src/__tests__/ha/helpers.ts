import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Router } from '../../http/router.js';
import { registerHaRoutes } from '../../routes/v1/ha/index.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { signAdminAccessToken } from '../../modules/admin-identity/jwt.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/** Registers a fresh admin holding DEVOPS (has ha.manage) and returns a Bearer header. */
export async function haAdminBearer(): Promise<Record<string, string>> {
  const role = adminIdentityStore.getAllRoles().find((r) => r.name === 'DEVOPS');
  if (!role) throw new Error('DEVOPS role not seeded in admin-identity store');
  const user = adminIdentityStore.createUser({
    name: 'Test HA Admin',
    email: `ha-admin-${randomUUID()}@test.atlasconnect.internal`,
    passwordHash: 'unused-in-tests',
    roleId: role.id,
  });
  const token = await signAdminAccessToken({
    sub: user.id,
    role: 'DEVOPS',
    name: user.name,
    email: user.email,
  });
  return { Authorization: `Bearer ${token}` };
}

/** Bearer header for an admin user with NO permissions (AUDITOR role). */
export async function lowPrivAdminBearer(): Promise<Record<string, string>> {
  const role = adminIdentityStore.getAllRoles().find((r) => r.name === 'AUDITOR');
  if (!role) throw new Error('AUDITOR role not seeded in admin-identity store');
  const user = adminIdentityStore.createUser({
    name: 'Test HA Auditor',
    email: `ha-auditor-${randomUUID()}@test.atlasconnect.internal`,
    passwordHash: 'unused-in-tests',
    roleId: role.id,
  });
  const token = await signAdminAccessToken({
    sub: user.id,
    role: 'AUDITOR',
    name: user.name,
    email: user.email,
  });
  return { Authorization: `Bearer ${token}` };
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  registerHaRoutes(router);

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
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  };
  if (payload !== undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
    (init as any).body = JSON.stringify(payload);
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

export const get = <T>(baseUrl: string, path: string, headers?: Record<string, string>) =>
  request<T>(baseUrl, 'GET', path, undefined, headers);
export const post = <T>(
  baseUrl: string,
  path: string,
  payload?: unknown,
  headers?: Record<string, string>
) => request<T>(baseUrl, 'POST', path, payload, headers);
