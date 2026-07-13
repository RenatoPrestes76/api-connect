import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'node:http';
import { startTestServer, stopServer, seedToken, type TestAtlasServer } from './helpers.js';

const FUTURE = new Date(Date.now() + 86_400_000);

describe('POST /api/v1/provision', () => {
  let ctx: TestAtlasServer;

  beforeAll(async () => {
    ctx = await startTestServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.tokenRepo.clear();
    ctx.agentRepo.clear();
    ctx.accessTokenRepo.clear();
  });

  async function post(body: unknown): Promise<Response> {
    return fetch(`${ctx.baseUrl}/api/v1/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const VALID_BODY = (rawToken: string) => ({
    rawToken,
    machineId: 'MACHINE-TEST-001',
    hostname: 'runtime01.local',
    connectorType: 'MSSQL',
    version: '1.0.0',
    name: 'Test Runtime',
    companyId: 'co-test',
  });

  it('returns 201 with agentId and accessToken on success', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const res = await post(VALID_BODY(rawToken));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { agentId: string; accessToken: string } };
    expect(body.data.agentId).toBeDefined();
    expect(body.data.accessToken).toMatch(/^aat_/);
  });

  it('accessToken is 68 chars (aat_ + 64 hex)', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const res = await post(VALID_BODY(rawToken));
    const body = (await res.json()) as { data: { accessToken: string } };
    expect(body.data.accessToken).toHaveLength(68);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await post({ rawToken: 'slp_abc' });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for an unknown provisioning token', async () => {
    const res = await post(VALID_BODY('slp_' + '0'.repeat(64)));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns 401 for an expired provisioning token', async () => {
    const { token, rawToken } = (
      await import('@seltriva/agent-provisioning')
    ).ProvisioningToken.create(
      { companyId: 'co-test', description: 'expired', expiresAt: FUTURE },
      () => 'exp-tok'
    );
    const expired = (await import('@seltriva/agent-provisioning')).ProvisioningToken.fromSnapshot({
      ...token.toSnapshot(),
      expiresAt: new Date(Date.now() - 1),
    });
    await ctx.tokenRepo.create(expired);

    const res = await post(VALID_BODY(rawToken));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 for a revoked provisioning token', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const { hashProvisioningToken } = await import('@seltriva/agent-provisioning');
    const found = await ctx.tokenRepo.findByHash(hashProvisioningToken(rawToken));
    await ctx.tokenRepo.revoke(found!.id);

    const res = await post(VALID_BODY(rawToken));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_REVOKED');
  });

  it('returns 403 for a company mismatch', async () => {
    const rawToken = await seedToken(ctx.tokenRepo, 'co-A');
    const res = await post({ ...VALID_BODY(rawToken), companyId: 'co-B' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('COMPANY_MISMATCH');
  });

  it('returns 409 when machineId is already registered', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const rawToken2 = await seedToken(ctx.tokenRepo);

    await post(VALID_BODY(rawToken));
    const res = await post({ ...VALID_BODY(rawToken2), name: 'Second Agent' });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MACHINE_ALREADY_REGISTERED');
  });

  it('returns 422 for invalid agent parameters (bad hostname)', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const res = await post({ ...VALID_BODY(rawToken), hostname: 'bad hostname!' });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('agent is persisted in the repository after successful provision', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    const res = await post(VALID_BODY(rawToken));
    const body = (await res.json()) as { data: { agentId: string } };
    expect(await ctx.agentRepo.findById(body.data.agentId)).not.toBeNull();
  });

  it('access token is persisted in the access token repo', async () => {
    const rawToken = await seedToken(ctx.tokenRepo);
    await post(VALID_BODY(rawToken));
    expect(ctx.accessTokenRepo.size).toBe(1);
  });
});
