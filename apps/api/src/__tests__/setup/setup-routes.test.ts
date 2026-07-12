import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post } from './helpers.js';
import type { TestServer } from './helpers.js';

describe('Setup Wizard API — Sprint 38 ORION', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  // ─── Helper ─────────────────────────────────────────────────────────────────

  async function startSession(): Promise<string> {
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/start');
    return body.sessionId;
  }

  async function fullSetup(sid: string, overrides: Record<string, any> = {}) {
    await post(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: overrides.name ?? 'TestCo',
      domain: overrides.domain ?? 'testco.com',
      plan: overrides.plan ?? 'enterprise',
    });
    await post(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      name: 'Admin',
      email: 'admin@testco.com',
      password: 'S3cur3P@ss!',
    });
    await post(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'postgresql',
      host: 'pg.testco.com',
    });
  }

  // ─── POST /setup/start ──────────────────────────────────────────────────────

  it('POST /setup/start creates session and returns sessionId + token', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/start');
    expect(status).toBe(201);
    expect(body.sessionId).toBeTruthy();
    expect(body.token).toBeTruthy();
    expect(body.expiresAt).toBeTruthy();
    expect(body.currentStep).toBe('company');
  });

  it('POST /setup/start generates a unique session on each call', async () => {
    const r1 = await post<any>(server.baseUrl, '/api/v1/setup/start');
    const r2 = await post<any>(server.baseUrl, '/api/v1/setup/start');
    expect(r1.body.sessionId).not.toBe(r2.body.sessionId);
    expect(r1.body.token).not.toBe(r2.body.token);
  });

  // ─── POST /setup/company ────────────────────────────────────────────────────

  it('POST /setup/company updates company data and advances to admin step', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: 'Acme Corp',
      domain: 'acme.com',
      plan: 'enterprise',
    });
    expect(status).toBe(200);
    expect(body.currentStep).toBe('admin');
    expect(body.company.name).toBe('Acme Corp');
    expect(body.company.domain).toBe('acme.com');
    expect(body.workspace).toBeTruthy();
  });

  it('POST /setup/company 400 if name is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      domain: 'x.com',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('POST /setup/company 400 if domain is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: 'Acme',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('POST /setup/company 404 if sessionId is unknown', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/company', {
      sessionId: 'sess-nonexistent',
      name: 'X',
      domain: 'x.com',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // ─── POST /setup/admin ──────────────────────────────────────────────────────

  it('POST /setup/admin updates admin and advances to database step', async () => {
    const sid = await startSession();
    await post(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: 'X',
      domain: 'x.com',
    });
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      name: 'Alice',
      email: 'alice@x.com',
      password: 'AliceP@ss1!',
    });
    expect(status).toBe(200);
    expect(body.currentStep).toBe('database');
    expect(body.admin.name).toBe('Alice');
    expect(body.admin.email).toBe('alice@x.com');
  });

  it('POST /setup/admin 400 if email is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      name: 'Alice',
      password: 'P@ss1!',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('POST /setup/admin 400 if name is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      email: 'alice@x.com',
      password: 'P@ss1!',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('POST /setup/admin never returns password in response', async () => {
    const sid = await startSession();
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      name: 'Alice',
      email: 'alice@x.com',
      password: 'SuperSecretP@ss999!',
    });
    expect(JSON.stringify(body)).not.toContain('SuperSecretP@ss999!');
  });

  // ─── POST /setup/database ───────────────────────────────────────────────────

  it('POST /setup/database updates database config and tests connection', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'atlas_prod',
    });
    expect(status).toBe(200);
    expect(body.database.type).toBe('postgresql');
    expect(body.database.connectionTested).toBe(true);
    expect(body.connectionResult.success).toBe(true);
    expect(body.currentStep).toBe('connector');
  });

  it('POST /setup/database 400 if host is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'postgresql',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('POST /setup/database 400 if type is invalid', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'mongodb',
      host: 'localhost',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_TYPE');
  });

  it('POST /setup/database returns positive latency in connectionResult', async () => {
    const sid = await startSession();
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'mysql',
      host: 'db.example.com',
    });
    expect(typeof body.connectionResult.latencyMs).toBe('number');
    expect(body.connectionResult.latencyMs).toBeGreaterThan(0);
  });

  // ─── POST /setup/connector ──────────────────────────────────────────────────

  it('POST /setup/connector updates connector and advances to secrets step', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/connector', {
      sessionId: sid,
      type: 'rest',
      name: 'ERP API',
      baseUrl: 'https://erp.example.com/api',
    });
    expect(status).toBe(200);
    expect(body.currentStep).toBe('secrets');
    expect(body.connector.type).toBe('rest');
    expect(body.connector.name).toBe('ERP API');
  });

  it('POST /setup/connector 400 if type is invalid', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/connector', {
      sessionId: sid,
      type: 'kafka',
      name: 'My Stream',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_TYPE');
  });

  it('POST /setup/connector 400 if name is missing', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/connector', {
      sessionId: sid,
      type: 'rest',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  // ─── POST /setup/secrets ────────────────────────────────────────────────────

  it('POST /setup/secrets updates secrets provider and advances to provision step', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/secrets', {
      sessionId: sid,
      provider: 'vault',
    });
    expect(status).toBe(200);
    expect(body.secrets.provider).toBe('vault');
    expect(body.secrets.configured).toBe(true);
    expect(body.currentStep).toBe('provision');
  });

  it('POST /setup/secrets 400 if provider is invalid', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/secrets', {
      sessionId: sid,
      provider: 'kubernetes-secrets',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_PROVIDER');
  });

  // ─── POST /setup/provision ──────────────────────────────────────────────────

  it('POST /setup/provision runs all 11 provision tasks', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
    });
    expect(status).toBe(200);
    expect(body.tasks).toHaveLength(11);
  });

  it('POST /setup/provision — all tasks have status done', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
    });
    const allDone = body.tasks.every((t: any) => t.status === 'done');
    expect(allDone).toBe(true);
  });

  it('POST /setup/provision returns tenantId, agentId and apiKey', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
    });
    expect(body.tenantId).toBeTruthy();
    expect(body.workspaceId).toBeTruthy();
    expect(body.agentId).toBeTruthy();
    expect(body.apiKey).toMatch(/^ak_live_/);
  });

  it('POST /setup/provision 400 if company step not completed', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('STEP_INCOMPLETE');
  });

  it('POST /setup/provision returns 9 validation checks all passed', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
    });
    expect(body.validationChecks).toHaveLength(9);
    expect(body.validationChecks.every((c: any) => c.passed)).toBe(true);
  });

  it('POST /setup/provision is idempotent — second call returns same tenantId', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    const r1 = await post<any>(server.baseUrl, '/api/v1/setup/provision', { sessionId: sid });
    const r2 = await post<any>(server.baseUrl, '/api/v1/setup/provision', { sessionId: sid });
    expect(r1.body.tenantId).toBe(r2.body.tenantId);
    expect(r1.body.agentId).toBe(r2.body.agentId);
  });

  // ─── GET /setup/status ──────────────────────────────────────────────────────

  it('GET /setup/status returns session info and step map', async () => {
    const sid = await startSession();
    const { status, body } = await get<any>(
      server.baseUrl,
      `/api/v1/setup/status?sessionId=${sid}`
    );
    expect(status).toBe(200);
    expect(body.sessionId).toBe(sid);
    expect(body.currentStep).toBe('company');
    expect(body.stepsCompleted.company).toBe(false);
    expect(body.stepsCompleted.provision).toBe(false);
  });

  it('GET /setup/status reflects provision tasks after provision call', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    await post(server.baseUrl, '/api/v1/setup/provision', { sessionId: sid });
    const { body } = await get<any>(server.baseUrl, `/api/v1/setup/status?sessionId=${sid}`);
    expect(body.provisionTasks).toHaveLength(11);
    expect(body.stepsCompleted.provision).toBe(true);
    expect(body.status).toBe('completed');
  });

  it('GET /setup/status 404 if session not found', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/setup/status?sessionId=nonexistent-session'
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /setup/status reports log count growing with each step', async () => {
    const sid = await startSession();
    const before = await get<any>(server.baseUrl, `/api/v1/setup/status?sessionId=${sid}`);
    await post(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: 'X',
      domain: 'x.com',
    });
    const after = await get<any>(server.baseUrl, `/api/v1/setup/status?sessionId=${sid}`);
    expect(after.body.logsCount).toBeGreaterThan(before.body.logsCount);
  });

  // ─── POST /setup/finish ─────────────────────────────────────────────────────

  it('POST /setup/finish completes setup and returns installation report', async () => {
    const sid = await startSession();
    await fullSetup(sid, { name: 'Omega Corp' });
    await post(server.baseUrl, '/api/v1/setup/connector', {
      sessionId: sid,
      type: 'rest',
      name: 'Omega ERP',
    });
    await post(server.baseUrl, '/api/v1/setup/provision', { sessionId: sid });
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/finish', {
      sessionId: sid,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.report.success).toBe(true);
    expect(body.report.company).toBe('Omega Corp');
    expect(body.summary.company).toBe('Omega Corp');
  });

  it('POST /setup/finish 400 if provision step not completed', async () => {
    const sid = await startSession();
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/finish', {
      sessionId: sid,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('PROVISION_REQUIRED');
  });

  it('POST /setup/finish 404 if session not found', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/setup/finish', {
      sessionId: 'sess-unknown-xyz',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /setup/finish includes duration and summary with tasksTotal', async () => {
    const sid = await startSession();
    await fullSetup(sid);
    await post(server.baseUrl, '/api/v1/setup/provision', { sessionId: sid });
    const { body } = await post<any>(server.baseUrl, '/api/v1/setup/finish', {
      sessionId: sid,
    });
    expect(body.report.durationMs).toBeGreaterThan(0);
    expect(body.report.summary.tasksTotal).toBe(11);
    expect(body.report.summary.tasksPassed).toBe(11);
  });

  // ─── Full happy path ────────────────────────────────────────────────────────

  it('full happy path — start → company → admin → database → connector → secrets → provision → finish', async () => {
    // 1. Start
    const { body: startBody } = await post<any>(server.baseUrl, '/api/v1/setup/start');
    const sid = startBody.sessionId;
    expect(startBody.currentStep).toBe('company');

    // 2. Company
    const { body: compBody } = await post<any>(server.baseUrl, '/api/v1/setup/company', {
      sessionId: sid,
      name: 'Atlas Demo',
      domain: 'atlasdemo.com',
      plan: 'enterprise',
      workspace: { name: 'Produção', environment: 'production' },
    });
    expect(compBody.currentStep).toBe('admin');

    // 3. Admin
    const { body: adminBody } = await post<any>(server.baseUrl, '/api/v1/setup/admin', {
      sessionId: sid,
      name: 'Super Admin',
      email: 'admin@atlasdemo.com',
      password: 'Adm!nS3cur3#2026',
      mfaEnabled: true,
    });
    expect(adminBody.currentStep).toBe('database');
    expect(adminBody.admin.mfaEnabled).toBe(true);

    // 4. Database
    const { body: dbBody } = await post<any>(server.baseUrl, '/api/v1/setup/database', {
      sessionId: sid,
      type: 'postgresql',
      host: 'pg.atlasdemo.com',
      port: 5432,
      database: 'atlas_prod',
      ssl: true,
    });
    expect(dbBody.connectionResult.success).toBe(true);

    // 5. Connector
    const { body: connBody } = await post<any>(server.baseUrl, '/api/v1/setup/connector', {
      sessionId: sid,
      type: 'rest',
      name: 'SAP ERP',
      baseUrl: 'https://sap.atlasdemo.com/api',
    });
    expect(connBody.connector.type).toBe('rest');

    // 6. Secrets
    const { body: secBody } = await post<any>(server.baseUrl, '/api/v1/setup/secrets', {
      sessionId: sid,
      provider: 'vault',
    });
    expect(secBody.currentStep).toBe('provision');

    // 7. Provision
    const { body: provBody } = await post<any>(server.baseUrl, '/api/v1/setup/provision', {
      sessionId: sid,
      agentName: 'atlas-prod-01',
    });
    expect(provBody.tasks).toHaveLength(11);
    expect(provBody.validationChecks).toHaveLength(9);
    expect(provBody.tenantId).toBeTruthy();

    // 8. Finish
    const { body: finBody } = await post<any>(server.baseUrl, '/api/v1/setup/finish', {
      sessionId: sid,
    });
    expect(finBody.success).toBe(true);
    expect(finBody.summary.company).toBe('Atlas Demo');
    expect(finBody.summary.connector).toBe('SAP ERP');
    expect(finBody.summary.tenantId).toBe(provBody.tenantId);
  });
});
