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
  type TestServer,
} from './helpers.js';
import { SEED_ORG_ID } from '../job-orchestration/helpers.js';
import { connectorsStore } from '../../modules/connectors/connectors-store.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface PlanBody {
  plan: {
    id: string;
    status: string;
    validation: Record<string, boolean>;
    driverVersion: string;
    metrics: { failureCount: number; retries: number; successRate: number };
    circuitState: string;
    resultData: unknown;
    [key: string]: unknown;
  };
}

let srv: TestServer;
let auth: Record<string, string>;
let activeConnectorId: string;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);

  const connector = connectorsStore.getConnectorByIdentifier('postgresql')!;
  connectorsStore.setConnectorStatus(connector.id, 'active');
  activeConnectorId = connector.id;
});

afterAll(async () => {
  await srv.close();
});

async function setUpRuntimeAndProfile() {
  const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
  const profileId = await createConnectionProfile(srv.baseUrl, auth, {
    runtimeId,
    organizationId: SEED_ORG_ID,
  });
  return { runtimeId, keyPair, profileId };
}

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await post(srv.baseUrl, '/runtime/connectors/execute', {});
    expect([401, 403]).toContain(status);
  });
});

describe('POST /runtime/connectors/execute — Query Planner + Execution Validator', () => {
  it('plans and queues a valid execution', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(status).toBe(201);
    expect(body.plan.status).toBe('QUEUED');
    expect(body.plan.validation['runtimeAuthorized']).toBe(true);
    expect(body.plan.validation['connectorActive']).toBe(true);
    expect(body.plan.validation['minVersionOk']).toBe(true);
    expect(body.plan.driverVersion).toBe('PostgreSQL 16');
  });

  it('rejects (validation) when the connector is not active', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const betaConnector = connectorsStore.createConnector({
      identifier: `beta-connector-${Math.random()}`,
      name: 'Beta Connector',
      category: 'DATABASE',
      vendor: 'Test',
      description: 'Not yet active',
      minRuntimeVersion: '1.0.0',
    });
    if (typeof betaConnector === 'string') throw new Error('unexpected identifier collision');

    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: betaConnector.id,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(status).toBe(422);
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['connectorActive']).toBe(false);
  });

  it('rejects missing required fields', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      { runtimeId: 'x' },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a Runtime belonging to a different organization (isolamento)', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: 'org-does-not-match',
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('RUNTIME_ORGANIZATION_MISMATCH');
  });

  it('rejects a profile that belongs to a different Runtime', async () => {
    const { runtimeId } = await setUpRuntimeAndProfile();
    const other = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId: other.profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('PROFILE_RUNTIME_MISMATCH');
  });
});

describe('GET /runtime/connectors/jobs — claim via JWT (reutilização Sprint 46.7)', () => {
  it('a Runtime claims its queued execution using its JWT session', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );

    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const claimed = await get<{ total: number; plans: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      '/runtime/connectors/jobs',
      bearer(accessToken)
    );
    expect(claimed.status).toBe(200);
    expect(claimed.body.total).toBe(1);
    expect(claimed.body.plans[0]!.id).toBe(created.body.plan.id);
    expect(claimed.body.plans[0]!.status).toBe('CLAIMED');
  });

  it('rejects a request without a valid Runtime JWT', async () => {
    const { status } = await get(srv.baseUrl, '/runtime/connectors/jobs');
    expect(status).toBe(401);
  });
});

