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
