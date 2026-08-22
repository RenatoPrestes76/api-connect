import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerOrganization,
  connectAndApproveErp,
  setUpFullyApprovedProfile,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface SerializedEntity {
  id: string;
  cblTerm: string;
  entityKind: string;
  sourceName: string;
  fields: Array<{ cblTerm: string; fieldKind: string; sourceName: string; mappingStatus: string }>;
}

interface ModelBody {
  model: {
    id: string;
    name: string;
    version: string;
    statistics: { totalEntities: number; mappedEntities: number };
    entities: SerializedEntity[];
  };
}

interface BuildBody extends ModelBody {
  profilesConsidered: number;
  profilesContributing: number;
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

let codeCounter = 0;
function orgCode(): string {
  codeCounter += 1;
  return `CBM${Date.now().toString(36)}${codeCounter}`;
}

describe('rejects unauthenticated access', () => {
  it('build/get/entities/fields/approve/rollback all require a Bearer token', async () => {
    expect(
      (await post(srv.baseUrl, '/canonical-model/build', { organizationId: 'x' })).status
    ).toBe(401);
    expect((await get(srv.baseUrl, '/canonical-model/org-x')).status).toBe(401);
    expect((await get(srv.baseUrl, '/canonical-model/entities?organizationId=x')).status).toBe(401);
    expect((await get(srv.baseUrl, '/canonical-model/fields?organizationId=x')).status).toBe(401);
    expect(
      (await post(srv.baseUrl, '/canonical-model/approve', { organizationId: 'x', modelId: 'y' }))
        .status
    ).toBe(401);
    expect(
      (
        await post(srv.baseUrl, '/canonical-model/rollback', {
          organizationId: 'x',
          targetModelId: 'y',
        })
      ).status
    ).toBe(401);
  });
});

describe('POST /canonical-model/build — criação automática do modelo', () => {
  it('rejects building for an organization with no approved mappings', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId: 'no-such-org' },
      auth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NO_APPROVED_MAPPINGS');
  });

  it('translates approved business mappings into canonical CBL entities/fields', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());

    const { status, body } = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    expect(status).toBe(201);
    expect(body.profilesContributing).toBe(1);
    expect(body.model.name).toBe(organizationId);
    expect(body.model.version).toBe('1.0.0');
    expect(body.model.statistics.totalEntities).toBeGreaterThan(0);
    expect(body.model.statistics.mappedEntities).toBe(body.model.statistics.totalEntities);

    const product = body.model.entities.find((e) => e.entityKind === 'PRODUCT');
    expect(product).toBeTruthy();
    expect(product?.cblTerm).toBe('ENTITY_PRODUCT');
    const descriptionField = product?.fields.find((f) => f.sourceName === 'descricao');
    expect(descriptionField?.fieldKind).toBe('DESCRIPTION');

    const purchaseLine = body.model.entities.find((e) => e.entityKind === 'PURCHASE_ORDER_LINE');
    expect(purchaseLine).toBeTruthy();
    const brand = body.model.entities.find((e) => e.entityKind === 'BRAND');
    expect(brand).toBeTruthy();
  });
});

describe('Sprint 46.11 — the 5 new business entities cross the canonical model', () => {
  it('carries VARIANTE_PRODUTO, DEPOSITO, PAGAMENTO, FUNCIONARIO, and LOTE end-to-end: fixture -> ATHENA -> semantic mapping -> approval -> canonical translation -> CBL entity', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());

    const { body } = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );

    const byKind = (kind: string) => body.model.entities.filter((e) => e.entityKind === kind);

    const variant = byKind('PRODUCT_VARIANT');
    expect(variant).toHaveLength(1);
    expect(variant[0]?.sourceName).toMatch(/produto_variacoes/);
    expect(variant[0]?.cblTerm).toBe('ENTITY_PRODUCT_VARIANT');

    const warehouse = byKind('WAREHOUSE');
    expect(warehouse).toHaveLength(1);
    expect(warehouse[0]?.sourceName).toMatch(/depositos/);

    const payment = byKind('PAYMENT');
    expect(payment).toHaveLength(1);
    expect(payment[0]?.sourceName).toMatch(/pagamentos/);

    const lot = byKind('INVENTORY_LOT');
    expect(lot).toHaveLength(1);
    expect(lot[0]?.sourceName).toMatch(/lotes/);

    // FUNCIONARIO converges onto EMPLOYEE alongside OPERADOR — both must be
    // present as distinct CBMEntity instances (one per source table), never
    // collapsed into a single record.
    const employees = byKind('EMPLOYEE');
    const employeeSourceTables = employees.map((e) => e.sourceName);
    expect(employeeSourceTables.some((s) => s.includes('funcionarios'))).toBe(true);
    expect(employeeSourceTables.some((s) => s.includes('operadores'))).toBe(true);
    expect(new Set(employeeSourceTables).size).toBe(employeeSourceTables.length);
  });

  it('VARIANTE_PRODUTO, DEPOSITO, and LOTE never collapse into PRODUTO, FILIAL/ESTOQUE, or ESTOQUE', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const { body } = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );

    const productVariantEntity = body.model.entities.find((e) =>
      e.sourceName.includes('produto_variacoes')
    );
    expect(productVariantEntity?.entityKind).toBe('PRODUCT_VARIANT');
    expect(productVariantEntity?.entityKind).not.toBe('PRODUCT');

    const warehouseEntity = body.model.entities.find((e) => e.sourceName.includes('depositos'));
    expect(warehouseEntity?.entityKind).toBe('WAREHOUSE');
    expect(warehouseEntity?.entityKind).not.toBe('BRANCH');
    expect(warehouseEntity?.entityKind).not.toBe('INVENTORY');

    const lotEntity = body.model.entities.find((e) => e.sourceName.includes('lotes'));
    expect(lotEntity?.entityKind).toBe('INVENTORY_LOT');
    expect(lotEntity?.entityKind).not.toBe('INVENTORY');
    expect(lotEntity?.entityKind).not.toBe('PRODUCT');
  });
});

