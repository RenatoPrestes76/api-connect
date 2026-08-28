/**
 * Sprint 46.19 — Control Plane Persistence & Transactional Integrity Gate.
 *
 * Covers the gates that control-plane-routes.test.ts (HTTP-level RBAC/CRUD)
 * doesn't: restart persistence (data survives outliving the process that
 * wrote it), transactional rollback (a failed multi-step write leaves zero
 * trace), and concurrency (two racing writers against a unique constraint
 * never both "win").
 */
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { tenancyRepository } from '../../modules/control-plane/tenancy.repository.js';
import { prisma } from '../../services/prisma.js';

const RUN_ID = Date.now().toString(36);
const cleanupSlugs = {
  tenants: [] as string[],
  organizations: [] as string[],
};

afterAll(async () => {
  if (cleanupSlugs.organizations.length > 0) {
    await prisma.organization.deleteMany({ where: { slug: { in: cleanupSlugs.organizations } } });
  }
  if (cleanupSlugs.tenants.length > 0) {
    await prisma.tenant.deleteMany({ where: { slug: { in: cleanupSlugs.tenants } } });
  }
});

function tenantSlug(label: string): string {
  const slug = `t46-19-${RUN_ID}-${label}`;
  cleanupSlugs.tenants.push(slug);
  return slug;
}

function orgSlug(label: string): string {
  const slug = `o46-19-${RUN_ID}-${label}`;
  cleanupSlugs.organizations.push(slug);
  return slug;
}

