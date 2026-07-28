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
import { registerPortalRoutes } from '../../routes/v1/portal/index.js';
import { registerOrganization, setUpFullyApprovedProfile } from '../canonical-model/helpers.js';

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
  ip = '10.67.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

/**
 * Full pipeline for one fresh organization with an approved canonical
 * model: discover + analyze + approve one ERP (46.9/46.10), build + approve
 * the canonical model (46.11). Returns everything a query-planner test
 * needs to plan against a real, populated CBM.
 */
export async function setUpOrgWithApprovedCanonicalModel(
  baseUrl: string,
  auth: Record<string, string>,
  organizationCode: string
): Promise<{ organizationId: string; canonicalModelId: string }> {
  const { organizationId } = await setUpFullyApprovedProfile(baseUrl, auth, organizationCode);
  const built = await post<{ model: { id: string } }>(
    baseUrl,
    '/canonical-model/build',
    { organizationId },
    auth
  );
  await post(
    baseUrl,
    '/canonical-model/approve',
    { organizationId, modelId: built.body.model.id },
    auth
  );
  return { organizationId, canonicalModelId: built.body.model.id };
}

export { registerOrganization };
