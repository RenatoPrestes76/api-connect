import type { RouteContext } from '../../../http/router.js';

export function parseLimit(raw: string | null, fallback: number, max = 200): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Authenticated caller's tenant, or undefined for an unscoped (platform-admin) caller. */
export function tenantOf(ctx: RouteContext): string | undefined {
  return ctx.orgId;
}

/** A caller with no resolved tenant is a platform-admin and sees everything; a
 *  tenant-scoped caller may only access resources owned by their own tenant. */
export function assertTenantAccess(
  resourceTenantId: string | undefined,
  ctx: RouteContext
): boolean {
  if (!ctx.orgId) return true;
  if (!resourceTenantId) return true;
  return ctx.orgId === resourceTenantId;
}
