import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth } from '../canonical-model/helpers.js';
import { loadOrCreateIdentity } from '../../../../agent/src/atlas-runtime-client/identity.js';
import { registerRuntime } from '../../../../agent/src/atlas-runtime-client/client.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.22 — Fase 9/10/11: proves the Runtime -> Organization -> Tenant
 * chain, entirely through the real HTTP surface plus direct Postgres reads
 * (never by calling a store/service internally to fake a result).
 *
 * By design (see packages/database/prisma/schema.prisma's RuntimeRegistration
 * model comment and docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md),
 * RuntimeRegistration has NO tenantId column — Tenant association is
 * derived by joining through controlPlaneOrganization.tenantId, so it can
 * never go stale relative to the Organization's actual Tenant. These tests
 * exercise that derivation directly, and the PENDING_TENANT_ASSIGNMENT
 * state it implies when an Organization has no Tenant yet — never a fake
 * Tenant.
 */

async function registerPortalOrgAndRuntime(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{
  portalOrganizationId: string;
  controlPlaneOrganizationId: string;
  runtimeId: string;
}> {
  const orgCode = `${label}${Date.now().toString(36)}`;
  const orgRes = await post<{ organization: { id: string; controlPlaneOrganizationId: string } }>(
    baseUrl,
    '/api/v1/portal/auth/register',
    {
      name: `Tenant Assoc ${orgCode}`,
      razaoSocial: `Tenant Assoc ${orgCode} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
      internalCode: orgCode,
      plan: 'professional',
      owner: {
        name: 'Owner',
        email: `owner-${orgCode.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    }
  );

  const keyRes = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode: orgCode },
    auth
  );

  const dir = mkdtempSync(join(tmpdir(), `atlas-tenant-assoc-${label}-`));
  const identity = loadOrCreateIdentity(dir);
  const registered = await registerRuntime(baseUrl, identity, {
    organizationCode: orgCode,
    activationKey: keyRes.body.activationKey.code,
    runtimeVersion: '1.2.0',
    hostname: `tenant-assoc-${label}-host`,
    os: 'linux',
  });

  return {
    portalOrganizationId: orgRes.body.organization.id,
    controlPlaneOrganizationId: orgRes.body.organization.controlPlaneOrganizationId,
    runtimeId: registered.runtimeId,
  };
}

describe('ATLAS 46.22 — Runtime -> Organization -> Tenant association', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  const createdTenantSlugs: string[] = [];
  // Every registerPortalOrgAndRuntime() call below uses one of these fixed
  // label prefixes for its portal internalCode — cleaned up by prefix
  // rather than tracking each generated code individually.
  const ORG_CODE_PREFIXES = ['PEND', 'ASSIGN', 'TXA', 'TXB'];

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = await superAdminAuth(baseUrl);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    for (const prefix of ORG_CODE_PREFIXES) {
      await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
    }
    if (createdTenantSlugs.length) {
      await prisma.tenant.deleteMany({ where: { slug: { in: createdTenantSlugs } } });
    }
  });

  it('a freshly-registered Runtime is in PENDING_TENANT_ASSIGNMENT: linked to a real Organization, but that Organization has no Tenant yet', async () => {
    const { controlPlaneOrganizationId, runtimeId } = await registerPortalOrgAndRuntime(
      baseUrl,
      auth,
      'PEND'
    );

    const org = await prisma.organization.findUnique({
      where: { id: controlPlaneOrganizationId },
    });
    expect(org).not.toBeNull();
    expect(org?.tenantId).toBeNull(); // honest absence, not a fake/system Tenant

    const runtime = await prisma.runtimeRegistration.findUnique({ where: { id: runtimeId } });
    expect(runtime?.controlPlaneOrganizationId).toBe(controlPlaneOrganizationId);
  });

  it("assigning the Organization to a real Tenant immediately (and correctly) changes the Runtime's derived Tenant — no write to the Runtime itself required", async () => {
    const { controlPlaneOrganizationId, runtimeId } = await registerPortalOrgAndRuntime(
      baseUrl,
      auth,
      'ASSIGN'
    );

    const tenantSlug = `t46-22-assign-${Date.now().toString(36)}`;
    createdTenantSlugs.push(tenantSlug);
    const tenantRes = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Runtime Tenant Assignment Co', slug: tenantSlug },
      auth
    );
    expect(tenantRes.body.id).toBeTruthy();

    const patchRes = await fetch(
      `${baseUrl}/admin/control-plane/organizations/${controlPlaneOrganizationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: tenantRes.body.id }),
      }
    );
    expect(patchRes.status).toBe(200);

    // Re-derive the Runtime's Tenant the same way any consumer would: join
    // through its Organization. No RuntimeRegistration row was touched.
    const runtimeRow = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(runtimeRow?.controlPlaneOrganization?.tenantId).toBe(tenantRes.body.id);
  });

  it("the Control Plane organization lookup (46.21) never crosses Tenant boundaries: Tenant A/Org A/Runtime A is invisible from Tenant B/Org B's lookup", async () => {
    const runtimeA = await registerPortalOrgAndRuntime(baseUrl, auth, 'TXA');
    const runtimeB = await registerPortalOrgAndRuntime(baseUrl, auth, 'TXB');

    const slugA = `t46-22-xa-${Date.now().toString(36)}`;
    const slugB = `t46-22-xb-${Date.now().toString(36)}`;
    createdTenantSlugs.push(slugA, slugB);
    const tenantA = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Tenant A', slug: slugA },
      auth
    );
    const tenantB = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Tenant B', slug: slugB },
      auth
    );

    await fetch(
      `${baseUrl}/admin/control-plane/organizations/${runtimeA.controlPlaneOrganizationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: tenantA.body.id }),
      }
    );
    await fetch(
      `${baseUrl}/admin/control-plane/organizations/${runtimeB.controlPlaneOrganizationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: tenantB.body.id }),
      }
    );

    const lookupA = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${runtimeA.controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(lookupA.body.runtimes.some((r) => r.runtimeId === runtimeA.runtimeId)).toBe(true);
    expect(lookupA.body.runtimes.some((r) => r.runtimeId === runtimeB.runtimeId)).toBe(false);

    // Confirm via direct Postgres join that A's Runtime really does resolve
    // under Tenant A and never under Tenant B.
    const rowA = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeA.runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(rowA?.controlPlaneOrganization?.tenantId).toBe(tenantA.body.id);
    expect(rowA?.controlPlaneOrganization?.tenantId).not.toBe(tenantB.body.id);
  });

  it('registering a Runtime under an unknown organizationCode is rejected before any Tenant/Organization logic runs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atlas-tenant-assoc-unknown-org-'));
    try {
      const identity = loadOrCreateIdentity(dir);
      await expect(
        registerRuntime(baseUrl, identity, {
          organizationCode: 'ORG-DOES-NOT-EXIST-AT-ALL',
          activationKey: 'irrelevant',
          runtimeVersion: '1.2.0',
          hostname: 'unknown-org-host',
          os: 'linux',
        })
      ).rejects.toMatchObject({ status: 404, code: 'ORGANIZATION_NOT_FOUND' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
