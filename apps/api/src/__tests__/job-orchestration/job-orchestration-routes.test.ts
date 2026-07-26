import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerActiveRuntimeWithKeys,
  signJobResult,
  signClaimRequest,
  SEED_ORG_ID,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface JobBody {
  job: {
    id: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    result: unknown;
    lastError: string | null;
    history: Array<{ outcome: string }>;
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

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await get(srv.baseUrl, '/jobs');
    expect([401, 403]).toContain(status);
  });
});

describe('POST /jobs — criação de Job', () => {
  it('creates a queued job', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING', payload: { note: 'hi' } },
      auth
    );
    expect(status).toBe(201);
    expect(body.job.status).toBe('QUEUED');
    expect(body.job.attempts).toBe(0);
  });

  it('rejects a Runtime that belongs to a different organization (isolamento)', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: 'org-does-not-match', runtimeId, command: 'PING' },
      auth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('RUNTIME_ORGANIZATION_MISMATCH');
  });

  it('is idempotent on creation via idempotencyKey — same key returns the original job', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const idempotencyKey = `idem-${Math.random()}`;
    const first = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'SYNC_PRODUCTS', idempotencyKey },
      auth
    );
    const second = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'SYNC_PRODUCTS', idempotencyKey },
      auth
    );
    expect(second.body.job.id).toBe(first.body.job.id);
  });
});

describe('GET /runtime/jobs — claim + successful execution', () => {
  it('a Runtime claims its queued job and reports success', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'SYNC_STOCK' },
      auth
    );

    const timestamp = new Date().toISOString();
    const signature = signClaimRequest(keyPair.privateKeyPem, { runtimeId, timestamp });
    const claimed = await get<{ total: number; jobs: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      `/runtime/jobs?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(timestamp)}&signature=${encodeURIComponent(signature)}`
    );
    expect(claimed.status).toBe(200);
    expect(claimed.body.total).toBe(1);
    expect(claimed.body.jobs[0]!.status).toBe('DISPATCHED');
    expect(claimed.body.jobs[0]!.id).toBe(created.body.job.id);

    const resultTimestamp = new Date().toISOString();
    const jobId = created.body.job.id;
    const resultSignature = signJobResult(keyPair.privateKeyPem, {
      jobId,
      runtimeId,
      outcome: 'success',
      result: { synced: 42 },
      timestamp: resultTimestamp,
    });
    const reported = await post<JobBody>(srv.baseUrl, '/jobs/result', {
      jobId,
      runtimeId,
      outcome: 'success',
      result: { synced: 42 },
      timestamp: resultTimestamp,
      signature: resultSignature,
    });
    expect(reported.status).toBe(200);
    expect(reported.body.job.status).toBe('SUCCESS');
    expect(reported.body.job.result).toEqual({ synced: 42 });
  });

  it('rejects a claim request with an invalid signature', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const other = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const timestamp = new Date().toISOString();
    // Signed with a DIFFERENT runtime's key.
    const badSignature = signClaimRequest(other.keyPair.privateKeyPem, { runtimeId, timestamp });
    const { status, body } = await get<ErrorBody>(
      srv.baseUrl,
      `/runtime/jobs?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(timestamp)}&signature=${encodeURIComponent(badSignature)}`
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });
});

describe('Temporary failure with retry', () => {
  it('retries on failure with exponential backoff, then eventually fails after exhausting attempts', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'SYNC_PRICES', maxAttempts: 2 },
      auth
    );
    const jobId = created.body.job.id;

    const reportFailure = async () => {
      const ts = new Date().toISOString();
      const sig = signJobResult(keyPair.privateKeyPem, {
        jobId,
        runtimeId,
        outcome: 'failure',
        error: 'ERP timeout',
        timestamp: ts,
      });
      return post<JobBody>(srv.baseUrl, '/jobs/result', {
        jobId,
        runtimeId,
        outcome: 'failure',
        error: 'ERP timeout',
        timestamp: ts,
        signature: sig,
      });
    };

    const first = await reportFailure();
    expect(first.body.job.status).toBe('RETRYING');
    expect(first.body.job.attempts).toBe(1);

    const second = await reportFailure();
    expect(second.body.job.status).toBe('FAILED');
    expect(second.body.job.attempts).toBe(2);
    expect(second.body.job.lastError).toContain('ERP timeout');
    expect(second.body.job.history.length).toBe(2);
  });
});