describe('atualização incremental', () => {
  it('rebuilding produces a new version reflecting the current approved state', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const first = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    const firstCount = first.body.model.statistics.totalEntities;

    const second = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    expect(second.status).toBe(201);
    expect(second.body.model.id).not.toBe(first.body.model.id);
    expect(second.body.model.statistics.totalEntities).toBe(firstCount);
  });
});

describe('múltiplos ERPs', () => {
  it('aggregates approved mappings from every connected ERP profile into one organization model', async () => {
    const code = orgCode();
    const { organizationId } = await registerOrganization(srv.baseUrl, code);
    await connectAndApproveErp(srv.baseUrl, auth, code);
    await connectAndApproveErp(srv.baseUrl, auth, code);

    const { body } = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    expect(body.profilesConsidered).toBe(2);
    expect(body.profilesContributing).toBe(2);

    const productEntities = body.model.entities.filter((e) => e.entityKind === 'PRODUCT');
    expect(productEntities).toHaveLength(2);
    // Each ERP's product table remains a distinct entity instance, not merged.
    expect(new Set(productEntities.map((e) => e.sourceName)).size).toBe(2);
  });
});

describe('isolamento por tenant', () => {
  it("never includes another organization's tables", async () => {
    const { organizationId: orgA } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const orgB = 'org-without-any-data';

    const buildA = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId: orgA },
      auth
    );
    expect(buildA.status).toBe(201);

    const buildB = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId: orgB },
      auth
    );
    expect(buildB.status).toBe(404); // orgB has no profiles/approved mappings of its own

    const getA = await get<ModelBody>(srv.baseUrl, `/canonical-model/${orgA}?status=latest`, auth);
    expect(getA.body.model.name).toBe(orgA);
  });
});

describe('aprovação manual', () => {
  it('GET defaults to the approved model, not just the latest draft', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const built = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );

    const beforeApproval = await get<ErrorBody>(
      srv.baseUrl,
      `/canonical-model/${organizationId}`,
      auth
    );
    expect(beforeApproval.status).toBe(404);

    const approve = await post<ModelBody>(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId, modelId: built.body.model.id },
      auth
    );
    expect(approve.status).toBe(200);
    expect(approve.body.model.id).toBe(built.body.model.id);

    const afterApproval = await get<ModelBody>(
      srv.baseUrl,
      `/canonical-model/${organizationId}`,
      auth
    );
    expect(afterApproval.status).toBe(200);
    expect(afterApproval.body.model.id).toBe(built.body.model.id);
  });

  it('rejects approving a model that belongs to a different organization', async () => {
    const { organizationId: orgA } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const built = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId: orgA },
      auth
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId: 'a-different-org', modelId: built.body.model.id },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('MODEL_ORGANIZATION_MISMATCH');
  });
});

