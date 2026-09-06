import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer, stopServer, get, post, put, del, orgBearer, noOrgBearer } from './helpers.js';
import type { TestServer } from './helpers.js';
import { prisma } from '../../services/prisma.js';

/**
 * ATLAS master audit — regression coverage for a real cross-tenant BOLA
 * found and fixed in routes/v1/organizations.ts, routes/v1/agents.ts, and
 * routes/v1/plugins.ts: these routes sit behind only the generic
 * Supabase-style authMiddleware (any authenticated user, any org) with no
 * per-route wrapper, and used to trust a client-supplied :id/:orgId
 * directly against real Prisma-backed Organization/Agent/OrganizationPlugin
 * rows — any authenticated caller could read/mutate/delete ANY other
 * tenant's organization, agent, or plugin installation. No test existed
 * for any of these routes before this file.
 */

let srv: TestServer;
let orgA: { id: string };
let orgB: { id: string };
let agentA: { id: string };
let environmentA: { id: string };
let plugin: { id: string };

beforeAll(async () => {
  srv = await startServer();

  orgA = await prisma.organization.create({
    data: { slug: `bola-test-org-a-${randomUUID()}`, name: 'BOLA Test Org A' },
  });
  orgB = await prisma.organization.create({
    data: { slug: `bola-test-org-b-${randomUUID()}`, name: 'BOLA Test Org B' },
  });

  const workspaceA = await prisma.workspace.create({
    data: { organizationId: orgA.id, name: 'Default', slug: 'default' },
  });
  environmentA = await prisma.environment.create({
    data: { workspaceId: workspaceA.id, name: 'Production', slug: 'production' },
  });
  agentA = await prisma.agent.create({
    data: {
      organizationId: orgA.id,
      environmentId: environmentA.id,
      name: 'BOLA Test Agent',
      version: '1.0.0',
    },
  });

  plugin = await prisma.plugin.create({
    data: {
      slug: `bola-test-plugin-${randomUUID()}`,
      name: 'BOLA Test Plugin',
      description: 'test',
      version: '1.0.0',
      publisherId: (
        await prisma.user.upsert({
          where: { supabaseId: 'bola-test-publisher' },
          create: {
            supabaseId: 'bola-test-publisher',
            email: `bola-test-publisher-${randomUUID()}@example.com`,
          },
          update: {},
        })
      ).id,
      status: 'PUBLISHED',
      category: 'test',
      manifest: {},
    },
  });
});

afterAll(async () => {
  await stopServer(srv.server);
  // Clean up in FK-safe order — never leave orphaned rows in the shared dev DB.
  await prisma.organizationPlugin.deleteMany({
    where: { organizationId: { in: [orgA.id, orgB.id] } },
  });
  await prisma.agent.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.environment.deleteMany({ where: { id: environmentA.id } });
  await prisma.workspace.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.plugin.deleteMany({ where: { id: plugin.id } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
});

describe('GET /api/v1/organizations/:id — cross-tenant BOLA', () => {
  it('org A can read its own organization', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      orgBearer(orgA.id)
    );
    expect(status).toBe(200);
    expect(body.data.id).toBe(orgA.id);
  });

  it("org B cannot read org A's organization by id", async () => {
    const { status } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
  });

  it('returns 401 unauthenticated', async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/organizations/${orgA.id}`);
    expect(status).toBe(401);
  });

  it('returns 403 for a session with no organization', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      noOrgBearer()
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
  });
});

describe('PUT /api/v1/organizations/:id — cross-tenant BOLA', () => {
  it("org B cannot update org A's organization", async () => {
    const { status } = await put<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      orgBearer(orgB.id),
      { name: 'Hijacked by org B' }
    );
    expect(status).toBe(404);
    const stillOriginal = await prisma.organization.findUnique({ where: { id: orgA.id } });
    expect(stillOriginal?.name).toBe('BOLA Test Org A');
  });

  it('org A can update its own organization', async () => {
    const { status, body } = await put<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      orgBearer(orgA.id),
      { name: 'BOLA Test Org A (renamed)' }
    );
    expect(status).toBe(200);
    expect(body.data.name).toBe('BOLA Test Org A (renamed)');
  });
});

describe('DELETE /api/v1/organizations/:id — cross-tenant BOLA', () => {
  it("org B cannot delete org A's organization", async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
    const stillThere = await prisma.organization.findFirst({
      where: { id: orgA.id, deletedAt: null },
    });
    expect(stillThere).not.toBeNull();
  });
});

describe('GET /api/v1/organizations/:id/members — cross-tenant BOLA', () => {
  it("org B cannot list org A's members", async () => {
    const { status } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/members`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
  });

  it('org A can list its own members', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/members`,
      orgBearer(orgA.id)
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('GET /api/v1/organizations/:id/workspaces — cross-tenant BOLA', () => {
  it("org B cannot list org A's workspaces", async () => {
    const { status } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/workspaces`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
  });
});