describe('POST /runtime/connectors/result — Result Normalizer', () => {
  const claimAndGetToken = async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));
    return { executionId: created.body.plan.id, runtimeId, accessToken };
  };

  it('normalizes a successful result with rows to SUCCESS', async () => {
    const { executionId, runtimeId, accessToken } = await claimAndGetToken();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 42, data: { products: [] } },
      bearer(accessToken)
    );
    expect(body.plan.status).toBe('SUCCESS');
  });

  it('normalizes a successful result with zero rows to EMPTY', async () => {
    const { executionId, runtimeId, accessToken } = await claimAndGetToken();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 0 },
      bearer(accessToken)
    );
    expect(body.plan.status).toBe('EMPTY');
  });

  it('normalizes a partial result to PARTIAL', async () => {
    const { executionId, runtimeId, accessToken } = await claimAndGetToken();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 10, partial: true },
      bearer(accessToken)
    );
    expect(body.plan.status).toBe('PARTIAL');
  });

  it('normalizes an unauthorized outcome to UNAUTHORIZED', async () => {
    const { executionId, runtimeId, accessToken } = await claimAndGetToken();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: false, unauthorized: true },
      bearer(accessToken)
    );
    expect(body.plan.status).toBe('UNAUTHORIZED');
  });

  it('retries a failure with exponential backoff, then eventually FAILS after exhausting attempts', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
        maxAttempts: 2,
      },
      auth
    );
    const executionId = created.body.plan.id;
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));

    const first = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: false, error: 'ERP timeout' },
      bearer(accessToken)
    );
    expect(first.body.plan.status).toBe('QUEUED');
    expect(first.body.plan.metrics.retries).toBe(1);

    const second = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: false, error: 'ERP timeout' },
      bearer(accessToken)
    );
    expect(second.body.plan.status).toBe('FAILED');
    expect(second.body.plan.metrics.failureCount).toBe(2);
  });

  it('reporting a result twice for an already-terminal execution is a silent no-op', async () => {
    const { executionId, runtimeId, accessToken } = await claimAndGetToken();
    const body = { executionId, runtimeId, success: true, rowCount: 1 };
    const first = await post<PlanBody & { alreadyReported: boolean }>(
      srv.baseUrl,
      '/runtime/connectors/result',
      body,
      bearer(accessToken)
    );
    expect(first.body.alreadyReported).toBe(false);

    const second = await post<PlanBody & { alreadyReported: boolean }>(
      srv.baseUrl,
      '/runtime/connectors/result',
      body,
      bearer(accessToken)
    );
    expect(second.body.alreadyReported).toBe(true);
    expect(second.body.plan.status).toBe('SUCCESS');
  });
});

describe('Circuit breaker (reutilização packages/titan)', () => {
  it('opens after repeated failures for the same connector+profile and blocks further claims', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();

    for (let i = 0; i < 5; i++) {
      const created = await post<PlanBody>(
        srv.baseUrl,
        '/runtime/connectors/execute',
        {
          runtimeId,
          organizationId: SEED_ORG_ID,
          connectorId: activeConnectorId,
          profileId,
          action: 'READ_PRODUCTS',
          maxAttempts: 1,
        },
        auth
      );
      const accessToken = await obtainRuntimeAccessToken(
        srv.baseUrl,
        runtimeId,
        keyPair.privateKeyPem
      );
      await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));
      await post(
        srv.baseUrl,
        '/runtime/connectors/result',
        { executionId: created.body.plan.id, runtimeId, success: false, error: 'ECONNRESET' },
        bearer(accessToken)
      );
    }

    const blockedPlan = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const claimed = await get<{ plans: Array<{ id: string }> }>(
      srv.baseUrl,
      '/runtime/connectors/jobs',
      bearer(accessToken)
    );
    expect(claimed.body.plans.some((p) => p.id === blockedPlan.body.plan.id)).toBe(false);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from requesting a connector execution', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorExecPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Exec',
      email: `auditor-exec-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.63.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records EXECUTION_PLANNED and EXECUTION_RESULT_REPORTED entries', async () => {
    const { executionId, runtimeId, accessToken } = await (async () => {
      const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
      const created = await post<PlanBody>(
        srv.baseUrl,
        '/runtime/connectors/execute',
        {
          runtimeId,
          organizationId: SEED_ORG_ID,
          connectorId: activeConnectorId,
          profileId,
          action: 'READ_PRODUCTS',
        },
        auth
      );
      const accessToken = await obtainRuntimeAccessToken(
        srv.baseUrl,
        runtimeId,
        keyPair.privateKeyPem
      );
      await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));
      return { executionId: created.body.plan.id, runtimeId, accessToken };
    })();

    await post(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 3 },
      bearer(accessToken)
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'EXECUTION_PLANNED' && e.target === executionId)).toBe(
      true
    );
    expect(
      log.some((e) => e.action === 'EXECUTION_RESULT_REPORTED' && e.target === executionId)
    ).toBe(true);
  });
});

// ─── Sprint 46.10 — PRICE_MARKDOWN: the first real command end-to-end ────────

describe('PRICE_MARKDOWN — primeiro comando real (Sprint 46.10)', () => {
  it('rejects a PRICE_MARKDOWN request with an invalid payload (missing productId/newPrice)', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '12345' }, // missing newPrice
      },
      auth
    );
    expect(status).toBe(422);
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['payloadValid']).toBe(false);
  });

  it('rejects a PRICE_MARKDOWN request with a non-positive newPrice', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '12345', newPrice: -1 },
      },
      auth
    );
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['payloadValid']).toBe(false);
  });

  it('runs the full Seltriva → Atlas → Runtime → ERP → Atlas cycle for a valid PRICE_MARKDOWN', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();

    // Seltriva → Atlas Control Plane: solicitação de ação.
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '12345', newPrice: 9.9, previousPrice: 19.9 },
      },
      auth
    );
    expect(created.status).toBe(201);
    expect(created.body.plan.status).toBe('QUEUED');
    expect(created.body.plan.validation['payloadValid']).toBe(true);
    const executionId = created.body.plan.id;

    // Atlas Control Plane → Atlas Runtime: comando autorizado, entregue via
    // a mesma sessão JWT reutilizada da Sprint 46.7.
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const claimed = await get<{ plans: Array<{ id: string; action: string; payload: unknown }> }>(
      srv.baseUrl,
      '/runtime/connectors/jobs',
      bearer(accessToken)
    );
    const claimedPlan = claimed.body.plans.find((p) => p.id === executionId);
    expect(claimedPlan?.action).toBe('PRICE_MARKDOWN');
    expect(claimedPlan?.payload).toEqual({
      productId: '12345',
      newPrice: 9.9,
      previousPrice: 19.9,
    });

    // Atlas Runtime → ERP do cliente → Atlas Control Plane: resultado.
    const reported = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      {
        executionId,
        runtimeId,
        success: true,
        rowCount: 1,
        erpReference: 'ABC123',
        data: { productId: '12345', newPrice: 9.9 },
      },
      bearer(accessToken)
    );
    expect(reported.body.plan.status).toBe('SUCCESS');
    expect(reported.body.plan['erpReference']).toBe('ABC123');

    // Atlas Control Plane → Seltriva: auditoria completa do ciclo.
    const finalView = await get<PlanBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}`,
      auth
    );
    expect(finalView.body.plan.status).toBe('SUCCESS');
    expect(finalView.body.plan['erpReference']).toBe('ABC123');

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some(
        (e) =>
          e.action === 'EXECUTION_PLANNED' &&
          e.target === executionId &&
          (e.metadata as Record<string, unknown> | undefined)?.['connectorAction'] ===
            'PRICE_MARKDOWN'
      )
    ).toBe(true);
    expect(
      log.some((e) => e.action === 'EXECUTION_RESULT_REPORTED' && e.target === executionId)
    ).toBe(true);
  });

  it('does not impose payload validation on other (non-PRICE_MARKDOWN) actions', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(body.plan.status).toBe('QUEUED');
    expect(body.plan.validation['payloadValid']).toBe(true);
  });
});

