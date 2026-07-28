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
import { registerPortalRoutes } from '../../routes/v1/portal/index.js';
import { registerDemoRuntime, type RuntimeKeyPair } from '../runtime-registration/helpers.js';
import { obtainRuntimeAccessToken } from '../erp-connectivity/helpers.js';
import {
  discoverSchemaForProfile,
  buildRichErpSchemaFixture,
} from '../semantic-mapping/helpers.js';

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
  ip = '10.66.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

/** Registers a brand-new tenant organization (via the portal self-service flow) with a caller-chosen internalCode — this is what makes distinct organizationIds available for tenant-isolation tests. */
export async function registerOrganization(
  baseUrl: string,
  internalCode: string
): Promise<{ organizationId: string }> {
  const { body } = await post<{ organization: { id: string } }>(
    baseUrl,
    '/api/v1/portal/auth/register',
    {
      name: `Empresa ${internalCode}`,
      razaoSocial: `Empresa ${internalCode} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}000${Math.floor(Math.random() * 100)}`,
      internalCode,
      plan: 'starter',
      owner: {
        name: 'Owner de Teste',
        email: `owner-${internalCode.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    }
  );
  return { organizationId: body.organization.id };
}

/** Registers a fresh, active Runtime under the given organization (by its internalCode) and returns everything needed to act as that Runtime. */
export async function registerActiveRuntimeForOrg(
  baseUrl: string,
  adminAuth: Record<string, string>,
  organizationCode: string
): Promise<{ runtimeId: string; keyPair: RuntimeKeyPair; organizationId: string }> {
  const issued = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode },
    adminAuth
  );
  const reg = await registerDemoRuntime(baseUrl, {
    organizationCode,
    activationKey: issued.body.activationKey.code,
    fingerprint: `fp-cbm-${Math.random()}`,
  });
  return {
    runtimeId: reg.body.data!.runtimeId,
    keyPair: reg.keyPair,
    organizationId: reg.body.data!.organizationId,
  };
}

export async function createConnectionProfile(
  baseUrl: string,
  auth: Record<string, string>,
  input: { runtimeId: string; organizationId: string }
): Promise<string> {
  const { body } = await post<{ profile: { id: string } }>(
    baseUrl,
    '/erp-connectivity/profiles',
    {
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      name: 'ERP de teste',
      dbType: 'POSTGRESQL',
      host: 'db.cliente.local',
      port: 5432,
      database: 'erp_prod',
      username: 'erp_user',
      password: 'S3nhaSuperSecreta!',
    },
    auth
  );
  return body.profile.id;
}

/**
 * Connects one more ERP to an *existing* organization: register runtime ->
 * connect profile -> discover schema (46.9) -> analyze (46.10) -> approve
 * every suggested table as-is. Safe to call multiple times against the same
 * organizationCode to simulate a tenant with several connected ERPs.
 */
export async function connectAndApproveErp(
  baseUrl: string,
  auth: Record<string, string>,
  organizationCode: string
): Promise<{ runtimeId: string; profileId: string; organizationId: string }> {
  const { runtimeId, keyPair, organizationId } = await registerActiveRuntimeForOrg(
    baseUrl,
    auth,
    organizationCode
  );
  const profileId = await createConnectionProfile(baseUrl, auth, { runtimeId, organizationId });
  const runtimeToken = await obtainRuntimeAccessToken(baseUrl, runtimeId, keyPair.privateKeyPem);
  await discoverSchemaForProfile(
    baseUrl,
    auth,
    { runtimeId, organizationId, profileId, runtimeToken },
    buildRichErpSchemaFixture()
  );
  await post(baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
  const { body: entitiesBody } = await get<{ entities: Array<{ schema: string; table: string }> }>(
    baseUrl,
    `/semantic-mapping/entities?profileId=${profileId}`,
    auth
  );
  for (const mapping of entitiesBody.entities) {
    await post(
      baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: mapping.schema, table: mapping.table, decision: 'APPROVE' },
      auth
    );
  }
  return { runtimeId, profileId, organizationId };
}

/**
 * Full pipeline for one ERP connection under a brand-new organization:
 * create org -> connect + discover + analyze + approve one ERP. Returns the
 * real organizationId to use for canonical-model calls.
 */
export async function setUpFullyApprovedProfile(
  baseUrl: string,
  auth: Record<string, string>,
  organizationCode: string
): Promise<{ runtimeId: string; profileId: string; organizationId: string }> {
  await registerOrganization(baseUrl, organizationCode);
  return connectAndApproveErp(baseUrl, auth, organizationCode);
}