describe('GET /api/v1/agents/:id — cross-tenant BOLA', () => {
  it("org B cannot read org A's agent", async () => {
    const { status } = await get<any>(
      srv.baseUrl,
      `/api/v1/agents/${agentA.id}`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
  });

  it('org A can read its own agent', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/agents/${agentA.id}`,
      orgBearer(orgA.id)
    );
    expect(status).toBe(200);
    expect(body.data.id).toBe(agentA.id);
  });
});

describe('DELETE /api/v1/agents/:id — cross-tenant BOLA', () => {
  it("org B cannot retire org A's agent", async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/agents/${agentA.id}`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
    const stillThere = await prisma.agent.findUnique({ where: { id: agentA.id } });
    expect(stillThere?.retiredAt).toBeNull();
  });
});

describe('POST /api/v1/agents/:id/heartbeat — cross-tenant forgery', () => {
  it("org B cannot forge a heartbeat for org A's agent", async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/agents/${agentA.id}/heartbeat`,
      orgBearer(orgB.id),
      { status: 'OFFLINE' }
    );
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/agents/register — organizationId spoofing', () => {
  it("org B cannot register a new agent under org A's organizationId", async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/agents/register',
      orgBearer(orgB.id),
      {
        organizationId: orgA.id,
        environmentId: environmentA.id,
        name: 'Spoofed Agent',
        version: '1.0.0',
      }
    );
    expect(status).toBe(201);
    // The client-supplied organizationId must be ignored — the agent is
    // created under the CALLER's real session org (orgB), never orgA.
    expect(body.data.organizationId).toBe(orgB.id);
    await prisma.agent.deleteMany({ where: { id: body.data.id } });
  });
});

describe('Plugin install/uninstall — cross-tenant BOLA', () => {
  it("org B cannot install a plugin into org A's organization via the :orgId URL param", async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/plugins/${plugin.id}/install`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
    const installed = await prisma.organizationPlugin.findUnique({
      where: { organizationId_pluginId: { organizationId: orgA.id, pluginId: plugin.id } },
    });
    expect(installed).toBeNull();
  });

  it('org A can install a plugin into its own organization', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/plugins/${plugin.id}/install`,
      orgBearer(orgA.id)
    );
    expect(status).toBe(201);
    expect(body.data.organizationId).toBe(orgA.id);
  });

  it("org B cannot list org A's installed plugins", async () => {
    const { status } = await get<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/plugins`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
  });

  it("org B cannot uninstall org A's plugin", async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/plugins/${plugin.id}`,
      orgBearer(orgB.id)
    );
    expect(status).toBe(404);
    const stillInstalled = await prisma.organizationPlugin.findUnique({
      where: { organizationId_pluginId: { organizationId: orgA.id, pluginId: plugin.id } },
    });
    expect(stillInstalled).not.toBeNull();
  });

  it('org A can uninstall its own plugin', async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/organizations/${orgA.id}/plugins/${plugin.id}`,
      orgBearer(orgA.id)
    );
    expect(status).toBe(200);
  });
});
