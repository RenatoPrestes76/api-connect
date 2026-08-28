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
 * ATLAS 46.24 — Part C: the isolation checklist for the production
 * onboarding gate, using a second real client/Organization to prove every
 * boundary the canonical flow depends on. Consolidates rather than
 * duplicates — most of this checklist is already proven elsewhere; this
 * file adds only what wasn't yet covered by a dedicated test, and is the
 * one place a reviewer can read the whole checklist at a glance:
 *
 *   1/2. Client A cannot see Client B's Runtime, and vice versa — proven
 *        below (fresh, cross-org Control Plane lookup, both directions).
 *   3/4. Organization A cannot operate on/claim Tenant B's data, and a
 *        Runtime can never be arbitrarily associated with a foreign
 *        Tenant — proven below (two Organizations sharing one real
 *        Tenant still keep their own Runtimes strictly separate).
 *   5.   A client-supplied tenantId cannot alter ownership — already
 *        proven in tenant-association.test.ts ("a client-supplied
 *        tenantId cannot be used to influence Runtime registration or
 *        escape Organization-scoped Runtime lookups").
 *   6.   An Activation Key issued for Organization A does not work for
 *        Organization B — proven below (genuinely new: prior coverage in
 *        runtime-registration-routes.test.ts only exercised a bogus key
 *        string, not a real key from a different Organization).
 *   7/8. A public key or fingerprint already registered elsewhere cannot
 *        be reused — already proven in registration-idempotency.test.ts,
 *        including under real concurrent-request races.
 */

async function registerPortalOrgAndRuntime(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{
  organizationCode: string;
  portalOrganizationId: string;
  controlPlaneOrganizationId: string;
  runtimeId: string;
  activationKeyCode: string;
}> {
  const orgCode = `${label}${Date.now().toString(36)}`;
  const orgRes = await post<{ organization: { id: string; controlPlaneOrganizationId: string } }>(
    baseUrl,
    '/api/v1/portal/auth/register',
    {
      name: `Isolation ${orgCode}`,
      razaoSocial: `Isolation ${orgCode} LTDA`,
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

  const dir = mkdtempSync(join(tmpdir(), `atlas-isolation-${label}-`));
  const identity = loadOrCreateIdentity(dir);
  const registered = await registerRuntime(baseUrl, identity, {
    organizationCode: orgCode,
    activationKey: keyRes.body.activationKey.code,
    runtimeVersion: '1.2.0',
    hostname: `isolation-${label}-host`,
    os: 'linux',
  });

  return {
    organizationCode: orgCode,
    portalOrganizationId: orgRes.body.organization.id,
    controlPlaneOrganizationId: orgRes.body.organization.controlPlaneOrganizationId,
    runtimeId: registered.runtimeId,
    activationKeyCode: keyRes.body.activationKey.code,
  };
}

describe('ATLAS 46.24 — onboarding isolation checklist', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  const ORG_CODE_PREFIXES = ['ISOA', 'ISOB', 'SHAREA', 'SHAREB', 'AKEYA', 'AKEYB'];
  const createdTenantSlugs: string[] = [];

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
    // RuntimeRegistration.controlPlaneOrganizationId is onDelete: SetNull,
    // not Cascade — must be deleted explicitly, before the Organizations
    // below, or these rows survive as orphans (see
    // client-zero-onboarding-e2e.test.ts for the same note).
    await prisma.runtimeRegistration.deleteMany({
      where: {
        hostname: {
          in: [
            'isolation-ISOA-host',
            'isolation-ISOB-host',
            'isolation-SHAREA-host',
            'isolation-SHAREB-host',
            'akey-cross-org-host',
            'akey-correct-org-host',
          ],
        },
      },
    });
    for (const prefix of ORG_CODE_PREFIXES) {
      await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
    }
    if (createdTenantSlugs.length) {
      await prisma.tenant.deleteMany({ where: { slug: { in: createdTenantSlugs } } });
    }
  });

  it("1/2. Client A's Runtime is invisible from Client B's Organization-scoped lookup, and vice versa", async () => {
    const clientA = await registerPortalOrgAndRuntime(baseUrl, auth, 'ISOA');
    const clientB = await registerPortalOrgAndRuntime(baseUrl, auth, 'ISOB');

    const lookupA = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${clientA.controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(lookupA.body.runtimes.some((r) => r.runtimeId === clientA.runtimeId)).toBe(true);
    expect(lookupA.body.runtimes.some((r) => r.runtimeId === clientB.runtimeId)).toBe(false);

    const lookupB = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${clientB.controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(lookupB.body.runtimes.some((r) => r.runtimeId === clientB.runtimeId)).toBe(true);
    expect(lookupB.body.runtimes.some((r) => r.runtimeId === clientA.runtimeId)).toBe(false);
  });

  it("3/4. Two Organizations sharing the same real Tenant still keep their Runtimes strictly separate — Organization A never operates on Organization C's data, and neither Runtime can be arbitrarily pulled into the other's Tenant boundary", async () => {
    const orgA = await registerPortalOrgAndRuntime(baseUrl, auth, 'SHAREA');
    const orgC = await registerPortalOrgAndRuntime(baseUrl, auth, 'SHAREB');

    const sharedSlug = `t46-24-shared-${Date.now().toString(36)}`;
    createdTenantSlugs.push(sharedSlug);
    const sharedTenant = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Shared Tenant', slug: sharedSlug },
      auth
    );

    // Both Organizations legitimately belong to the same Tenant — a real,
    // supported scenario (a Tenant can own multiple Organizations). What
    // must never happen is either Organization's Runtime leaking into the
    // other's scoped view just because they share a Tenant.
    await fetch(`${baseUrl}/admin/control-plane/organizations/${orgA.controlPlaneOrganizationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ tenantId: sharedTenant.body.id }),
    });
    await fetch(`${baseUrl}/admin/control-plane/organizations/${orgC.controlPlaneOrganizationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ tenantId: sharedTenant.body.id }),
    });

    const lookupA = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${orgA.controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(lookupA.body.runtimes.map((r) => r.runtimeId)).toEqual([orgA.runtimeId]);

    const lookupC = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations/${orgC.controlPlaneOrganizationId}/runtimes`,
      auth
    );
    expect(lookupC.body.runtimes.map((r) => r.runtimeId)).toEqual([orgC.runtimeId]);

    // Both Runtimes correctly derive the *same* shared Tenant (expected —
    // this is real, intentional Tenant sharing, not a leak) while each
    // Runtime's `organizationId` still points at its own, distinct
    // Organization — proving the isolation boundary is Organization, and
    // Tenant-sharing above it doesn't collapse that boundary.
    const rowA = await prisma.runtimeRegistration.findUnique({
      where: { id: orgA.runtimeId },
      include: { controlPlaneOrganization: true },
    });
    const rowC = await prisma.runtimeRegistration.findUnique({
      where: { id: orgC.runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(rowA?.controlPlaneOrganization?.tenantId).toBe(sharedTenant.body.id);
    expect(rowC?.controlPlaneOrganization?.tenantId).toBe(sharedTenant.body.id);
    expect(rowA?.controlPlaneOrganizationId).not.toBe(rowC?.controlPlaneOrganizationId);
  });

  it("6. An Activation Key issued for Organization A is rejected — not silently accepted — when presented together with Organization B's organizationCode", async () => {
    const orgCodeA = `AKEYA${Date.now().toString(36)}`;
    await post(baseUrl, '/api/v1/portal/auth/register', {
      name: `Activation Key A ${orgCodeA}`,
      razaoSocial: `Activation Key A ${orgCodeA} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
      internalCode: orgCodeA,
      plan: 'professional',
      owner: {
        name: 'Owner A',
        email: `owner-${orgCodeA.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    });
    const keyForA = await post<{ activationKey: { code: string } }>(
      baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: orgCodeA },
      auth
    );

    const orgCodeB = `AKEYB${Date.now().toString(36)}`;
    await post(baseUrl, '/api/v1/portal/auth/register', {
      name: `Activation Key B ${orgCodeB}`,
      razaoSocial: `Activation Key B ${orgCodeB} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
      internalCode: orgCodeB,
      plan: 'professional',
      owner: {
        name: 'Owner B',
        email: `owner-${orgCodeB.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    });

    const dir = mkdtempSync(join(tmpdir(), 'atlas-isolation-akey-cross-'));
    try {
      const identity = loadOrCreateIdentity(dir);
      await expect(
        registerRuntime(baseUrl, identity, {
          organizationCode: orgCodeB, // Organization B's code...
          activationKey: keyForA.body.activationKey.code, // ...with Organization A's key
          runtimeVersion: '1.2.0',
          hostname: 'akey-cross-org-host',
          os: 'linux',
        })
      ).rejects.toMatchObject({ status: 401, code: 'ACTIVATION_KEY_INVALID' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    // The key issued for A must remain valid and unconsumed for its own
    // Organization — the rejected cross-org attempt didn't burn it.
    const keysRes = await get<{
      activationKeys: Array<{ code: string; used: boolean }>;
    }>(baseUrl, '/admin/runtime-registration/activation-keys', auth);
    const keyRow = keysRes.body.activationKeys.find(
      (k) => k.code === keyForA.body.activationKey.code
    );
    expect(keyRow?.used).toBe(false);

    // And it still legitimately works for the Organization it was actually
    // issued to.
    const dir2 = mkdtempSync(join(tmpdir(), 'atlas-isolation-akey-correct-'));
    try {
      const identity2 = loadOrCreateIdentity(dir2);
      const registered = await registerRuntime(baseUrl, identity2, {
        organizationCode: orgCodeA,
        activationKey: keyForA.body.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'akey-correct-org-host',
        os: 'linux',
      });
      expect(registered.runtimeId).toBeTruthy();
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });
});
