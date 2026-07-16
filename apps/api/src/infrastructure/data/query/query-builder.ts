/**
 * Generic query support — translates a @seltriva/core RepositoryCriteria into
 * Prisma find args, always scoped to the ambient TenantContext. No caller can
 * construct a query that reaches beyond its own tenant.
 */
import type { RepositoryCriteria } from '@seltriva/core';
import { getTenantContext } from '../tenant-context.js';

export interface PrismaFindManyArgs {
  where: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}

/**
 * Builds a tenant-scoped `where` clause, merging in any additional filters.
 * `tenantField` lets a repository scope by a differently-named column (e.g.
 * `organizationId`) when the table has no literal `tenantId` field — the
 * ambient TenantContext is still the single source of truth either way.
 */
export function buildWhere(
  extra?: Record<string, unknown>,
  tenantField = 'tenantId'
): Record<string, unknown> {
  const { tenantId } = getTenantContext();
  return { [tenantField]: tenantId, ...(extra ?? {}) };
}

/** Translates RepositoryCriteria into tenant-scoped Prisma findMany args. */
export function buildFindManyArgs(
  criteria?: RepositoryCriteria,
  tenantField = 'tenantId'
): PrismaFindManyArgs {
  const args: PrismaFindManyArgs = { where: buildWhere(criteria?.filters, tenantField) };

  if (criteria?.orderBy) {
    args.orderBy = { [criteria.orderBy]: criteria.orderDir ?? 'asc' };
  }
  if (criteria?.limit !== undefined) {
    args.take = criteria.limit;
  }
  if (criteria?.offset !== undefined) {
    args.skip = criteria.offset;
  }

  return args;
}
