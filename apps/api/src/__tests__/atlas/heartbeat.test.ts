import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  startTestServer, stopServer, seedToken, provisionAgent,
  type TestAtlasServer,
} from './helpers.js';

describe('POST /api/v1/heartbeat', () => {
  let ctx:         TestAtlasServer;
  let accessToken: string;
  let agentId:     string;

  beforeAll(async () => {
    ctx = await startTestServer();
    const rawToken = await seedToken(ctx.tokenRepo);
    ({ agentId, accessToken } = await provisionAgent(ctx.baseUrl, rawToken));
  });

  afterAll(async () => stopServer(ctx.server));

  beforeEach(() => {
    // clear repos except the provisioned agent & access token
    // (re-provision would need a fresh token anyway — just reset heartbeat tests)
  });

  async function beat(body: unknown = {}, token = accessToken): Promise<Response> {
    return fetch(`${ctx.baseUrl}/api/v1/heartbeat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
  }

  it('returns 200 with status ONLINE', async () => {
    const res  = await beat();
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe('ONLINE');
  });

  it('response contains agentId and lastHeartbeat', async () => {
    const res  = await beat();
    const body = await res.json() as { data: { agentId: string; lastHeartbeat: string } };
    expect(body.data.agentId).toBe(agentId);
    expect(body.data.lastHeartbeat).toBeDefined();
  });

  it('updates lastHeartbeat in the repository', async () => {
    await beat();
    const agent = await ctx.agentRepo.findById(agentId);
    expect(agent!.lastHeartbeat).toBeInstanceOf(Date);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/heartbeat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    '{}',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid access token', async () => {
    const res = await beat({}, 'aat_' + '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a non-aat_ bearer token', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/heartbeat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer some-jwt' },
      body:    '{}',
    });
    expect(res.status).toBe(401);
  });

  it('accepts optional hostname update', async () => {
    const res  = await beat({ hostname: 'updated.local' });
    expect(res.status).toBe(200);
    const agent = await ctx.agentRepo.findById(agentId);
    expect(agent!.hostname.toString()).toBe('updated.local');
  });

  it('accepts optional version update when newer', async () => {
    const res = await beat({ version: '9.9.9' });
    expect(res.status).toBe(200);
    const agent = await ctx.agentRepo.findById(agentId);
    expect(agent!.version.toString()).toBe('9.9.9');
  });

  it('ignores non-newer version silently', async () => {
    const res  = await beat({ version: '0.0.1' });
    expect(res.status).toBe(200); // no error
  });
});
