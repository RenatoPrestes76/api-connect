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

/** Builds a tenant-scoped `where` clause, merging in any additional filters. */
export function buildWhere(extra?: Record<string, unknown>): Record<string, unknown> {
  const { tenantId } = getTenantContext();
  return { tenantId, ...(extra ?? {}) };
}

/** Translates RepositoryCriteria into tenant-scoped Prisma findMany args. */
export function buildFindManyArgs(criteria?: RepositoryCriteria): PrismaFindManyArgs {
  const args: PrismaFindManyArgs = { where: buildWhere(criteria?.filters) };

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