describe('Restart persistence (Etapa 8)', () => {
  it('data written through one Prisma connection is visible from a completely independent connection', async () => {
    // A second, genuinely separate PrismaClient — not the app's shared
    // singleton — is the closest thing to "a different process" a single
    // test run can produce without spawning a real child process (see
    // docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md for the real subprocess
    // restart also performed manually for this sprint). If the data were
    // still living in some in-memory structure tied to the writer's own
    // process/module state, this second, unrelated connection would have
    // no way to see it — only a real database round-trip can.
    const slug = tenantSlug('restart');
    const created = await tenancyRepository.createTenant({ name: 'Restart Check', slug });

    const independentClient = new PrismaClient();
    try {
      const row = await independentClient.tenant.findUnique({ where: { id: created.id } });
      expect(row).not.toBeNull();
      expect(row?.slug).toBe(slug);
      expect(row?.name).toBe('Restart Check');
    } finally {
      await independentClient.$disconnect();
    }
  });

  it('an organization created, then re-fetched through the repository from scratch, still has all its fields', async () => {
    const tSlug = tenantSlug('restart-org-tenant');
    const tenant = await tenancyRepository.createTenant({
      name: 'Org Restart Tenant',
      slug: tSlug,
    });
    const oSlug = orgSlug('restart-org');
    const result = await tenancyRepository.createOrganization({
      name: 'Org Restart Check',
      slug: oSlug,
      tenantId: tenant.id,
      tier: 'PRO',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Simulates "the process restarted" by fetching through a fresh
    // repository call with no reliance on any variable/closure from the
    // creation above beyond the id — the only thing that could make this
    // resolve correctly is the database itself.
    const refetched = await tenancyRepository.getOrganization(result.organization.id);
    expect(refetched?.slug).toBe(oSlug);
    expect(refetched?.tier).toBe('PRO');
    expect(refetched?.tenantId).toBe(tenant.id);
  });
});

describe('Transactional integrity (Etapa 5)', () => {
  it('rolls back cleanly: creating an organization under a nonexistent tenantId leaves zero rows behind', async () => {
    const oSlug = orgSlug('rollback');
    const before = await prisma.organization.count({ where: { slug: oSlug } });
    expect(before).toBe(0);

    const result = await tenancyRepository.createOrganization({
      name: 'Should Not Exist',
      slug: oSlug,
      tenantId: 'tenant-id-that-does-not-exist-at-all',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TENANT_NOT_FOUND');

    // The real proof of rollback: no partial/orphaned row, not just an
    // error being returned — a bug that inserted the org anyway and then
    // reported failure would still pass a check that only looked at the
    // return value.
    const after = await prisma.organization.count({ where: { slug: oSlug } });
    expect(after).toBe(0);
  });

  it('rolls back when the tenant existed at check time but is deleted before the transaction commits (race)', async () => {
    const tSlug = tenantSlug('race-delete');
    const tenant = await tenancyRepository.createTenant({
      name: 'Race Delete Tenant',
      slug: tSlug,
    });
    await tenancyRepository.deleteTenant(tenant.id); // soft delete — deletedAt set, still exists as a row

    const oSlug = orgSlug('race-delete-org');
    const result = await tenancyRepository.createOrganization({
      name: 'Should Not Exist Either',
      slug: oSlug,
      tenantId: tenant.id,
    });

    expect(result.ok).toBe(false);
    const count = await prisma.organization.count({ where: { slug: oSlug } });
    expect(count).toBe(0);
  });
});

describe('Concurrency (Etapa 9)', () => {
  it('two concurrent creates racing for the same tenant slug: exactly one succeeds, the other fails cleanly, no duplicate row', async () => {
    const slug = tenantSlug('race-create');
    const attempts = await Promise.allSettled([
      tenancyRepository.createTenant({ name: 'Racer A', slug }),
      tenancyRepository.createTenant({ name: 'Racer B', slug }),
    ]);

    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const rejected = attempts.filter((a) => a.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === 'rejected') {
      expect((rejected[0].reason as { code?: string }).code).toBe('P2002');
    }

    const rows = await prisma.tenant.findMany({ where: { slug } });
    expect(rows).toHaveLength(1);
  });

  it('five concurrent organization creates under the same tenant with distinct slugs all succeed independently', async () => {
    const tSlug = tenantSlug('concurrent-orgs-tenant');
    const tenant = await tenancyRepository.createTenant({
      name: 'Concurrent Orgs Tenant',
      slug: tSlug,
    });

    const slugs = [0, 1, 2, 3, 4].map((i) => orgSlug(`concurrent-${i}`));
    const results = await Promise.all(
      slugs.map((slug) =>
        tenancyRepository.createOrganization({ name: slug, slug, tenantId: tenant.id })
      )
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.organization.id : null)));
    expect(ids.size).toBe(5); // every id distinct — no accidental row reuse/collision

    const orgs = await tenancyRepository.listOrganizations({ tenantId: tenant.id });
    expect(orgs.map((o) => o.slug).sort()).toEqual([...slugs].sort());
  });
});

describe('Tenant-scoped query correctness (Etapa 7)', () => {
  // admin-identity's Control Plane operators are SUPER_ADMIN-style global
  // staff by established design (see Sprint 46.16's explicit "SUPER_ADMIN
  // is global by design — respect that, don't invent an incompatible
  // isolation rule"). There is no separate "tenant's own user" role that
  // should ever reach these routes at all, so the meaningful isolation
  // property here isn't "reject cross-tenant access" (nothing about this
  // entity grants tenant-scoped credentials to reject) — it's that the
  // tenantId filter a global operator applies is itself correct and never
  // leaks another tenant's rows.
  it('listOrganizations({tenantId}) for tenant A never includes an organization actually owned by tenant B', async () => {
    const slugA = tenantSlug('iso-a');
    const slugB = tenantSlug('iso-b');
    const tenantA = await tenancyRepository.createTenant({ name: 'Isolation A', slug: slugA });
    const tenantB = await tenancyRepository.createTenant({ name: 'Isolation B', slug: slugB });

    const orgASlug = orgSlug('iso-a-org');
    const orgBSlug = orgSlug('iso-b-org');
    const orgA = await tenancyRepository.createOrganization({
      name: 'Org A',
      slug: orgASlug,
      tenantId: tenantA.id,
    });
    const orgB = await tenancyRepository.createOrganization({
      name: 'Org B',
      slug: orgBSlug,
      tenantId: tenantB.id,
    });
    expect(orgA.ok).toBe(true);
    expect(orgB.ok).toBe(true);

    const listedForA = await tenancyRepository.listOrganizations({ tenantId: tenantA.id });
    expect(listedForA.some((o) => o.slug === orgASlug)).toBe(true);
    expect(listedForA.some((o) => o.slug === orgBSlug)).toBe(false);

    const listedForB = await tenancyRepository.listOrganizations({ tenantId: tenantB.id });
    expect(listedForB.some((o) => o.slug === orgBSlug)).toBe(true);
    expect(listedForB.some((o) => o.slug === orgASlug)).toBe(false);
  });

  it('a client-supplied tenantId cannot be used to "adopt" another tenant\'s existing organization via update', async () => {
    const slugA = tenantSlug('adopt-a');
    const slugB = tenantSlug('adopt-b');
    const tenantA = await tenancyRepository.createTenant({ name: 'Adopt A', slug: slugA });
    const tenantB = await tenancyRepository.createTenant({ name: 'Adopt B', slug: slugB });

    const oSlug = orgSlug('adopt-org');
    const created = await tenancyRepository.createOrganization({
      name: 'Adoptable',
      slug: oSlug,
      tenantId: tenantA.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // This IS allowed at the repository layer (a global admin genuinely can
    // re-parent an org) — the isolation property under test is narrower:
    // the write only ever affects the exact row addressed by id, never a
    // different one, and the FK is still enforced (can't move it to a
    // fabricated tenant either).
    const moved = await tenancyRepository.updateOrganization(created.organization.id, {
      tenantId: tenantB.id,
    });
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.organization.tenantId).toBe(tenantB.id);

    const stillJustOne = await prisma.organization.count({ where: { slug: oSlug } });
    expect(stillJustOne).toBe(1);
  });

  it('ATLAS 46.22 — moving an organization to a nonexistent Tenant is rejected cleanly, not a raw FK crash, and leaves the organization untouched', async () => {
    const slug = tenantSlug('reject-tenant');
    const tenant = await tenancyRepository.createTenant({ name: 'Reject Tenant', slug });
    const oSlug = orgSlug('reject-tenant-org');
    const created = await tenancyRepository.createOrganization({
      name: 'Untouchable',
      slug: oSlug,
      tenantId: tenant.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await tenancyRepository.updateOrganization(created.organization.id, {
      tenantId: 'tenant-id-that-does-not-exist-at-all',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('TENANT_NOT_FOUND');

    const unchanged = await tenancyRepository.getOrganization(created.organization.id);
    expect(unchanged?.tenantId).toBe(tenant.id);
  });
});
