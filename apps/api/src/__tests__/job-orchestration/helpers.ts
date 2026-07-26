import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { sign } from 'node:crypto';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerJobOrchestrationRoutes } from '../../routes/v1/job-orchestration/index.js';
import {
  canonicalJobResultPayload,
  canonicalClaimJobsPayload,
} from '../../modules/job-orchestration/job-signature.js';
import {
  registerDemoRuntime as registerDemoRuntimeCore,
  type RuntimeKeyPair,
} from '../runtime-registration/helpers.js';

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
const SEED_ORG_ID = 'org-demo-enterprise';

export async function superAdminAuth(
  baseUrl: string,
  ip = '10.60.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

/** Registers a fresh, active Runtime and returns its id + key pair (needed to sign job-result/claim requests). */
export async function registerActiveRuntimeWithKeys(
  baseUrl: string,
  runtimeVersion = '1.2.0'
): Promise<{ runtimeId: string; keyPair: RuntimeKeyPair; organizationId: string }> {
  const auth = await superAdminAuth(baseUrl);
  const issued = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode: 'ORG-0001' },
    auth
  );
  const reg = await registerDemoRuntimeCore(baseUrl, {
    activationKey: issued.body.activationKey.code,
    fingerprint: `fp-jo-${Math.random()}`,
    runtimeVersion,
  });
  return {
    runtimeId: reg.body.data!.runtimeId,
    keyPair: reg.keyPair,
    organizationId: reg.body.data!.organizationId,
  };
}

export function signJobResult(
  privateKeyPem: string,
  input: {
    jobId: string;
    runtimeId: string;
    outcome: 'success' | 'failure';
    result?: Record<string, unknown>;
    error?: string;
    timestamp: string;
  }
): string {
  const payload = canonicalJobResultPayload(input);
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

export function signClaimRequest(
  privateKeyPem: string,
  input: { runtimeId: string; timestamp: string }
): string {
  const payload = canonicalClaimJobsPayload(input);
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

export { SEED_ORG_ID };
