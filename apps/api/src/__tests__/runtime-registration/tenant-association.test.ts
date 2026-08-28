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
  const ORG_CODE_PREFIXES = [
    'PEND',
    'ASSIGN',
    'TXA',
    'TXB',
    'REASN',
    'LOSE',
    'ARBID',
    'CONCA',
    'CONCB',
  ];

  async function patchOrganizationTenant(
    organizationId: string,
    tenantId: string | null
  ): Promise<Response> {
    return fetch(`${baseUrl}/admin/control-plane/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ tenantId }),
    });
  }

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

  // ─── ATLAS 46.23 — Part F: reassignment, removal, arbitrary tenantId ────

  it("reassigning the Organization from Tenant A to Tenant B: the Runtime's derived Tenant follows, and no row is duplicated anywhere", async () => {
    const { controlPlaneOrganizationId, runtimeId } = await registerPortalOrgAndRuntime(
      baseUrl,
      auth,
      'REASN'
    );

    const slugA = `t46-23-reasn-a-${Date.now().toString(36)}`;
    const slugB = `t46-23-reasn-b-${Date.now().toString(36)}`;
    createdTenantSlugs.push(slugA, slugB);
    const tenantA = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Reassignment Tenant A', slug: slugA },
      auth
    );
    const tenantB = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Reassignment Tenant B', slug: slugB },
      auth
    );

    const firstAssign = await patchOrganizationTenant(controlPlaneOrganizationId, tenantA.body.id);
    expect(firstAssign.status).toBe(200);
    const afterFirst = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(afterFirst?.controlPlaneOrganization?.tenantId).toBe(tenantA.body.id);

    const reassign = await patchOrganizationTenant(controlPlaneOrganizationId, tenantB.body.id);
    expect(reassign.status).toBe(200);
    const afterReassign = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(afterReassign?.controlPlaneOrganization?.tenantId).toBe(tenantB.body.id);
    expect(afterReassign?.controlPlaneOrganization?.tenantId).not.toBe(tenantA.body.id);

    // No duplicate rows: exactly one Organization row, exactly one
    // RuntimeRegistration row — reassignment is an update, never an insert.
    const orgCount = await prisma.organization.count({
      where: { id: controlPlaneOrganizationId },
    });
    const runtimeCount = await prisma.runtimeRegistration.count({ where: { id: runtimeId } });
    expect(orgCount).toBe(1);
    expect(runtimeCount).toBe(1);
  });

  it('an Organization that loses its Tenant (tenantId set back to null) returns the Runtime to PENDING_TENANT_ASSIGNMENT — no fallback Tenant is substituted', async () => {
    const { controlPlaneOrganizationId, runtimeId } = await registerPortalOrgAndRuntime(
      baseUrl,
      auth,
      'LOSE'
    );

    const slug = `t46-23-lose-${Date.now().toString(36)}`;
    createdTenantSlugs.push(slug);
    const tenant = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Losable Tenant', slug },
      auth
    );

    const assign = await patchOrganizationTenant(controlPlaneOrganizationId, tenant.body.id);
    expect(assign.status).toBe(200);
    const assigned = await prisma.organization.findUnique({
      where: { id: controlPlaneOrganizationId },
    });
    expect(assigned?.tenantId).toBe(tenant.body.id);

    const remove = await patchOrganizationTenant(controlPlaneOrganizationId, null);
    expect(remove.status).toBe(200);
    const removed = await prisma.organization.findUnique({
      where: { id: controlPlaneOrganizationId },
    });
    expect(removed?.tenantId).toBeNull(); // honest absence again, not a fallback/default Tenant

    const runtime = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(runtime?.controlPlaneOrganization?.tenantId).toBeNull();
    // The Runtime itself was never written to by either the assignment or
    // the removal — this whole scenario is entirely an Organization-side
    // state change.
    expect(runtime?.controlPlaneOrganizationId).toBe(controlPlaneOrganizationId);
  });

  it('a client-supplied tenantId cannot be used to influence Runtime registration or escape Organization-scoped Runtime lookups', async () => {
    const orgCode = `ARBID${Date.now().toString(36)}`;
    const orgRes = await post<{ organization: { id: string; controlPlaneOrganizationId: string } }>(
      baseUrl,
      '/api/v1/portal/auth/register',
      {
        name: `Arbitrary Tenant ${orgCode}`,
        razaoSocial: `Arbitrary Tenant ${orgCode} LTDA`,
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
    const controlPlaneOrganizationId = orgRes.body.organization.controlPlaneOrganizationId;

    const keyRes = await post<{ activationKey: { code: string } }>(
      baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: orgCode },
      auth
    );

    // A real, unrelated Tenant — never assigned to this Organization. If a
    // client-supplied tenantId could influence anything, it would show up
    // as this Tenant's id leaking into the Runtime's derived association.
    const foreignSlug = `t46-23-arbid-foreign-${Date.now().toString(36)}`;
    createdTenantSlugs.push(foreignSlug);
    const foreignTenant = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Foreign Tenant', slug: foreignSlug },
      auth
    );

    // 1. Registration request body carries an extra, unsupported `tenantId`
    // field pointing at the foreign Tenant. RegisterRuntimeInput has no
    // such field — the server has no code path that reads it.
    const dir = mkdtempSync(join(tmpdir(), 'atlas-tenant-assoc-arbid-'));
    let runtimeId: string;
    try {
      const identity = loadOrCreateIdentity(dir);
      const rawRes = await fetch(`${baseUrl}/runtime/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationCode: orgCode,
          activationKey: keyRes.body.activationKey.code,
          runtimeVersion: '1.2.0',
          fingerprint: identity.fingerprint,
          publicKey: identity.publicKeyPem,
          hostname: 'arbid-host',
          os: 'linux',
          tenantId: foreignTenant.body.id, // injected, unsupported field
        }),
      });
      expect(rawRes.status).toBe(201);
      const rawBody = (await rawRes.json()) as { data: { runtimeId: string } };
      runtimeId = rawBody.data.runtimeId;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const runtimeRow = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(runtimeRow?.controlPlaneOrganizationId).toBe(controlPlaneOrganizationId);
    // Still PENDING_TENANT_ASSIGNMENT — the injected tenantId had zero effect.
    expect(runtimeRow?.controlPlaneOrganization?.tenantId).toBeNull();
    expect(runtimeRow?.controlPlaneOrganization?.tenantId).not.toBe(foreignTenant.body.id);

    // 2. The Organization-scoped Runtime lookup ignores an injected
    // `tenantId` query parameter — the route has no such parameter in its
    // contract at all; only the `:id` path segment (the real Organization
    // id) ever determines the result set.
    const withInjectedQuery = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${controlPlaneOrganizationId}/runtimes?tenantId=${foreignTenant.body.id}`,
      auth
    );
    const withoutQuery = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(withInjectedQuery.body.runtimes.map((r) => r.runtimeId).sort()).toEqual(
      withoutQuery.body.runtimes.map((r) => r.runtimeId).sort()
    );
    expect(withInjectedQuery.body.runtimes.some((r) => r.runtimeId === runtimeId)).toBe(true);
  });

  // ─── ATLAS 46.23 — Part G: concurrency ──────────────────────────────────

  it('two concurrent Tenant (re)assignments on the same Organization: both requests complete cleanly, the Organization ends up with exactly one Tenant, and the Runtime derives whichever one won — never a duplicate row, never a crash', async () => {
    const { controlPlaneOrganizationId, runtimeId } = await registerPortalOrgAndRuntime(
      baseUrl,
      auth,
      'CONCA'
    );

    const slugA = `t46-23-conc-a-${Date.now().toString(36)}`;
    const slugB = `t46-23-conc-b-${Date.now().toString(36)}`;
    createdTenantSlugs.push(slugA, slugB);
    const tenantA = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Concurrent Tenant A', slug: slugA },
      auth
    );
    const tenantB = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Concurrent Tenant B', slug: slugB },
      auth
    );

    const [resA, resB] = await Promise.all([
      patchOrganizationTenant(controlPlaneOrganizationId, tenantA.body.id),
      patchOrganizationTenant(controlPlaneOrganizationId, tenantB.body.id),
    ]);
    // Neither request should ever crash (no 5xx) — a normal last-write-wins
    // race on a single scalar FK column is an acceptable, non-corrupting
    // outcome; there is no multi-row invariant here to protect.
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const finalOrg = await prisma.organization.findUnique({
      where: { id: controlPlaneOrganizationId },
    });
    expect([tenantA.body.id, tenantB.body.id]).toContain(finalOrg?.tenantId);

    // Exactly one Organization row, exactly one RuntimeRegistration row —
    // no duplicate/partial writes from the race.
    const orgCount = await prisma.organization.count({
      where: { id: controlPlaneOrganizationId },
    });
    const runtimeCount = await prisma.runtimeRegistration.count({ where: { id: runtimeId } });
    expect(orgCount).toBe(1);
    expect(runtimeCount).toBe(1);

    const runtimeRow = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(runtimeRow?.controlPlaneOrganization?.tenantId).toBe(finalOrg?.tenantId);
  });
});
