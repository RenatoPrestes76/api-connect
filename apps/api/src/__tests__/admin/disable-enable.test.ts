import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startAdminServer, stopServer, seedAgent, type TestAdminServer } from './helpers.js';

describe('PATCH /admin/agents/:id/disable', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
  });

  it('returns 200 with status DISABLED', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    const res = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/disable`, { method: 'PATCH' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { agentId: string; status: string } };
    expect(body.data.status).toBe('DISABLED');
    expect(body.data.agentId).toBe(agent.id.toString());
  });

  it('persists DISABLED status in the repository', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/disable`, { method: 'PATCH' });
    const updated = await ctx.agentRepo.findById(agent.id.toString());
    expect(updated!.status.value).toBe('DISABLED');
  });

  it('is idempotent — disabling an already-disabled agent returns 200', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/disable`, { method: 'PATCH' });
    const res = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/disable`, { method: 'PATCH' });
    expect(res.status).toBe(200);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/agents/nonexistent/disable`, { method: 'PATCH' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /admin/agents/:id/enable', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
  });

  async function disableAgent(id: string): Promise<void> {
    await fetch(`${ctx.baseUrl}/admin/agents/${id}/disable`, { method: 'PATCH' });
  }

  it('re-enables a disabled agent with status REGISTERING', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    await disableAgent(agent.id.toString());
    const res = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/enable`, { method: 'PATCH' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe('REGISTERING');
  });

  it('persists REGISTERING status in the repository', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    await disableAgent(agent.id.toString());
    await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/enable`, { method: 'PATCH' });
    const updated = await ctx.agentRepo.findById(agent.id.toString());
    expect(updated!.status.value).toBe('REGISTERING');
  });

  it('returns 409 when agent is not disabled', async () => {
    const agent = await seedAgent(ctx.agentRepo); // ONLINE
    const res = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}/enable`, { method: 'PATCH' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/agents/nonexistent/enable`, { method: 'PATCH' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /admin/agents/:id', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => {
    ctx = await startAdminServer();
  });
  afterAll(async () => stopServer(ctx.server));
  beforeEach(() => {
    ctx.agentRepo.clear();
  });

  it('returns 204 and removes agent from repository', async () => {
    const agent = await seedAgent(ctx.agentRepo);
    const res = await fetch(`${ctx.baseUrl}/admin/agents/${agent.id}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(await ctx.agentRepo.findById(agent.id.toString())).toBeNull();
  });

  it('returns 404 for unknown agent', async () => {
    const res = await fetch(`${ctx.baseUrl}/admin/agents/unknown`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
