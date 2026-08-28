/**
 * Sprint 46.19 — Prisma-backed persistence for the Control Plane's Tenant
 * and Organization entities. This is the ONLY file in the Control Plane
 * that touches `prisma.tenant`/`prisma.organization` directly — everything
 * else (control-plane-store.ts, route handlers) goes through this
 * repository, matching the architecture principle this sprint establishes:
 * HTTP -> Handler -> Service/Repository -> Prisma -> PostgreSQL.
 *
 * Project/Workspace/Environment/Runtime/Connector/Deployment/FeatureFlag
 * stay in-memory in control-plane-store.ts for this sprint — see
 * docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md for the scoping rationale.
 */
import { prisma } from '../../services/prisma.js';
import type { Tenant, Organization, TenantStatus, OrganizationStatus } from './types.js';

function toTenant(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
  primaryContactEmail: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    primaryContactEmail: row.primaryContactEmail ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString(),
  };
}

function toOrganization(row: {
  id: string;
  tenantId: string | null;
  slug: string;
  name: string;
  tier: string;
  status: string;
  logoUrl: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Organization {
  return {
    id: row.id,
    tenantId: row.tenantId ?? undefined,
    slug: row.slug,
    name: row.name,
    tier: row.tier as Organization['tier'],
    status: row.status as OrganizationStatus,
    logoUrl: row.logoUrl ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString(),
  };
}

export class TenancyRepository {
  // ─── Tenants ────────────────────────────────────────────────────────────

  async listTenants(filters: { status?: string } = {}): Promise<Tenant[]> {
    const rows = await prisma.tenant.findMany({
      where: { deletedAt: null, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toTenant);
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const row = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    return row ? toTenant(row) : undefined;
  }

  async findTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const row = await prisma.tenant.findFirst({ where: { slug, deletedAt: null } });
    return row ? toTenant(row) : undefined;
  }

  async createTenant(input: {
    name: string;
    slug: string;
    primaryContactEmail?: string;
  }): Promise<Tenant> {
    const row = await prisma.tenant.create({
      data: {
        slug: input.slug,
        name: input.name,
        primaryContactEmail: input.primaryContactEmail ?? null,
      },
    });
    return toTenant(row);
  }

  async updateTenant(
    id: string,
    patch: Partial<Pick<Tenant, 'name' | 'status' | 'primaryContactEmail'>>
  ): Promise<Tenant | null> {
    try {
      const row = await prisma.tenant.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.primaryContactEmail !== undefined
            ? { primaryContactEmail: patch.primaryContactEmail }
            : {}),
        },
      });
      return toTenant(row);
    } catch (err) {
      if (isPrismaNotFoundError(err)) return null;
      throw err;
    }
  }

  async deleteTenant(id: string): Promise<boolean> {
    try {
      await prisma.tenant.update({ where: { id }, data: { deletedAt: new Date() } });
      return true;
    } catch (err) {
      if (isPrismaNotFoundError(err)) return false;
      throw err;
    }
  }

  // ─── Organizations ──────────────────────────────────────────────────────

  async listOrganizations(
    filters: { tenantId?: string; status?: string; tier?: string } = {}
  ): Promise<Organization[]> {
    const rows = await prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.tier ? { tier: filters.tier } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toOrganization);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const row = await prisma.organization.findFirst({ where: { id, deletedAt: null } });
    return row ? toOrganization(row) : undefined;
  }

  async findOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const row = await prisma.organization.findFirst({ where: { slug, deletedAt: null } });
    return row ? toOrganization(row) : undefined;
  }

  /**
   * Wrapped in a transaction so a concurrent tenant deletion can never race
   * with an organization creation under that same tenant — either the
   * tenant-existence check and the insert both happen atomically, or the
   * whole thing rolls back with nothing written. The FK relation Prisma
   * schema already declares (`Organization.tenantId -> Tenant.id`) enforces
   * referential integrity at the database level as a second layer.
   */
  async createOrganization(input: {
    name: string;
    slug: string;
    tenantId?: string;
    tier?: Organization['tier'];
  }): Promise<{ ok: true; organization: Organization } | { ok: false; error: 'TENANT_NOT_FOUND' }> {
    try {
      const row = await prisma.$transaction(async (tx: typeof prisma) => {
        if (input.tenantId) {
          const tenant = await tx.tenant.findFirst({
            where: { id: input.tenantId, deletedAt: null },
          });
          if (!tenant) {
            throw new TenantNotFoundError();
          }
        }
        return tx.organization.create({
          data: {
            slug: input.slug,
            name: input.name,
            tenantId: input.tenantId ?? null,
            tier: input.tier ?? 'FREE',
          },
        });
      });
      return { ok: true, organization: toOrganization(row) };
    } catch (err) {
      if (err instanceof TenantNotFoundError) return { ok: false, error: 'TENANT_NOT_FOUND' };
      throw err;
    }
  }

  /**
   * ATLAS 46.22 — when `patch.tenantId` is a non-null value, it's validated
   * to exist first (in the same transaction as the update), matching
   * createOrganization()'s existing TENANT_NOT_FOUND pattern. Before this,
   * an unknown tenantId here fell through to Prisma's raw FK violation
   * (P2003), caught only by the generic error boundary as an opaque 500 —
   * "fails" per Fase 10's requirement, but not the clean, typed rejection
   * every other invalid-reference case in this repository already gets.
   */
  async updateOrganization(
    id: string,
    patch: Partial<Pick<Organization, 'name' | 'tier' | 'status' | 'tenantId'>>
  ): Promise<
    | { ok: true; organization: Organization }
    | { ok: false; error: 'NOT_FOUND' | 'TENANT_NOT_FOUND' }
  > {
    try {
      const row = await prisma.$transaction(async (tx: typeof prisma) => {
        if (patch.tenantId) {
          const tenant = await tx.tenant.findFirst({
            where: { id: patch.tenantId, deletedAt: null },
          });
          if (!tenant) throw new TenantNotFoundError();
        }
        return tx.organization.update({
          where: { id },
          data: {
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.tier !== undefined ? { tier: patch.tier } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.tenantId !== undefined ? { tenantId: patch.tenantId } : {}),
          },
        });
      });
      return { ok: true, organization: toOrganization(row) };
    } catch (err) {
      if (err instanceof TenantNotFoundError) return { ok: false, error: 'TENANT_NOT_FOUND' };
      if (isPrismaNotFoundError(err)) return { ok: false, error: 'NOT_FOUND' };
      throw err;
    }
  }

  async deleteOrganization(id: string): Promise<boolean> {
    try {
      await prisma.organization.update({ where: { id }, data: { deletedAt: new Date() } });
      return true;
    } catch (err) {
      if (isPrismaNotFoundError(err)) return false;
      throw err;
    }
  }
}

class TenantNotFoundError extends Error {
  constructor() {
    super('Tenant not found for the given tenantId');
    this.name = 'TenantNotFoundError';
  }
}

/** Prisma throws P2025 for update/delete calls whose `where` matched no row. */
function isPrismaNotFoundError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === 'P2025');
}

export const tenancyRepository = new TenancyRepository();
