import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startAdminServer, stopServer, seedAgent, type TestAdminServer } from './helpers.js';

describe('GET /admin/agents', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => { ctx = await startAdminServer(); });
  afterAll(async  () => stopServer(ctx.server));
  beforeEach(() => { ctx.agentRepo.clear(); });

  it('returns empty list when no agents', async () => {
    const res  = await fetch(`${ctx.baseUrl}/admin/agents`);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });

  it('returns seeded agents', async () => {
    await seedAgent(ctx.agentRepo);
    await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents`);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(body.meta.total).toBe(2);
    expect(body.data).toHaveLength(2);
  });

  it('response includes healthStatus field', async () => {
    await seedAgent(ctx.agentRepo, { lastHeartbeat: new Date() });
    const res  = await fetch(`${ctx.baseUrl}/admin/agents`);
    const body = await res.json() as { data: { healthStatus: string }[] };
    expect(['ONLINE','STALE','OFFLINE']).toContain(body.data[0].healthStatus);
  });

  it('response includes all expected fields', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    const res   = await fetch(`${ctx.baseUrl}/admin/agents`);
    const body  = await res.json() as { data: Record<string, unknown>[] };
    const a     = body.data[0];
    expect(a['agentId']).toBe(agent.id.toString());
    expect(a['companyId']).toBeDefined();
    expect(a['hostname']).toBeDefined();
    expect(a['status']).toBeDefined();
    expect(a['createdAt']).toBeDefined();
  });
});

describe('GET /admin/agents/:id', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => { ctx = await startAdminServer(); });
  afterAll(async  () => stopServer(ctx.server));
  beforeEach(() => { ctx.agentRepo.clear(); });

  it('returns 200 with agent data', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    const res   = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}`);
    expect(res.status).toBe(200);
    const body  = await res.json() as { data: { agentId: string } };
    expect(body.data.agentId).toBe(agent.id.toString());
  });

  it('returns 404 for unknown id', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/agents/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe('GET /admin/companies/:companyId/agents', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => { ctx = await startAdminServer(); });
  afterAll(async  () => stopServer(ctx.server));
  beforeEach(() => { ctx.agentRepo.clear(); });

  it('returns only agents for the given company', async () => {
    await seedAgent(ctx.agentRepo, { companyId: 'co-A' });
    await seedAgent(ctx.agentRepo, { companyId: 'co-A' });
    await seedAgent(ctx.agentRepo, { companyId: 'co-B' });
    const res  = await fetch(`${ctx.baseUrl}/admin/companies/co-A/agents`);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(body.meta.total).toBe(2);
  });

  it('returns empty list for unknown company', async () => {
    const res  = await fetch(`${ctx.baseUrl}/admin/companies/nobody/agents`);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});
