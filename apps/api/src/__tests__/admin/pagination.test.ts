import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startAdminServer, stopServer, seedAgent, type TestAdminServer } from './helpers.js';

describe('GET /admin/agents — pagination', () => {
  let ctx: TestAdminServer;

  beforeAll(async () => { ctx = await startAdminServer(); });
  afterAll(async  () => stopServer(ctx.server));
  beforeEach(() => { ctx.agentRepo.clear(); });

  it('returns first page with correct meta', async () => {
    for (let i = 0; i < 25; i++) await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents?page=1&pageSize=10`);
    const body = await res.json() as { data: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } };
    expect(body.meta.total).toBe(25);
    expect(body.meta.page).toBe(1);
    expect(body.meta.pageSize).toBe(10);
    expect(body.meta.totalPages).toBe(3);
    expect(body.data).toHaveLength(10);
  });

  it('returns last page with fewer items', async () => {
    for (let i = 0; i < 25; i++) await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents?page=3&pageSize=10`);
    const body = await res.json() as { data: unknown[]; meta: { page: number } };
    expect(body.data).toHaveLength(5);
    expect(body.meta.page).toBe(3);
  });

  it('default pageSize is 20', async () => {
    for (let i = 0; i < 25; i++) await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents`);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(20);
  });

  it('caps pageSize at 100', async () => {
    for (let i = 0; i < 5; i++) await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents?pageSize=999`);
    const body = await res.json() as { data: unknown[]; meta: { pageSize: number } };
    expect(body.meta.pageSize).toBe(100);
    expect(body.data).toHaveLength(5);
  });

  it('returns empty second page gracefully', async () => {
    await seedAgent(ctx.agentRepo);
    const res  = await fetch(`${ctx.baseUrl}/admin/agents?page=2&pageSize=10`);
    const body = await res.json() as { data: unknown[]; meta: { total: number } };
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(1);
  });

  it('totalPages is at least 1 for empty list', async () => {
    const res  = await fetch(`${ctx.baseUrl}/admin/agents`);
    const body = await res.json() as { meta: { totalPages: number } };
    expect(body.meta.totalPages).toBe(1);
  });
});
