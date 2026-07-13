import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startAdminServer, stopServer, seedAgent, type TestAdminServer } from './helpers.js';

describe('GET /admin/agents — filters', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
  });

  it('filters by companyId', async () => {
    await seedAgent(ctx.agentRepo, { companyId: 'co-A' });
    await seedAgent(ctx.agentRepo, { companyId: 'co-B' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?companyId=co-A`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('filters by connectorType', async () => {
    await seedAgent(ctx.agentRepo, { connectorType: 'MSSQL' });
    await seedAgent(ctx.agentRepo, { connectorType: 'PGSQL' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?connectorType=MSSQL`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('filters by version prefix', async () => {
    await seedAgent(ctx.agentRepo, { version: '1.0.0' });
    await seedAgent(ctx.agentRepo, { version: '2.0.0' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?version=1`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('filters by hostname substring (case-insensitive)', async () => {
    await seedAgent(ctx.agentRepo, { hostname: 'srv01.corp.local' });
    await seedAgent(ctx.agentRepo, { hostname: 'workstation.local' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?hostname=SRV`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('filters by healthStatus=ONLINE', async () => {
    await seedAgent(ctx.agentRepo, { lastHeartbeat: new Date() }); // ONLINE
    await seedAgent(ctx.agentRepo, { lastHeartbeat: new Date(Date.now() - 3_600_000) }); // OFFLINE
    const res = await fetch(`${ctx.baseUrl}/admin/agents?healthStatus=ONLINE`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('filters by healthStatus=OFFLINE (no heartbeat)', async () => {
    await seedAgent(ctx.agentRepo, { lastHeartbeat: null });
    await seedAgent(ctx.agentRepo, { lastHeartbeat: new Date() });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?healthStatus=OFFLINE`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(1);
  });

  it('returns empty when no agents match filter', async () => {
    await seedAgent(ctx.agentRepo, { companyId: 'co-X' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?companyId=co-Z`);
    const body = (await res.json()) as { meta: { total: number } };
    expect(body.meta.total).toBe(0);
  });

  it('supports sorting by hostname asc', async () => {
    await seedAgent(ctx.agentRepo, { hostname: 'zz.local' });
    await seedAgent(ctx.agentRepo, { hostname: 'aa.local' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents?sortBy=hostname&sortOrder=asc`);
    const body = (await res.json()) as { data: { hostname: string }[] };
    expect(body.data[0].hostname).toBe('aa.local');
  });
});
