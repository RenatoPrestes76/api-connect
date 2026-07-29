import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerErpConnectivityRoutes } from '../../routes/v1/erp-connectivity/index.js';
import { registerErpMetadataRoutes } from '../../routes/v1/erp-metadata/index.js';
import { registerSemanticMappingRoutes } from '../../routes/v1/semantic-mapping/index.js';
import { registerCanonicalModelRoutes } from '../../routes/v1/canonical-model/index.js';
import { registerQueryPlannerRoutes } from '../../routes/v1/query-planner/index.js';
import { registerSqlGeneratorRoutes } from '../../routes/v1/sql-generator/index.js';
import { registerPortalRoutes } from '../../routes/v1/portal/index.js';
import { setUpOrgWithApprovedCanonicalModel } from '../query-planner/helpers.js';

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
  registerErpMetadataRoutes(router);
  registerSemanticMappingRoutes(router);
  registerCanonicalModelRoutes(router);
  registerQueryPlannerRoutes(router);
  registerSqlGeneratorRoutes(router);
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
  ip = '10.68.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

export { setUpOrgWithApprovedCanonicalModel };

interface PlanBody {
  plan?: { id: string };
  errors?: Array<{ code: string; message: string }>;
}

/** Builds a real, approved query plan (46.12) for the given org — everything a sql-generator test needs to call /sql-generator/generate against. */
export async function createQueryPlan(
  baseUrl: string,
  auth: Record<string, string>,
  organizationId: string,
  intent: Record<string, unknown>
): Promise<string> {
  const { body } = await post<PlanBody>(
    baseUrl,
    '/query-planner/plan',
    { organizationId, ...intent },
    auth
  );
  if (!body.plan) {
    throw new Error(`Failed to create query plan in test setup: ${JSON.stringify(body.errors)}`);
  }
  return body.plan.id;
}
