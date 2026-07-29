import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  setUpOrgWithApprovedCanonicalModel,
  createGeneratedQuery,
  sendHeartbeat,
  type TestServer,
} from './helpers.js';
import { obtainRuntimeAccessToken } from '../erp-connectivity/helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}
interface ExecutionDTO {
  id: string;
  organizationId: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  totalRows: number | null;
}
interface ExecuteBody {
  execution?: ExecutionDTO;
  error?: unknown;
}
interface GetBody {
  execution: ExecutionDTO;
  result: {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    totalRows: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  } | null;
}
interface RuntimeJobsBody {
  total: number;
  executions: Array<{
    id: string;
    sql: string;
    parameters: Array<{ name: string; value: unknown }>;
  }>;
}
interface RuntimeResultBody {
  execution: ExecutionDTO;
  alreadyReported: boolean;
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
  return `QXE${Date.now().toString(36)}${codeCounter}`;
}

async function setUpReadyOrg() {
  const { organizationId, runtimeId, keyPair } = await setUpOrgWithApprovedCanonicalModel(
    srv.baseUrl,
    auth,
    orgCode()
  );
  await sendHeartbeat(srv.baseUrl, runtimeId, keyPair.privateKeyPem);
  const { generatedQueryId } = await createGeneratedQuery(srv.baseUrl, auth, organizationId);
  const runtimeToken = await obtainRuntimeAccessToken(
    srv.baseUrl,
    runtimeId,
    keyPair.privateKeyPem
  );
  return { organizationId, runtimeId, generatedQueryId, runtimeToken };
}

describe('rejects unauthenticated access', () => {
  it('execute/get/cancel/history all require a Bearer token', async () => {
    expect(
      (
        await post(srv.baseUrl, '/query-execution/execute', {
          organizationId: 'x',
          generatedQueryId: 'y',
        })
      ).status
    ).toBe(401);
    expect((await get(srv.baseUrl, '/query-execution/some-id?organizationId=x')).status).toBe(401);
    expect(
      (await post(srv.baseUrl, '/query-execution/some-id/cancel', { organizationId: 'x' })).status
    ).toBe(401);
    expect((await get(srv.baseUrl, '/query-execution/history?organizationId=x')).status).toBe(401);
  });
});

describe('execução bem-sucedida', () => {
  it('executes end-to-end: QUEUED -> Runtime claims -> reports rows -> COMPLETED', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();

    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    expect(created.status).toBe(201);
    expect(created.body.execution?.status).toBe('QUEUED');

    const claimed = await get<RuntimeJobsBody>(
      srv.baseUrl,
      '/runtime/query-execution/jobs',
      bearer(runtimeToken)
    );
    expect(claimed.body.total).toBe(1);
    expect(claimed.body.executions[0]?.id).toBe(created.body.execution?.id);
    expect(claimed.body.executions[0]?.sql).toContain('SELECT');

    const reported = await post<RuntimeResultBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      {
        executionId: created.body.execution?.id,
        success: true,
        rows: [
          { code: 'ABC', description: 'Produto A' },
          { code: 'DEF', description: 'Produto B' },
        ],
        totalRows: 2,
      },
      bearer(runtimeToken)
    );
    expect(reported.body.execution.status).toBe('COMPLETED');
    expect(reported.body.execution.totalRows).toBe(2);

    const fetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${created.body.execution?.id}?organizationId=${organizationId}`,
      auth
    );
    expect(fetched.body.execution.status).toBe('COMPLETED');
    expect(fetched.body.result?.rows).toHaveLength(2);
    expect(fetched.body.result?.columns).toEqual(['code', 'description']);
  });

  it('rejects executing a generated query that does not exist', async () => {
    const { organizationId } = await setUpReadyOrg();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId: 'does-not-exist' },
      auth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('GENERATED_QUERY_NOT_FOUND');
  });
});

describe('Runtime offline', () => {
  it('rejects dispatching to a Runtime with no recent heartbeat', async () => {
    const { organizationId, runtimeId, keyPair } = await setUpOrgWithApprovedCanonicalModel(
      srv.baseUrl,
      auth,
      orgCode()
    );
    void runtimeId;
    void keyPair;
    const { generatedQueryId } = await createGeneratedQuery(srv.baseUrl, auth, organizationId);

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe('RUNTIME_OFFLINE');
  });
});

describe('retry em falha transitória', () => {
  it('requeues on a transient failure and eventually FAILS after exhausting attempts', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId, maxAttempts: 2 },
      auth
    );
    const id = created.body.execution?.id as string;

    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    const firstReport = await post<RuntimeResultBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: false, error: 'Connection reset', transient: true },
      bearer(runtimeToken)
    );
    expect(firstReport.body.execution.status).toBe('QUEUED');
    expect(firstReport.body.execution.attempts).toBe(1);

    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    const secondReport = await post<RuntimeResultBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: false, error: 'Connection reset', transient: true },
      bearer(runtimeToken)
    );
    expect(secondReport.body.execution.status).toBe('FAILED');
    expect(secondReport.body.execution.attempts).toBe(2);
  });

  it('a permanent (non-transient) failure fails immediately without retrying', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId, maxAttempts: 5 },
      auth
    );
    const id = created.body.execution?.id as string;
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));

    const reported = await post<RuntimeResultBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: false, error: 'Permission denied on table', transient: false },
      bearer(runtimeToken)
    );
    expect(reported.body.execution.status).toBe('FAILED');
    expect(reported.body.execution.attempts).toBe(1);
    expect(reported.body.execution.error).toBe('Permission denied on table');
  });
});

describe('timeout', () => {
  it('marks an execution TIMEOUT if the Runtime never reports back in time', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId, maxAttempts: 1, timeoutMs: 30 },
      auth
    );
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));

    await new Promise((resolve) => setTimeout(resolve, 80));

    const fetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${created.body.execution?.id}?organizationId=${organizationId}`,
      auth
    );
    expect(fetched.body.execution.status).toBe('TIMEOUT');
  });
});

