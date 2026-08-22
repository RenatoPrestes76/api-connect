import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerActiveRuntimeWithKeys,
  obtainRuntimeAccessToken,
  createConnectionProfile,
  discoverSchemaForProfile,
  buildRichErpSchemaFixture,
  type TestServer,
} from './helpers.js';
import { SEED_ORG_ID } from '../job-orchestration/helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface MappingDTO {
  schema: string;
  table: string;
  athenaEntity: string;
  suggestedEntity: string;
  suggestedConfidence: number;
  status: string;
  approvedEntity: string | null;
  approvedBy: string | null;
  modelVersion: number;
  history: Array<{ action: string; entity: string }>;
  alternatives: Array<{ entity: string; confidence: number }>;
  reasons: Array<{ signal: string; weight: number; detail: string }>;
  conflicts: Array<{ entityA: string; entityB: string; detail: string }>;
  reasoning: string;
}

interface EntitiesBody {
  total: number;
  entities: MappingDTO[];
}
interface ReviewBody {
  total: number;
  mappings: MappingDTO[];
}
interface AnalyzeBody {
  summary: {
    profileId: string;
    tablesAnalyzed: number;
    suggested: number;
    resuggested: number;
    preserved: number;
    pending: number;
    approved: number;
    modelVersion: number;
  };
}
interface ApproveBody {
  mapping: MappingDTO;
}

let srv: TestServer;
let auth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);
});

afterAll(async () => {
  await srv.close();
});

async function setUpDiscoveredProfile() {
  const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
  const profileId = await createConnectionProfile(srv.baseUrl, auth, {
    runtimeId,
    organizationId: SEED_ORG_ID,
  });
  const runtimeToken = await obtainRuntimeAccessToken(
    srv.baseUrl,
    runtimeId,
    keyPair.privateKeyPem
  );
  await discoverSchemaForProfile(
    srv.baseUrl,
    auth,
    { runtimeId, organizationId: SEED_ORG_ID, profileId, runtimeToken },
    buildRichErpSchemaFixture()
  );
  return { runtimeId, profileId };
}

function findMapping(entities: MappingDTO[], table: string): MappingDTO {
  const m = entities.find((e) => e.table === table);
  if (!m) throw new Error(`mapping for table '${table}' not found`);
  return m;
}

describe('rejects unauthenticated access', () => {
  it('analyze/entities/review/approve all require a Bearer token', async () => {
    const analyze = await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId: 'x' });
    expect(analyze.status).toBe(401);
    const entities = await get(srv.baseUrl, '/semantic-mapping/entities?profileId=x');
    expect(entities.status).toBe(401);
    const review = await get(srv.baseUrl, '/semantic-mapping/review?profileId=x');
    expect(review.status).toBe(401);
    const approve = await post(srv.baseUrl, '/semantic-mapping/approve', {
      profileId: 'x',
      schema: 'public',
      table: 't',
      decision: 'APPROVE',
    });
    expect(approve.status).toBe(401);
  });
});

describe('POST /semantic-mapping/analyze', () => {
  it('rejects analysis for a profile that has never been discovered', async () => {
    const { profileId } = await (async () => {
      const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
      const id = await createConnectionProfile(srv.baseUrl, auth, {
        runtimeId,
        organizationId: SEED_ORG_ID,
      });
      return { profileId: id };
    })();

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_DISCOVERED');
  });

  it('refines ATHENA classifications into the fuller business vocabulary', async () => {
    const { profileId } = await setUpDiscoveredProfile();

    const { status, body } = await post<AnalyzeBody>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auth
    );
    expect(status).toBe(200);
    expect(body.summary.tablesAnalyzed).toBeGreaterThanOrEqual(6);
    expect(body.summary.suggested).toBe(body.summary.tablesAnalyzed);
    expect(body.summary.pending).toBe(body.summary.tablesAnalyzed);
    expect(body.summary.modelVersion).toBe(2);

    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );

    expect(findMapping(entitiesBody.entities, 'produtos').suggestedEntity).toBe('PRODUTO');
    expect(findMapping(entitiesBody.entities, 'compras_itens').suggestedEntity).toBe('ITEM_COMPRA');
    expect(findMapping(entitiesBody.entities, 'operadores').suggestedEntity).toBe('OPERADOR');
    expect(findMapping(entitiesBody.entities, 'marcas').suggestedEntity).toBe('MARCA');
    expect(findMapping(entitiesBody.entities, 'unidades_medida').suggestedEntity).toBe('UNIDADE');

    const compraItens = findMapping(entitiesBody.entities, 'compras_itens');
    expect(compraItens.reasons.length).toBeGreaterThan(0);
    expect(compraItens.status).toBe('PENDING');
  });

  it('recognizes Warehouse, Payment, Employee, ProductVariant, and InventoryLot (the remaining minimum ERP entities)', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);

    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );

    expect(findMapping(entitiesBody.entities, 'depositos').suggestedEntity).toBe('DEPOSITO');
    expect(findMapping(entitiesBody.entities, 'pagamentos').suggestedEntity).toBe('PAGAMENTO');
    expect(findMapping(entitiesBody.entities, 'funcionarios').suggestedEntity).toBe('FUNCIONARIO');
    expect(findMapping(entitiesBody.entities, 'produto_variacoes').suggestedEntity).toBe(
      'VARIANTE_PRODUTO'
    );
    expect(findMapping(entitiesBody.entities, 'lotes').suggestedEntity).toBe('LOTE');
  });

  it('every mapping carries an explainable reasoning string and a (possibly empty) conflicts array', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);

    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );

    expect(entitiesBody.entities.length).toBeGreaterThan(0);
    for (const mapping of entitiesBody.entities) {
      expect(typeof mapping.reasoning).toBe('string');
      expect(mapping.reasoning.length).toBeGreaterThan(0);
      expect(Array.isArray(mapping.conflicts)).toBe(true);
    }
  });
});

