import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  stopServer,
  seedToken,
  provisionAgent,
  type TestAtlasServer,
} from './helpers.js';

describe('GET /api/v1/me', () => {
  let ctx: TestAtlasServer;
  let accessToken: string;
  let agentId: string;

  beforeAll(async () => {
    ctx = await startTestServer();
    const rawToken = await seedToken(ctx.tokenRepo);
    ({ agentId, accessToken } = await provisionAgent(ctx.baseUrl, rawToken));
  });

  afterAll(async () => stopServer(ctx.server));

  async function me(token = accessToken): Promise<Response> {
    return fetch(`${ctx.baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  it('returns 200 with agent identity fields', async () => {
    const res = await me();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data.agentId).toBe(agentId);
    expect(body.data.companyId).toBe('co-test');
    expect(body.data.name).toBe('Integration Test Agent');
    expect(body.data.machineId).toBe('MACHINE-INTTEST-001');
    expect(body.data.hostname).toBe('inttest.local');
    expect(body.data.connectorType).toBe('MSSQL');
    expect(body.data.version).toBe('1.0.0');
    expect(body.data.status).toBe('REGISTERING');
    expect(body.data.createdAt).toBeDefined();
  });

  it('lastHeartbeat is null before first heartbeat', async () => {
    const res = await me();
    const body = (await res.json()) as { data: { lastHeartbeat: null } };
    expect(body.data.lastHeartbeat).toBeNull();
  });

  it('returns 401 without Authorization header', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/me`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid access token', async () => {
    const res = await me('aat_' + '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a non-aat_ bearer token', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/me`, {
      headers: { Authorization: 'Bearer supabase-jwt' },
    });
    expect(res.status).toBe(401);
  });
});