describe('cancelamento', () => {
  it('cancels a queued execution and ignores a late Runtime report for it', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const id = created.body.execution?.id as string;

    const cancelled = await post<ExecuteBody>(
      srv.baseUrl,
      `/query-execution/${id}/cancel`,
      { organizationId },
      auth
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.execution?.status).toBe('CANCELLED');

    // Nothing left to claim — it never reaches the Runtime.
    const claimed = await get<RuntimeJobsBody>(
      srv.baseUrl,
      '/runtime/query-execution/jobs',
      bearer(runtimeToken)
    );
    expect(claimed.body.total).toBe(0);

    // A late report is accepted idempotently but never resurrects the execution.
    const lateReport = await post<RuntimeResultBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: true, rows: [{ code: 'X' }] },
      bearer(runtimeToken)
    );
    expect(lateReport.body.alreadyReported).toBe(true);
    expect(lateReport.body.execution.status).toBe('CANCELLED');
  });

  it('rejects cancelling an already-terminal execution', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const id = created.body.execution?.id as string;
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: true, rows: [] },
      bearer(runtimeToken)
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/query-execution/${id}/cancel`,
      { organizationId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('EXECUTION_ALREADY_TERMINAL');
  });
});

describe('paginação de resultados', () => {
  it('paginates a stored result without re-executing', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const id = created.body.execution?.id as string;
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      {
        executionId: id,
        success: true,
        rows: [1, 2, 3, 4, 5].map((n) => ({ code: `P${n}` })),
        totalRows: 5,
      },
      bearer(runtimeToken)
    );

    const page1 = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${id}?organizationId=${organizationId}&page=1&pageSize=2`,
      auth
    );
    expect(page1.body.result?.rows).toHaveLength(2);
    expect(page1.body.result?.hasMore).toBe(true);

    const page3 = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${id}?organizationId=${organizationId}&page=3&pageSize=2`,
      auth
    );
    expect(page3.body.result?.rows).toHaveLength(1);
    expect(page3.body.result?.hasMore).toBe(false);
  });
});

describe('normalização de tipos', () => {
  it('unwraps tagged $date and $decimal envelopes without losing precision', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const id = created.body.execution?.id as string;
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      {
        executionId: id,
        success: true,
        rows: [
          {
            code: 'ABC',
            salePrice: { $decimal: '199.99' },
            createdAt: { $date: '2026-01-15T00:00:00.000Z' },
            note: null,
          },
        ],
        totalRows: 1,
      },
      bearer(runtimeToken)
    );

    const fetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${id}?organizationId=${organizationId}`,
      auth
    );
    const row = fetched.body.result?.rows[0];
    expect(row?.['salePrice']).toBe('199.99');
    expect(row?.['createdAt']).toBe('2026-01-15T00:00:00.000Z');
    expect(row?.['note']).toBeNull();
  });
});

