import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { canonicalHeartbeatPayload } from '../../modules/runtime-registration/signature.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerAdminIdentityRoutes(router);
  registerRuntimeRegistrationRoutes(router);

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

/** Logs in as the seeded SUPER_ADMIN and returns a ready-to-use Authorization header. */
export async function superAdminAuth(
  baseUrl: string,
  ip = '10.30.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

// ─── Runtime key pair + signing helpers ────────────────────────────────────

export interface RuntimeKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

export function generateRuntimeKeyPair(): RuntimeKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

export function signHeartbeat(
  privateKeyPem: string,
  input: {
    runtimeId: string;
    version: string;
    memory: number;
    cpu: number;
    status?: string;
    timestamp: string;
  }
): string {
  const payload = canonicalHeartbeatPayload(input);
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

/** Registers a fresh Runtime against the seeded demo org + demo activation key, returns everything needed for further calls. */
export async function registerDemoRuntime(
  baseUrl: string,
  overrides: Partial<{
    organizationCode: string;
    activationKey: string;
    runtimeVersion: string;
    fingerprint: string;
    hostname: string;
    os: string;
    architecture: string;
  }> = {}
): Promise<{
  status: number;
  body: {
    data?: {
      runtimeId: string;
      certificate: string;
      organizationId: string;
      connectorsEnabled: string[];
      environments: Array<{ id: string; name: string; kind: string }>;
    };
    error?: { message: string; code: string };
  };
  keyPair: RuntimeKeyPair;
}> {
  const keyPair = generateRuntimeKeyPair();
  const result = await post<{
    data?: {
      runtimeId: string;
      certificate: string;
      organizationId: string;
      connectorsEnabled: string[];
      environments: Array<{ id: string; name: string; kind: string }>;
    };
    error?: { message: string; code: string };
  }>(baseUrl, '/runtime/register', {
    organizationCode: 'ORG-0001',
    activationKey: 'ATLAS-DEMO-0001',
    runtimeVersion: '1.2.0',
    fingerprint: `fp-${Math.random()}`,
    publicKey: keyPair.publicKeyPem,
    hostname: 'test-runtime.local',
    os: 'linux',
    architecture: 'x64',
    ...overrides,
  });
  return { status: result.status, body: result.body, keyPair };
}
