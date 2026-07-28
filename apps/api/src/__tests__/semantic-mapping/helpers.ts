import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DatabaseSchema } from '@seltriva/database-sdk';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerRuntimeRegistrationRoutes } from '../../routes/v1/runtime-registration/index.js';
import { registerErpConnectivityRoutes } from '../../routes/v1/erp-connectivity/index.js';
import { registerErpMetadataRoutes } from '../../routes/v1/erp-metadata/index.js';
import { registerSemanticMappingRoutes } from '../../routes/v1/semantic-mapping/index.js';
import { registerActiveRuntimeWithKeys } from '../job-orchestration/helpers.js';
import { obtainRuntimeAccessToken } from '../erp-connectivity/helpers.js';

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
  ip = '10.65.0.1'
): Promise<Record<string, string>> {
  const { body } = await post<{ accessToken: string }>(
    baseUrl,
    '/admin/auth/login',
    { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return bearer(body.accessToken);
}

export { registerActiveRuntimeWithKeys, obtainRuntimeAccessToken };

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
 * Runs discovery end-to-end (request -> runtime claim -> runtime report)
 * so a real DatabaseIntelligenceReport lands in erpMetadataStore for the
 * given profile — semantic-mapping tests build on top of that, exactly as
 * the real pipeline would (never re-implementing the discovery flow).
 */
export async function discoverSchemaForProfile(
  baseUrl: string,
  auth: Record<string, string>,
  input: { runtimeId: string; organizationId: string; profileId: string; runtimeToken: string },
  schema: DatabaseSchema
): Promise<void> {
  const { body: discoverBody } = await post<{ request: { id: string } }>(
    baseUrl,
    '/erp-metadata/discover',
    {
      runtimeId: input.runtimeId,
      organizationId: input.organizationId,
      profileId: input.profileId,
    },
    auth
  );
  await get(baseUrl, '/erp-metadata/runtime/jobs', bearer(input.runtimeToken));
  await post(
    baseUrl,
    '/erp-metadata/runtime/result',
    { requestId: discoverBody.request.id, runtimeId: input.runtimeId, success: true, schema },
    bearer(input.runtimeToken)
  );
}

/**
 * A richer ERP schema than erp-metadata's own fixture — includes a purchase
 * header + line-item pair, an operator table, a brand lookup, and a unit
 * lookup, so every semantic-mapping refinement rule has something to fire on.
 */
export function buildRichErpSchemaFixture(): DatabaseSchema {
  const col = (
    name: string,
    type: string,
    overrides: Partial<{
      nullable: boolean;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
      isUnique: boolean;
    }> = {}
  ) => ({
    name,
    type,
    nullable: overrides.nullable ?? true,
    isPrimaryKey: overrides.isPrimaryKey ?? false,
    isForeignKey: overrides.isForeignKey ?? false,
    isUnique: overrides.isUnique ?? false,
  });

  return {
    name: 'erp_teste',
    tables: [
      {
        name: 'produtos',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('codigo', 'varchar', { nullable: false, isUnique: true }),
          col('descricao', 'varchar', { nullable: false }),
          col('preco_venda', 'numeric'),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
      {
        name: 'compras',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('fornecedor_id', 'integer', { nullable: false, isForeignKey: true }),
          col('data_compra', 'date', { nullable: false }),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
      {
        name: 'compras_itens',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('compra_id', 'integer', { nullable: false, isForeignKey: true }),
          col('produto_id', 'integer', { nullable: false, isForeignKey: true }),
          col('quantidade', 'integer', { nullable: false }),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [
          { column: 'compra_id', referencedTable: 'compras', referencedColumn: 'id' },
          { column: 'produto_id', referencedTable: 'produtos', referencedColumn: 'id' },
        ],
        indexes: [],
      },
      {
        name: 'operadores',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('nome', 'varchar', { nullable: false }),
          col('matricula', 'varchar'),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
      {
        name: 'marcas',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('nome', 'varchar', { nullable: false }),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
      {
        name: 'unidades_medida',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('sigla', 'varchar', { nullable: false }),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
    ],
    relations: [],
    discoveredAt: new Date(),
  };
}
