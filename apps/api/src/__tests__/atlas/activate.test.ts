import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ActivationToken } from '@seltriva/activation';
import { startTestServer, stopServer, type TestAtlasServer } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedActivationToken(
  ctx: TestAtlasServer,
  overrides: Partial<{ companyId: string; environment: string; expiresInMinutes: number }> = {}
): Promise<ActivationToken> {
  const token = ActivationToken.generate(
    overrides.companyId ?? 'co-test',
    (overrides.environment ?? 'staging') as 'production' | 'staging' | 'development',
    overrides.expiresInMinutes ?? 30
  );
  await ctx.activationTokenRepo.save(token);
  return token;
}

function activateBody(rawToken: string, machineId?: string): Record<string, unknown> {
  return {
    activationToken: rawToken,
    name: 'Atlas Runtime 01',
    hostname: 'runtime-host.local',
    machineId: machineId ?? randomUUID(),
    version: '1.0.0',
    connectorType: 'MSSQL',
  };
}

// ─── POST /api/v1/activate ────────────────────────────────────────────────────

describe('POST /api/v1/activate', () => {
  let ctx: TestAtlasServer;
  beforeAll(async () => {
    ctx = await startTestServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
    ctx.accessTokenRepo.clear();
    ctx.activationTokenRepo.clear();
  });

  it('returns 201 with all runtime credential fields on success', async () => {
    const token = await seedActivationToken(ctx, { companyId: 'co-test', environment: 'staging' });

    const res = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token.token)),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: Record<string, unknown> };
    const data = body.data;
    expect(data['runtimeId']).toBeDefined();
    expect(data['companyId']).toBe('co-test');
    expect(data['environment']).toBe('staging');
    expect(typeof data['runtimeToken']).toBe('string');
    expect(data['heartbeatUrl']).toBe('/api/v1/heartbeat');
    expect(data['syncUrl']).toBe('/api/v1/sync-status');
  });

  it('registers the agent in the agent repository', async () => {
    const token = await seedActivationToken(ctx);

    await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token.token)),
    });

    expect(ctx.agentRepo.size).toBe(1);
  });

  it('consumes the activation token so it cannot be reused', async () => {
    const token = await seedActivationToken(ctx);
    const machineA = randomUUID();
    const machineB = randomUUID();

    await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token.token, machineA)),
    });

    // Second attempt with same token should fail
    const res2 = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token.token, machineB)),
    });

    expect(res2.status).toBe(409);
    const body = (await res2.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_USED');
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationToken: 'ATLAS-AAAA-BBBB-CCCC' }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 TOKEN_NOT_FOUND for an unknown token', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody('ATLAS-UNKN-UNKN-UNKN')),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const expired = ActivationToken.fromSnapshot({
      id: randomUUID(),
      token: 'ATLAS-EXPI-IRED-TOKN',
      companyId: 'co-test',
      environment: 'staging',
      expiresAt: new Date(Date.now() - 1_000), // already past
      usedAt: null,
      createdAt: new Date(Date.now() - 60_000),
      createdBy: null,
    });
    await ctx.activationTokenRepo.save(expired);

    const res = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody('ATLAS-EXPI-IRED-TOKN')),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 409 MACHINE_ALREADY_REGISTERED when the machineId is already in use', async () => {
    const machineId = randomUUID();

    // First activation should succeed
    const token1 = await seedActivationToken(ctx);
    await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token1.token, machineId)),
    });

    // Second activation with same machineId but a fresh token
    const token2 = await seedActivationToken(ctx);
    const res = await fetch(`${ctx.baseUrl}/api/v1/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateBody(token2.token, machineId)),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MACHINE_ALREADY_REGISTERED');
  });

  it('issues a unique runtimeToken for each activation', async () => {
    const token1 = await seedActivationToken(ctx, { companyId: 'co-a' });
    const token2 = await seedActivationToken(ctx, { companyId: 'co-b' });

    const [res1, res2] = await Promise.all([
      fetch(`${ctx.baseUrl}/api/v1/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activateBody(token1.token, randomUUID())),
      }),
      fetch(`${ctx.baseUrl}/api/v1/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activateBody(token2.token, randomUUID())),
      }),
    ]);

    const b1 = (await res1.json()) as { data: { runtimeToken: string } };
    const b2 = (await res2.json()) as { data: { runtimeToken: string } };
    expect(b1.data.runtimeToken).not.toBe(b2.data.runtimeToken);
  });
});
