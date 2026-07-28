import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  setUpOrgWithApprovedCanonicalModel,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}
interface ValidateBody {
  valid: boolean;
  errors?: Array<{ code: string; message: string }>;
  resolved?: { rootEntity: string };
}
interface PlanBody {
  valid?: boolean;
  errors?: Array<{ code: string }>;
  plan?: {
    id: string;
    organizationId: string;
    canonicalModelId: string;
    canonicalVersion: string;
    rootEntity: string;
  };
}
interface GetPlanBody {
  plan: { id: string; organizationId: string };
}
interface HistoryBody {
  total: number;
  plans: Array<{ id: string }>;
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
  return `UQP${Date.now().toString(36)}${codeCounter}`;
}

describe('rejects unauthenticated access', () => {
  it('plan/validate/get/history all require a Bearer token', async () => {
    expect(
      (await post(srv.baseUrl, '/query-planner/plan', { organizationId: 'x', entity: 'Product' }))
        .status
    ).toBe(401);
    expect(
      (
        await post(srv.baseUrl, '/query-planner/validate', {
          organizationId: 'x',
          entity: 'Product',
        })
      ).status
    ).toBe(401);
    expect((await get(srv.baseUrl, '/query-planner/history?organizationId=x')).status).toBe(401);
    expect((await get(srv.baseUrl, '/query-planner/some-id?organizationId=x')).status).toBe(401);
  });
});

describe('POST /query-planner/validate', () => {
  it('rejects when the organization has no approved canonical model yet', async () => {
    const { status, body } = await post<ValidateBody>(
      srv.baseUrl,
      '/query-planner/validate',
      { organizationId: 'org-with-no-model', entity: 'Product' },
      auth
    );
    expect(status).toBe(422);
    expect(body.valid).toBe(false);
    expect(body.errors?.some((e) => e.code === 'NO_CANONICAL_MODEL')).toBe(true);
  });

  it('resolves a valid intent without persisting a plan', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const { status, body } = await post<ValidateBody>(
      srv.baseUrl,
      '/query-planner/validate',
      { organizationId, entity: 'Product', projections: ['code'] },
      auth
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.resolved?.rootEntity).toBe('PRODUCT');

    const history = await get<HistoryBody>(
      srv.baseUrl,
      `/query-planner/history?organizationId=${organizationId}`,
      auth
    );
    expect(history.body.total).toBe(0); // validate never persists
  });
});

describe('POST /query-planner/plan — criação de planos simples', () => {
  it('creates and persists a plan tied to the org and its current canonical model version', async () => {
    const { organizationId, canonicalModelId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );

    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product', projections: ['code'] },
      auth
    );
    expect(status).toBe(201);
    expect(body.plan?.organizationId).toBe(organizationId);
    expect(body.plan?.canonicalModelId).toBe(canonicalModelId);
    expect(body.plan?.rootEntity).toBe('PRODUCT');
  });

  it('rejects an invalid intent with 422 and validation errors, persisting nothing', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Spaceship' },
      auth
    );
    expect(status).toBe(422);
    expect(body.valid).toBe(false);
    expect(body.errors?.[0]?.code).toBe('ENTITY_NOT_FOUND');
  });
});

describe('GET /query-planner/:id', () => {
  it('fetches a previously created plan', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product', projections: ['code'] },
      auth
    );

    const { status, body } = await get<GetPlanBody>(
      srv.baseUrl,
      `/query-planner/${created.body.plan?.id}?organizationId=${organizationId}`,
      auth
    );
    expect(status).toBe(200);
    expect(body.plan.id).toBe(created.body.plan?.id);
  });
});

describe('isolamento por tenant', () => {
  it('never resolves or returns a plan across organizations', async () => {
    const { organizationId: orgA } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId: orgA, entity: 'Product', projections: ['code'] },
      auth
    );

    // orgB has no canonical model at all — validating against it fails outright.
    const crossOrgValidate = await post<ValidateBody>(
      srv.baseUrl,
      '/query-planner/validate',
      { organizationId: 'org-b-unrelated', entity: 'Product' },
      auth
    );
    expect(crossOrgValidate.status).toBe(422);

    // Fetching orgA's plan while claiming to be a different org 404s instead of leaking it.
    const crossOrgGet = await get<ErrorBody>(
      srv.baseUrl,
      `/query-planner/${created.body.plan?.id}?organizationId=org-b-unrelated`,
      auth
    );
    expect(crossOrgGet.status).toBe(404);

    // Pinning to orgA's real canonicalModelId while claiming orgB is rejected as a mismatch.
    const crossModelPin = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      {
        organizationId: 'org-b-unrelated',
        canonicalModelId: created.body.plan?.canonicalModelId,
        entity: 'Product',
      },
      auth
    );
    expect(crossModelPin.status).toBe(422);
    expect(crossModelPin.body.errors?.[0]?.code).toBe('MODEL_ORGANIZATION_MISMATCH');
  });
});

describe('múltiplas versões do CBM', () => {
  it('can pin a plan to a specific historical canonical model version', async () => {
    const code = orgCode();
    const { organizationId, canonicalModelId: v1Id } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      code
    );

    // Rebuild the canonical model — a new version now exists, but v1 is still resolvable by id.
    const v2 = await post<{ model: { id: string } }>(
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

    const pinnedToV1 = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, canonicalModelId: v1Id, entity: 'Product', projections: ['code'] },
      auth
    );
    expect(pinnedToV1.status).toBe(201);
    expect(pinnedToV1.body.plan?.canonicalModelId).toBe(v1Id);

    const defaultToLatestApproved = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product', projections: ['code'] },
      auth
    );
    expect(defaultToLatestApproved.status).toBe(201);
    expect(defaultToLatestApproved.body.plan?.canonicalModelId).toBe(v2.body.model.id);
  });

  it('rejects a canonicalModelId that does not exist', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, canonicalModelId: 'does-not-exist', entity: 'Product' },
      auth
    );
    expect(status).toBe(422);
    expect(body.errors?.[0]?.code).toBe('UNKNOWN_CANONICAL_VERSION');
  });
});

describe('auditoria e histórico', () => {
  it('records QUERY_PLAN_CREATED and lists plans in the org history, newest first', async () => {
    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    const first = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product', projections: ['code'] },
      auth
    );
    const second = await post<PlanBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product', projections: ['description'] },
      auth
    );

    const history = await get<HistoryBody>(
      srv.baseUrl,
      `/query-planner/history?organizationId=${organizationId}`,
      auth
    );
    expect(history.body.total).toBe(2);
    expect(history.body.plans[0]?.id).toBe(second.body.plan?.id);
    expect(history.body.plans[1]?.id).toBe(first.body.plan?.id);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'QUERY_PLAN_CREATED' && e.target === first.body.plan?.id)
    ).toBe(true);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) can validate/read but is forbidden from creating a plan', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorUQPPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor UQP',
      email: `auditor-uqp-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.67.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { organizationId } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );

    const validate = await post<ValidateBody>(
      srv.baseUrl,
      '/query-planner/validate',
      { organizationId, entity: 'Product' },
      auditorAuth
    );
    expect(validate.status).toBe(200);

    const plan = await post<ErrorBody>(
      srv.baseUrl,
      '/query-planner/plan',
      { organizationId, entity: 'Product' },
      auditorAuth
    );
    expect(plan.status).toBe(403);
  });
});