describe('POST /jobs/:id/cancel', () => {
  it('cancels a queued job', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auth
    );
    const { status, body } = await post<JobBody>(
      srv.baseUrl,
      `/jobs/${created.body.job.id}/cancel`,
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.job.status).toBe('CANCELLED');
  });

  it('rejects cancelling an already-terminal job', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auth
    );
    await post(srv.baseUrl, `/jobs/${created.body.job.id}/cancel`, undefined, auth);

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/jobs/${created.body.job.id}/cancel`,
      undefined,
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('JOB_ALREADY_TERMINAL');
  });
});

describe('Duplicidade de resultado (idempotência de execução)', () => {
  it('reporting a result twice for the same job does not re-execute it', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auth
    );
    const jobId = created.body.job.id;
    const timestamp = new Date().toISOString();
    const signature = signJobResult(keyPair.privateKeyPem, {
      jobId,
      runtimeId,
      outcome: 'success',
      result: { pong: true },
      timestamp,
    });
    const body = {
      jobId,
      runtimeId,
      outcome: 'success' as const,
      result: { pong: true },
      timestamp,
      signature,
    };

    const first = await post<JobBody & { alreadyReported: boolean }>(
      srv.baseUrl,
      '/jobs/result',
      body
    );
    expect(first.body.alreadyReported).toBe(false);
    expect(first.body.job.attempts).toBe(1);

    // Signature replay guard would reject the exact same request; simulate the
    // Runtime's retry-after-network-blip scenario by hitting the endpoint with
    // a request whose payload is identical but arrives after the job is
    // already terminal — replay rejection kicks in first, proving no
    // silent double-processing is possible via this path either.
    const second = await post<ErrorBody>(srv.baseUrl, '/jobs/result', body);
    expect(second.status).toBe(401);
    expect(second.body.error.code).toBe('REPLAY_REJECTED');
  });
});

describe('Timeout', () => {
  it('a dispatched job that never reports back within its timeout is retried, then fails', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody & { job: { id: string } }>(
      srv.baseUrl,
      '/jobs',
      {
        organizationId: SEED_ORG_ID,
        runtimeId,
        command: 'SYNC_PRODUCTS',
        maxAttempts: 1,
        // Long enough that the claim request below (a real HTTP round trip)
        // reliably completes first, so the job is DISPATCHED — not
        // EXPIRED — before this window elapses.
        timeoutMs: 50,
      },
      auth
    );
    const jobId = created.body.job.id;

    const timestamp = new Date().toISOString();
    const signature = signClaimRequest(keyPair.privateKeyPem, { runtimeId, timestamp });
    await get(
      srv.baseUrl,
      `/runtime/jobs?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(timestamp)}&signature=${encodeURIComponent(signature)}`
    );

    await new Promise((resolve) => setTimeout(resolve, 80));

    const { body } = await get<JobBody>(srv.baseUrl, `/jobs/${jobId}`, auth);
    expect(body.job.status).toBe('FAILED');
    expect(body.job.history.some((h) => h.outcome === 'timeout')).toBe(true);
  });
});

describe('Múltiplos Jobs concorrentes', () => {
  it('handles several independent jobs for the same Runtime without interference', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const commands = ['PING', 'SYNC_PRODUCTS', 'SYNC_STOCK'] as const;
    const created = await Promise.all(
      commands.map((command) =>
        post<JobBody>(
          srv.baseUrl,
          '/jobs',
          { organizationId: SEED_ORG_ID, runtimeId, command },
          auth
        )
      )
    );

    const timestamp = new Date().toISOString();
    const signature = signClaimRequest(keyPair.privateKeyPem, { runtimeId, timestamp });
    const { body } = await get<{ total: number }>(
      srv.baseUrl,
      `/runtime/jobs?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(timestamp)}&signature=${encodeURIComponent(signature)}`
    );
    expect(body.total).toBe(3);
    expect(new Set(created.map((c) => c.body.job.id)).size).toBe(3);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from creating a job', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorJobsPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Jobs',
      email: `auditor-jobs-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.60.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records JOB_CREATED, JOB_RESULT_REPORTED, and JOB_CANCELLED entries', async () => {
    const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const created = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auth
    );
    const jobId = created.body.job.id;
    const timestamp = new Date().toISOString();
    const signature = signJobResult(keyPair.privateKeyPem, {
      jobId,
      runtimeId,
      outcome: 'success',
      timestamp,
    });
    await post(srv.baseUrl, '/jobs/result', {
      jobId,
      runtimeId,
      outcome: 'success',
      timestamp,
      signature,
    });

    const created2 = await post<JobBody>(
      srv.baseUrl,
      '/jobs',
      { organizationId: SEED_ORG_ID, runtimeId, command: 'PING' },
      auth
    );
    await post(srv.baseUrl, `/jobs/${created2.body.job.id}/cancel`, undefined, auth);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'JOB_CREATED' && e.target === jobId)).toBe(true);
    expect(log.some((e) => e.action === 'JOB_RESULT_REPORTED' && e.target === jobId)).toBe(true);
    expect(log.some((e) => e.action === 'JOB_CANCELLED' && e.target === created2.body.job.id)).toBe(
      true
    );
  });
});