describe('GET /semantic-mapping/review', () => {
  it('lists only PENDING mappings by default, with reasons and alternatives for the reviewer', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);

    const { status, body } = await get<ReviewBody>(
      srv.baseUrl,
      `/semantic-mapping/review?profileId=${profileId}`,
      auth
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.mappings.every((m) => m.status === 'PENDING')).toBe(true);
  });
});

describe('POST /semantic-mapping/approve', () => {
  it('rejects approving a table that was never analyzed', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: 'public', table: 'produtos', decision: 'APPROVE' },
      auth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_ANALYZED');
  });

  it('approves the suggested entity as-is', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const produtos = findMapping(entitiesBody.entities, 'produtos');

    const { status, body } = await post<ApproveBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: produtos.schema, table: 'produtos', decision: 'APPROVE' },
      auth
    );
    expect(status).toBe(200);
    expect(body.mapping.status).toBe('APPROVED');
    expect(body.mapping.approvedEntity).toBe('PRODUTO');
    expect(body.mapping.approvedBy).toBeTruthy();
    expect(body.mapping.history.at(-1)?.action).toBe('APPROVED');
  });

  it('overrides the suggestion with a runner-up entity, recorded as OVERRIDDEN', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const marcas = findMapping(entitiesBody.entities, 'marcas');

    const { status, body } = await post<ApproveBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      {
        profileId,
        schema: marcas.schema,
        table: 'marcas',
        decision: 'APPROVE',
        entity: 'CATEGORIA',
      },
      auth
    );
    expect(status).toBe(200);
    expect(body.mapping.approvedEntity).toBe('CATEGORIA');
    expect(body.mapping.history.at(-1)?.action).toBe('OVERRIDDEN');
  });

  it('rejects an invalid override entity', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const produtos = findMapping(entitiesBody.entities, 'produtos');

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      {
        profileId,
        schema: produtos.schema,
        table: 'produtos',
        decision: 'APPROVE',
        entity: 'NOT_A_REAL_ENTITY',
      },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_ENTITY');
  });

  it('rejects a mapping, marking it REJECTED', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const operadores = findMapping(entitiesBody.entities, 'operadores');

    const { status, body } = await post<ApproveBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: operadores.schema, table: 'operadores', decision: 'REJECT' },
      auth
    );
    expect(status).toBe(200);
    expect(body.mapping.status).toBe('REJECTED');
    expect(body.mapping.approvedEntity).toBeNull();
  });
});

describe('re-analysis preserves approved mappings', () => {
  it('keeps an approved mapping approved across a second /analyze call', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: firstEntities } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const produtos = findMapping(firstEntities.entities, 'produtos');
    await post(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: produtos.schema, table: 'produtos', decision: 'APPROVE' },
      auth
    );

    // Re-run analysis against the same unchanged erp-metadata report.
    const { body: secondAnalyze } = await post<AnalyzeBody>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auth
    );
    expect(secondAnalyze.summary.approved).toBeGreaterThanOrEqual(1);
    expect(secondAnalyze.summary.preserved).toBeGreaterThanOrEqual(1);

    const { body: secondEntities } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const produtosAfter = findMapping(secondEntities.entities, 'produtos');
    expect(produtosAfter.status).toBe('APPROVED');
    expect(produtosAfter.approvedEntity).toBe('PRODUTO');
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) can read but is forbidden from analyzing/approving', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorSemanticPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Semantic',
      email: `auditor-semantic-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.65.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { profileId } = await setUpDiscoveredProfile();

    const analyze = await post<ErrorBody>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auditorAuth
    );
    expect(analyze.status).toBe(403);

    // Seed real data with the super-admin, then confirm AUDITOR can read it.
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const entities = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auditorAuth
    );
    expect(entities.status).toBe(200);
    expect(entities.body.total).toBeGreaterThan(0);

    const approve = await post<ErrorBody>(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: 'public', table: 'produtos', decision: 'APPROVE' },
      auditorAuth
    );
    expect(approve.status).toBe(403);
  });
});

describe('audit trail', () => {
  it('records SEMANTIC_MAPPING_ANALYZED, SEMANTIC_MAPPING_APPROVED, and SEMANTIC_MAPPING_REJECTED', async () => {
    const { profileId } = await setUpDiscoveredProfile();
    await post(srv.baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const { body: entitiesBody } = await get<EntitiesBody>(
      srv.baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    const produtos = findMapping(entitiesBody.entities, 'produtos');
    const operadores = findMapping(entitiesBody.entities, 'operadores');
    await post(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: produtos.schema, table: 'produtos', decision: 'APPROVE' },
      auth
    );
    await post(
      srv.baseUrl,
      '/semantic-mapping/approve',
      { profileId, schema: operadores.schema, table: 'operadores', decision: 'REJECT' },
      auth
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    const actions = log.map((e) => e.action);
    expect(actions).toContain('SEMANTIC_MAPPING_ANALYZED');
    expect(actions).toContain('SEMANTIC_MAPPING_APPROVED');
    expect(actions).toContain('SEMANTIC_MAPPING_REJECTED');
  });
});
