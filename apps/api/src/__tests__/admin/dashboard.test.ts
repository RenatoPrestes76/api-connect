import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startAdminServer, stopServer, seedAgent, type TestAdminServer } from './helpers.js';
import { HeartbeatRecord, SyncRecord } from '@seltriva/agent-observability';

describe('GET /admin/dashboard/metrics', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
    ctx.heartbeatRepo.clear();
    ctx.syncRepo.clear();
  });

  it('returns zero metrics for an empty system', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/metrics`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, number> };
    expect(body.data.companies).toBe(0);
    expect(body.data.agents).toBe(0);
    expect(body.data.online).toBe(0);
    expect(body.data.last24hSynchronizations).toBe(0);
  });

  it('counts agents and companies', async () => {
    await seedAgent(ctx.agentRepo, { companyId: 'co-A' });
    await seedAgent(ctx.agentRepo, { companyId: 'co-A' });
    await seedAgent(ctx.agentRepo, { companyId: 'co-B' });
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/metrics`);
    const body = (await res.json()) as { data: { companies: number; agents: number } };
    expect(body.data.companies).toBe(2);
    expect(body.data.agents).toBe(3);
  });

  it('classifies ONLINE agents (recent heartbeat)', async () => {
    await seedAgent(ctx.agentRepo, { lastHeartbeat: new Date() });
    await seedAgent(ctx.agentRepo, { lastHeartbeat: null });
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/metrics`);
    const body = (await res.json()) as { data: { online: number; offline: number } };
    expect(body.data.online).toBe(1);
    expect(body.data.offline).toBe(1);
  });

  it('counts last24h synchronizations from sync history', async () => {
    const now = new Date();
    const started = new Date(now.getTime() - 5_000);
    const sync = SyncRecord.create({
      agentId: 'ag',
      startedAt: started,
      finishedAt: now,
      recordsSent: 10,
      recordsFailed: 0,
      bytesTransferred: 1024,
      result: 'SUCCESS',
    });
    await ctx.syncRepo.save(sync);
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/metrics`);
    const body = (await res.json()) as { data: { last24hSynchronizations: number } };
    expect(body.data.last24hSynchronizations).toBe(1);
  });

  it('response has all expected metric keys', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/metrics`);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(Object.keys(body.data)).toEqual(
      expect.arrayContaining([
        'companies',
        'agents',
        'online',
        'stale',
        'offline',
        'last24hSynchronizations',
      ])
    );
  });
});

describe('GET /admin/dashboard/activity', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.heartbeatRepo.clear();
    ctx.syncRepo.clear();
  });

  it('returns empty activity when nothing recorded', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/activity`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { heartbeats: unknown[]; syncs: unknown[] } };
    expect(body.data.heartbeats).toHaveLength(0);
    expect(body.data.syncs).toHaveLength(0);
  });

  it('returns recent heartbeats', async () => {
    const hb = HeartbeatRecord.create({
      agentId: 'ag',
      receivedAt: new Date(),
      version: '1.0',
      hostname: 'h',
      status: 'ONLINE',
    });
    await ctx.heartbeatRepo.save(hb);
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/activity`);
    const body = (await res.json()) as { data: { heartbeats: unknown[] } };
    expect(body.data.heartbeats).toHaveLength(1);
  });

  it('returns recent syncs', async () => {
    const now = new Date();
    const s = SyncRecord.create({
      agentId: 'ag',
      startedAt: new Date(now.getTime() - 1000),
      finishedAt: now,
      recordsSent: 5,
      recordsFailed: 0,
      bytesTransferred: 512,
      result: 'SUCCESS',
    });
    await ctx.syncRepo.save(s);
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/activity`);
    const body = (await res.json()) as { data: { syncs: unknown[] } };
    expect(body.data.syncs).toHaveLength(1);
  });

  it('respects sinceMs query parameter', async () => {
    const old = HeartbeatRecord.create({
      agentId: 'ag',
      receivedAt: new Date(Date.now() - 7_200_000),
      version: '1.0',
      hostname: 'h',
      status: 'OFFLINE',
    });
    await ctx.heartbeatRepo.save(old);
    // sinceMs=1h — old record (2h ago) should be excluded
    const res = await fetch(`${ctx.baseUrl}/admin/dashboard/activity?sinceMs=3600000`);
    const body = (await res.json()) as { data: { heartbeats: unknown[] } };
    expect(body.data.heartbeats).toHaveLength(0);
  });
});