// ─── Sprint 46.11 — ERP Command Reliability & Production Readiness ──────────

describe('Command Idempotency', () => {
  it('a repeated request with the same idempotencyKey returns the original plan, not a duplicate', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const idempotencyKey = `markdown-${Math.random()}`;
    const body = {
      runtimeId,
      organizationId: SEED_ORG_ID,
      connectorId: activeConnectorId,
      profileId,
      action: 'PRICE_MARKDOWN',
      payload: { productId: '999', newPrice: 5, previousPrice: 10 },
      idempotencyKey,
    };

    const first = await post<PlanBody>(srv.baseUrl, '/runtime/connectors/execute', body, auth);
    const second = await post<PlanBody>(srv.baseUrl, '/runtime/connectors/execute', body, auth);
    expect(second.body.plan.id).toBe(first.body.plan.id);

    const { body: listBody } = await get<{ total: number }>(
      srv.baseUrl,
      `/runtime/connectors/executions?runtimeId=${runtimeId}`,
      auth
    );
    expect(listBody.total).toBe(1);
  });
});

describe('ERP Execution Policies', () => {
  it('rejects a PRICE_MARKDOWN payload that tries to touch a field outside its policy (e.g. cost)', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '12345', newPrice: 9.9, previousPrice: 19.9, cost: 3.5 },
      },
      auth
    );
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['policyCompliant']).toBe(false);
  });

  it('rejects an attempt to smuggle a stock/delete flag into a PRICE_MARKDOWN payload', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '12345', newPrice: 9.9, previousPrice: 19.9, deleteProduct: true },
      },
      auth
    );
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['policyCompliant']).toBe(false);
  });
});

describe('Runtime Deployment Validation', () => {
  it('rejects an execution when the Runtime version is below the connector minRuntimeVersion', async () => {
    const strictConnector = connectorsStore.createConnector({
      identifier: `strict-connector-${Math.random()}`,
      name: 'Strict Connector',
      category: 'DATABASE',
      vendor: 'Test',
      description: 'Requires a newer Runtime than what is registered',
      minRuntimeVersion: '9.0.0',
    });
    if (typeof strictConnector === 'string') throw new Error('unexpected identifier collision');
    connectorsStore.setConnectorStatus(strictConnector.id, 'active');

    const { runtimeId, profileId } = await setUpRuntimeAndProfile(); // registers at the default 1.2.0
    const { body } = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: strictConnector.id,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    expect(body.plan.status).toBe('REJECTED');
    expect(body.plan.validation['minVersionOk']).toBe(false);
  });
});

