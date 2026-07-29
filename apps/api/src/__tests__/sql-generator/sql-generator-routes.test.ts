import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  setUpOrgWithApprovedCanonicalModel,
  createQueryPlan,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';
import type { SqlDialect } from '../../modules/sql-generator/types.js';

interface ErrorBody {
  error: { message: string; code: string };
}
interface GenerateBody {
  valid?: boolean;
  errors?: Array<{ code: string }>;
  query?: {
    id: string;
    organizationId: string;
    dialect: SqlDialect;
    sql: string;
    parameters: Array<{ name: string; value: unknown }>;
    canonicalVersion: string;
    estimatedCost: number;
    optimizations: string[];
  };
}
interface ExplainBody {
  valid?: boolean;
  errors?: Array<{ code: string }>;
  sql?: string;
  parameters?: Array<{ name: string; value: unknown }>;
  dialect?: SqlDialect;
  estimatedCost?: number;
  logicalPlan?: {
    entities: Array<{ physicalTable: string; joinCondition?: string }>;
    filterCount: number;
    projectionCount: number;
    optimizations: string[];
  };
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
  return `SQG${Date.now().toString(36)}${codeCounter}`;
}

describe('rejects unauthenticated access', () => {
  it('generate/explain/get all require a Bearer token', async () => {
    expect(
      (
        await post(srv.baseUrl, '/sql-generator/generate', {
          organizationId: 'x',
          queryPlanId: 'y',
        })
      ).status
    ).toBe(401);
    expect(
      (await post(srv.baseUrl, '/sql-generator/explain', { organizationId: 'x', queryPlanId: 'y' }))
        .status
    ).toBe(401);
    expect((await get(srv.baseUrl, '/sql-generator/some-id?organizationId=x')).status).toBe(401);
  });
});

describe('POST /sql-generator/generate — happy path', () => {
  it('generates parameterized SQL, auto-detecting the dialect from the ERP connection (PostgreSQL)', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      filters: [{ field: 'salePrice', operator: 'GT', value: 100 }],
      projections: ['code', 'description'],
    });

    const { status, body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );
    expect(status).toBe(201);
    expect(body.query?.dialect).toBe('POSTGRESQL');
    expect(body.query?.sql).toContain('SELECT');
    expect(body.query?.sql).toContain('$1');
    expect(body.query?.sql).not.toContain('100'); // the literal must never be inlined
    expect(body.query?.parameters).toEqual([{ name: 'p1', value: 100 }]);
    expect(body.query?.canonicalVersion).toBe('1.0.0');
  });

  it('rejects an unknown queryPlanId', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const { status, body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId: 'does-not-exist' },
      auth
    );
    expect(status).toBe(422);
    expect(body.errors?.[0]?.code).toBe('PLAN_NOT_FOUND');
  });
});

describe('7 dialects', () => {
  it.each<SqlDialect>([
    'SQLSERVER',
    'POSTGRESQL',
    'MYSQL',
    'ORACLE',
    'FIREBIRD',
    'MARIADB',
    'SQLITE',
  ])('produces dialect-appropriate SQL for %s via an explicit override', async (dialect) => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      filters: [{ field: 'salePrice', operator: 'GT', value: 100 }],
      projections: ['code'],
    });

    const { status, body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId, dialect },
      auth
    );
    expect(status).toBe(201);
    expect(body.query?.dialect).toBe(dialect);
    expect(body.query?.sql.length).toBeGreaterThan(0);
  });
});

describe('parâmetros e SQL Injection', () => {
  it('never inlines a LIKE literal into the SQL string, even a malicious one', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const malicious = "%'; DROP TABLE produtos; --";
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      filters: [{ field: 'description', operator: 'LIKE', value: malicious }],
    });

    const { body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );
    expect(body.query?.sql).not.toContain('DROP TABLE');
    expect(body.query?.sql).toContain('LIKE');
    expect(body.query?.parameters.some((p) => p.value === malicious)).toBe(true);
  });
});

describe('filtros compostos', () => {
  it('renders a nested AND/OR group as parenthesized SQL', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      filters: [
        {
          logic: 'OR',
          filters: [
            { field: 'salePrice', operator: 'GT', value: 100 },
            { field: 'code', operator: 'EQ', value: 'ABC' },
          ],
        },
      ],
    });

    const { body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );
    expect(body.query?.sql).toMatch(/\(.*OR.*\)/);
    expect(body.query?.parameters).toHaveLength(2);
  });
});

