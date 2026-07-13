import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ActivationToken } from '@seltriva/activation';
import { startAdminServer, stopServer, type TestAdminServer } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedToken(
  ctx: TestAdminServer,
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

const VALID_BODY = {
  companyId: 'co-test',
  environment: 'staging',
};

// ─── POST /admin/activation-tokens ───────────────────────────────────────────

describe('POST /admin/activation-tokens', () => {
  let ctx: TestAdminServer;
  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.activationTokenRepo.clear();
  });

  it('creates a token and returns 201 with ATLAS-… format', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data['token']).toMatch(/^ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(body.data['companyId']).toBe('co-test');
    expect(body.data['environment']).toBe('staging');
    expect(body.data['expiresAt']).toBeDefined();
    expect(body.data['usedAt']).toBeNull();
    expect(body.data['id']).toBeDefined();
    expect(ctx.activationTokenRepo.size).toBe(1);
  });

  it('accepts optional expiresInMinutes and createdBy', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, expiresInMinutes: 60, createdBy: 'admin@co.test' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data['createdBy']).toBe('admin@co.test');
  });

  it('returns 422 when companyId is missing', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment: 'staging' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when environment is missing', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 'co-test' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when environment is not a valid value', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 'co-test', environment: 'cloud' }),
    });
    expect(res.status).toBe(422);
  });
});

// ─── GET /admin/activation-tokens ────────────────────────────────────────────

describe('GET /admin/activation-tokens', () => {
  let ctx: TestAdminServer;
  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.activationTokenRepo.clear();
  });

  it('returns 422 when companyId query param is missing', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns empty list when company has no tokens', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens?companyId=co-test`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });

  it('returns only tokens belonging to the requested companyId', async () => {
    await seedToken(ctx, { companyId: 'co-test' });
    await seedToken(ctx, { companyId: 'co-test' });
    await seedToken(ctx, { companyId: 'co-other' });

    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens?companyId=co-test`);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(2);
  });

  it('includes isValid flag in each token view', async () => {
    await seedToken(ctx, { companyId: 'co-test' });

    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens?companyId=co-test`);
    const body = (await res.json()) as { data: Record<string, unknown>[] };
    expect(body.data[0]).toHaveProperty('isValid', true);
  });
});

// ─── DELETE /admin/activation-tokens/:id ─────────────────────────────────────

describe('DELETE /admin/activation-tokens/:id', () => {
  let ctx: TestAdminServer;
  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.activationTokenRepo.clear();
  });

  it('deletes an existing token and returns 204', async () => {
    const token = await seedToken(ctx);
    expect(ctx.activationTokenRepo.size).toBe(1);

    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens/${token.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
    expect(ctx.activationTokenRepo.size).toBe(0);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/activation-tokens/does-not-exist`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