describe('rollback e versionamento', () => {
  it('restores an older version as the new latest, preserving history and reporting a diff', async () => {
    const code = orgCode();
    const { organizationId } = await registerOrganization(srv.baseUrl, code);
    await connectAndApproveErp(srv.baseUrl, auth, code);
    const v1 = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    await post(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId, modelId: v1.body.model.id },
      auth
    );

    // Add a second ERP and rebuild — this changes the model's entity set.
    await connectAndApproveErp(srv.baseUrl, auth, code);
    const v2 = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    await post(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId, modelId: v2.body.model.id },
      auth
    );
    expect(v2.body.model.statistics.totalEntities).toBeGreaterThan(
      v1.body.model.statistics.totalEntities
    );

    const rollback = await post<{
      model: ModelBody['model'];
      diff: { hasChanges: boolean; removedEntities: unknown[] };
    }>(
      srv.baseUrl,
      '/canonical-model/rollback',
      { organizationId, targetModelId: v1.body.model.id },
      auth
    );
    expect(rollback.status).toBe(200);
    expect(rollback.body.model.statistics.totalEntities).toBe(
      v1.body.model.statistics.totalEntities
    );
    expect(rollback.body.diff.hasChanges).toBe(true);
    expect(rollback.body.diff.removedEntities.length).toBeGreaterThan(0);

    // The rollback target is immediately re-approved.
    const current = await get<ModelBody>(srv.baseUrl, `/canonical-model/${organizationId}`, auth);
    expect(current.body.model.id).toBe(rollback.body.model.id);

    // Full version history is preserved — nothing destroyed.
    const history = await get<{ total: number; versions: Array<{ id: string }> }>(
      srv.baseUrl,
      `/canonical-model/${organizationId}/history`,
      auth
    );
    expect(history.body.total).toBe(3); // v1, v2, and the rolled-back copy
    expect(history.body.versions.map((v) => v.id)).toContain(v1.body.model.id);
    expect(history.body.versions.map((v) => v.id)).toContain(v2.body.model.id);
  });

  it('rejects rolling back to a model from a different organization', async () => {
    const { organizationId: orgA } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const built = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId: orgA },
      auth
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/rollback',
      { organizationId: 'a-different-org', targetModelId: built.body.model.id },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('MODEL_ORGANIZATION_MISMATCH');
  });
});

describe('GET /canonical-model/entities and /fields', () => {
  it('flattens entities and fields for the latest model', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    await post(srv.baseUrl, '/canonical-model/build', { organizationId }, auth);

    const entities = await get<{ total: number; entities: SerializedEntity[] }>(
      srv.baseUrl,
      `/canonical-model/entities?organizationId=${organizationId}&status=latest`,
      auth
    );
    expect(entities.status).toBe(200);
    expect(entities.body.total).toBeGreaterThan(0);

    const productEntity = entities.body.entities.find((e) => e.entityKind === 'PRODUCT');
    const fields = await get<{ total: number; fields: Array<{ entityId: string }> }>(
      srv.baseUrl,
      `/canonical-model/fields?organizationId=${organizationId}&status=latest&entityId=${productEntity?.id}`,
      auth
    );
    expect(fields.status).toBe(200);
    expect(fields.body.total).toBeGreaterThan(0);
    expect(fields.body.fields.every((f) => f.entityId === productEntity?.id)).toBe(true);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) can read but is forbidden from building/approving/rolling back', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorCanonicalPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Canonical',
      email: `auditor-canonical-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.66.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());

    const build = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auditorAuth
    );
    expect(build.status).toBe(403);

    await post(srv.baseUrl, '/canonical-model/build', { organizationId }, auth);

    const entities = await get(
      srv.baseUrl,
      `/canonical-model/entities?organizationId=${organizationId}&status=latest`,
      auditorAuth
    );
    expect(entities.status).toBe(200);

    const approve = await post<ErrorBody>(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId, modelId: 'whatever' },
      auditorAuth
    );
    expect(approve.status).toBe(403);
  });
});

describe('audit trail', () => {
  it('records CANONICAL_MODEL_BUILT, CANONICAL_MODEL_APPROVED, and CANONICAL_MODEL_ROLLED_BACK', async () => {
    const { organizationId } = await setUpFullyApprovedProfile(srv.baseUrl, auth, orgCode());
    const built = await post<BuildBody>(
      srv.baseUrl,
      '/canonical-model/build',
      { organizationId },
      auth
    );
    await post(
      srv.baseUrl,
      '/canonical-model/approve',
      { organizationId, modelId: built.body.model.id },
      auth
    );
    await post(srv.baseUrl, '/canonical-model/build', { organizationId }, auth);
    await post(
      srv.baseUrl,
      '/canonical-model/rollback',
      { organizationId, targetModelId: built.body.model.id },
      auth
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    const actions = log.map((e) => e.action);
    expect(actions).toContain('CANONICAL_MODEL_BUILT');
    expect(actions).toContain('CANONICAL_MODEL_APPROVED');
    expect(actions).toContain('CANONICAL_MODEL_ROLLED_BACK');
  });
});
