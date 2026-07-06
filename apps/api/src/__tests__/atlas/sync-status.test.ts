import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer, stopServer, seedToken, provisionAgent,
  type TestAtlasServer,
} from './helpers.js';

describe('POST /api/v1/sync-status', () => {
  let ctx:         TestAtlasServer;
  let accessToken: string;
  let agentId:     string;

  beforeAll(async () => {
    ctx = await startTestServer();
    // Provision and heartbeat so agent is ONLINE
    const rawToken = await seedToken(ctx.tokenRepo);
    ({ agentId, accessToken } = await provisionAgent(ctx.baseUrl, rawToken));
    await fetch(`${ctx.baseUrl}/api/v1/heartbeat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body:    '{}',
    });
  });

  afterAll(async () => stopServer(ctx.server));

  async function sync(body: unknown = {}, token = accessToken): Promise<Response> {
    return fetch(`${ctx.baseUrl}/api/v1/sync-status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
  }

  it('returns 200 with agentId and lastSynchronization', async () => {
    const res  = await sync();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { agentId: string; lastSynchronization: string } };
    expect(body.data.agentId).toBe(agentId);
    expect(body.data.lastSynchronization).toBeDefined();
  });

  it('persists lastSynchronization in the repository', async () => {
    await sync();
    const agent = await ctx.agentRepo.findById(agentId);
    expect(agent!.lastSynchronization).toBeInstanceOf(Date);
  });

  it('agent status is ONLINE after sync completes', async () => {
    await sync();
    const agent = await ctx.agentRepo.findById(agentId);
    expect(agent!.status.value).toBe('ONLINE');
  });

  it('returns 401 without Authorization header', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/sync-status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid access token', async () => {
    const res = await sync({}, 'aat_' + '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('second sync also returns 200 (idempotent by design)', async () => {
    await sync();
    const res = await sync();
    expect(res.status).toBe(200);
  });
});