describe('tratamento de erros do Runtime', () => {
  it('rejects a result report from a Runtime that does not own the execution', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const id = created.body.execution?.id as string;
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));

    const {
      organizationId: otherOrg,
      runtimeId: otherRuntimeId,
      keyPair: otherKeyPair,
    } = await setUpOrgWithApprovedCanonicalModel(srv.baseUrl, auth, orgCode());
    void otherOrg;
    const otherToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      otherRuntimeId,
      otherKeyPair.privateKeyPem
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: id, success: true, rows: [] },
      bearer(otherToken)
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('RUNTIME_MISMATCH');
  });
});

describe('isolamento por tenant', () => {
  it('rejects executing a generated query that belongs to a different organization', async () => {
    const { generatedQueryId } = await setUpReadyOrg();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId: 'a-different-org', generatedQueryId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('GENERATED_QUERY_ORGANIZATION_MISMATCH');
  });

  it('404s fetching an execution while claiming a different organization', async () => {
    const { organizationId, generatedQueryId } = await setUpReadyOrg();
    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );

    const crossOrg = await get<ErrorBody>(
      srv.baseUrl,
      `/query-execution/${created.body.execution?.id}?organizationId=org-b-unrelated`,
      auth
    );
    expect(crossOrg.status).toBe(404);
  });
});

describe('múltiplas execuções simultâneas', () => {
  it('claims and completes two independent executions without cross-contamination', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const first = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const second = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );

    const claimed = await get<RuntimeJobsBody>(
      srv.baseUrl,
      '/runtime/query-execution/jobs',
      bearer(runtimeToken)
    );
    expect(claimed.body.total).toBe(2);

    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: first.body.execution?.id, success: true, rows: [{ code: 'A' }], totalRows: 1 },
      bearer(runtimeToken)
    );
    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: second.body.execution?.id, success: false, error: 'boom', transient: false },
      bearer(runtimeToken)
    );

    const firstFetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${first.body.execution?.id}?organizationId=${organizationId}`,
      auth
    );
    const secondFetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${second.body.execution?.id}?organizationId=${organizationId}`,
      auth
    );
    expect(firstFetched.body.execution.status).toBe('COMPLETED');
    expect(secondFetched.body.execution.status).toBe('FAILED');
  });
});

describe('GET /query-execution/history', () => {
  it('lists every execution for the organization, newest first', async () => {
    const { organizationId, generatedQueryId } = await setUpReadyOrg();
    const first = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const second = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );

    const history = await get<{ total: number; executions: ExecutionDTO[] }>(
      srv.baseUrl,
      `/query-execution/history?organizationId=${organizationId}`,
      auth
    );
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(2);
    expect(history.body.executions[0]?.id).toBe(second.body.execution?.id);
    expect(history.body.executions[1]?.id).toBe(first.body.execution?.id);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) can read but is forbidden from executing/cancelling', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorQXEPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor QXE',
      email: `auditor-qxe-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.69.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { organizationId, generatedQueryId } = await setUpReadyOrg();
    const execute = await post<ErrorBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auditorAuth
    );
    expect(execute.status).toBe(403);

    const created = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    const fetched = await get<GetBody>(
      srv.baseUrl,
      `/query-execution/${created.body.execution?.id}?organizationId=${organizationId}`,
      auditorAuth
    );
    expect(fetched.status).toBe(200);

    const cancel = await post<ErrorBody>(
      srv.baseUrl,
      `/query-execution/${created.body.execution?.id}/cancel`,
      { organizationId },
      auditorAuth
    );
    expect(cancel.status).toBe(403);
  });
});

describe('auditoria', () => {
  it('records QUERY_EXECUTION_REQUESTED, QUERY_EXECUTION_COMPLETED, and QUERY_EXECUTION_CANCELLED', async () => {
    const { organizationId, generatedQueryId, runtimeToken } = await setUpReadyOrg();
    const completed = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    await get(srv.baseUrl, '/runtime/query-execution/jobs', bearer(runtimeToken));
    await post(
      srv.baseUrl,
      '/runtime/query-execution/result',
      { executionId: completed.body.execution?.id, success: true, rows: [], totalRows: 0 },
      bearer(runtimeToken)
    );

    const toCancel = await post<ExecuteBody>(
      srv.baseUrl,
      '/query-execution/execute',
      { organizationId, generatedQueryId },
      auth
    );
    await post(
      srv.baseUrl,
      `/query-execution/${toCancel.body.execution?.id}/cancel`,
      { organizationId },
      auth
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    const actions = log.map((e) => e.action);
    expect(actions).toContain('QUERY_EXECUTION_REQUESTED');
    expect(actions).toContain('QUERY_EXECUTION_COMPLETED');
    expect(actions).toContain('QUERY_EXECUTION_CANCELLED');
  });
});