describe('joins', () => {
  it('generates a real INNER JOIN using the discovered foreign key between two physical tables', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'purchaseorderline',
      projections: ['id', 'product.description'],
    });

    const { status, body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );
    expect(status).toBe(201);
    expect(body.query?.sql).toContain('INNER JOIN');
    expect(body.query?.sql).toContain('"produtos"');
    expect(body.query?.sql).toContain('produto_id');
  });
});

describe('paginação e ordenação', () => {
  it('applies dialect pagination syntax and an ORDER BY clause', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      sorting: [{ field: 'salePrice', direction: 'DESC' }],
      pagination: { limit: 10, offset: 20 },
    });

    const { body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId, dialect: 'POSTGRESQL' },
      auth
    );
    expect(body.query?.sql).toContain('ORDER BY');
    expect(body.query?.sql).toContain('DESC');
    expect(body.query?.sql).toContain('LIMIT 10 OFFSET 20');
  });
});

describe('múltiplas versões do CBM', () => {
  it('propagates the canonical version the underlying plan was actually built against', async () => {
    const code = orgCode();
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(srv.baseUrl, auth, code);
    const v1PlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      projections: ['code'],
    });

    const v1Result = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId: v1PlanId },
      auth
    );
    expect(v1Result.body.query?.canonicalVersion).toBe('1.0.0');
  });
});

describe('isolamento por tenant', () => {
  it('rejects generating SQL for a plan that belongs to a different organization', async () => {
    const { organizationId: orgA } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, orgA, {
      entity: 'Product',
      projections: ['code'],
    });

    const { status, body } = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId: 'a-different-org', queryPlanId },
      auth
    );
    expect(status).toBe(422);
    expect(body.errors?.[0]?.code).toBe('PLAN_ORGANIZATION_MISMATCH');
  });

  it('404s fetching a generated query while claiming a different organization', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      projections: ['code'],
    });
    const generated = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );

    const crossOrgGet = await get<ErrorBody>(
      srv.baseUrl,
      `/sql-generator/${generated.body.query?.id}?organizationId=org-b-unrelated`,
      auth
    );
    expect(crossOrgGet.status).toBe(404);

    const sameOrgGet = await get<GenerateBody>(
      srv.baseUrl,
      `/sql-generator/${generated.body.query?.id}?organizationId=${organizationId}`,
      auth
    );
    expect(sameOrgGet.status).toBe(200);
  });
});

describe('otimização', () => {
  it('dedupes redundant filters/projections and reports it in optimizations + POST /explain logicalPlan', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      filters: [
        { field: 'salePrice', operator: 'GT', value: 100 },
        { field: 'salePrice', operator: 'GT', value: 100 },
      ],
      projections: ['code', 'code'],
    });

    const generated = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );
    expect(generated.body.query?.parameters).toHaveLength(1);
    expect(generated.body.query?.optimizations.some((n) => n.includes('duplicate'))).toBe(true);

    const explain = await post<ExplainBody>(
      srv.baseUrl,
      '/sql-generator/explain',
      { organizationId, queryPlanId },
      auth
    );
    expect(explain.status).toBe(200);
    expect(explain.body.logicalPlan?.filterCount).toBe(1);
    expect(explain.body.logicalPlan?.projectionCount).toBe(1);
    expect(explain.body.logicalPlan?.entities[0]?.physicalTable).toBe('produtos');
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) can explain but is forbidden from generating', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorSQLPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor SQL',
      email: `auditor-sql-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.68.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      projections: ['code'],
    });

    const explain = await post<ExplainBody>(
      srv.baseUrl,
      '/sql-generator/explain',
      { organizationId, queryPlanId },
      auditorAuth
    );
    expect(explain.status).toBe(200);

    const generate = await post<ErrorBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auditorAuth
    );
    expect(generate.status).toBe(403);
  });
});

describe('auditoria', () => {
  it('records SQL_QUERY_GENERATED with the plan id and dialect', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const queryPlanId = await createQueryPlan(srv.baseUrl, auth, organizationId, {
      entity: 'Product',
      projections: ['code'],
    });
    const generated = await post<GenerateBody>(
      srv.baseUrl,
      '/sql-generator/generate',
      { organizationId, queryPlanId },
      auth
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'SQL_QUERY_GENERATED' && e.target === generated.body.query?.id)
    ).toBe(true);
  });
});