describe('Rollback de comando', () => {
  const applyMarkdown = async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '555', newPrice: 14.9, previousPrice: 19.9 },
      },
      auth
    );
    const executionId = created.body.plan.id;
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));
    await post(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 1, erpReference: 'MKD-001' },
      bearer(accessToken)
    );
    return { executionId, runtimeId, keyPair };
  };

  it('R$19,90 → R$14,90 markdown rolls back to R$19,90 → R$14,90 reversed payload', async () => {
    const { executionId } = await applyMarkdown();

    const rollback = await post<PlanBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}/rollback`,
      undefined,
      auth
    );
    expect(rollback.status).toBe(201);
    expect(rollback.body.plan.action).toBe('PRICE_MARKDOWN');
    expect(rollback.body.plan.payload).toEqual({
      productId: '555',
      newPrice: 19.9,
      previousPrice: 14.9,
    });
    expect(rollback.body.plan['rollbackOfExecutionId']).toBe(executionId);

    const originalView = await get<PlanBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}`,
      auth
    );
    expect(originalView.body.plan['rolledBackByExecutionId']).toBe(rollback.body.plan.id);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'EXECUTION_ROLLED_BACK' && e.target === executionId)).toBe(
      true
    );
  });

  it('rejects rolling back the same execution twice', async () => {
    const { executionId } = await applyMarkdown();
    await post(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}/rollback`,
      undefined,
      auth
    );
    const second = await post<ErrorBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}/rollback`,
      undefined,
      auth
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_ROLLED_BACK');
  });

  it('rejects rolling back an execution that never completed successfully', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: '777', newPrice: 4.9, previousPrice: 9.9 },
      },
      auth
    );
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${created.body.plan.id}/rollback`,
      undefined,
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('EXECUTION_NOT_TERMINAL_SUCCESS');
  });

  it('rejects rolling back an action with no defined rollback behavior', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'READ_PRODUCTS',
      },
      auth
    );
    const executionId = created.body.plan.id;
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    await get(srv.baseUrl, '/runtime/connectors/jobs', bearer(accessToken));
    await post(
      srv.baseUrl,
      '/runtime/connectors/result',
      { executionId, runtimeId, success: true, rowCount: 3 },
      bearer(accessToken)
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/runtime/connectors/executions/${executionId}/rollback`,
      undefined,
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('ACTION_NOT_REVERSIBLE');
  });
});

describe('Primeiro cenário Pais e Filhos (Sprint 46.11)', () => {
  it('prepares a store Runtime + SIS RP connection profile and runs a controlled PRICE_MARKDOWN end-to-end', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const profileCreated = await post<{ profile: { id: string; erpName: string | null } }>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        name: 'Pais e Filhos - Loja 001',
        erpName: 'SIS RP',
        dbType: 'FIREBIRD',
        host: 'sisrp.paisefilhos.local',
        port: 3050,
        database: 'SISRP_LOJA001',
        username: 'sisrp_atlas',
        password: 'S3nhaLoja001!',
      },
      auth
    );
    expect(profileCreated.status).toBe(201);
    expect(profileCreated.body.profile.erpName).toBe('SIS RP');
    const profileId = profileCreated.body.profile.id;

    const created = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/execute',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        connectorId: activeConnectorId,
        profileId,
        action: 'PRICE_MARKDOWN',
        payload: { productId: 'SKU-001', newPrice: 14.9, previousPrice: 19.9 },
        idempotencyKey: 'pais-e-filhos-loja001-sku001-markdown',
      },
      auth
    );
    expect(created.status).toBe(201);
    expect(created.body.plan.status).toBe('QUEUED');

    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const claimed = await get<{ plans: Array<{ id: string }> }>(
      srv.baseUrl,
      '/runtime/connectors/jobs',
      bearer(accessToken)
    );
    expect(claimed.body.plans.some((p) => p.id === created.body.plan.id)).toBe(true);

    const reported = await post<PlanBody>(
      srv.baseUrl,
      '/runtime/connectors/result',
      {
        executionId: created.body.plan.id,
        runtimeId,
        success: true,
        rowCount: 1,
        erpReference: 'SISRP-TXN-0001',
      },
      bearer(accessToken)
    );
    expect(reported.body.plan.status).toBe('SUCCESS');
    expect(reported.body.plan['erpReference']).toBe('SISRP-TXN-0001');
  });
});
