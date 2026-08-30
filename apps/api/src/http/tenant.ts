import type { RouteContext } from './router.js';

/** Thrown when a multi-tenant route cannot resolve an explicit tenant from the request. */
export class MissingTenantError extends Error {
  readonly status = 400;
  readonly code = 'TENANT_REQUIRED';

  constructor() {
    super(
      'Tenant not identified: provide the "x-tenant-id" header or a "tenantId" query parameter'
    );
    this.name = 'MissingTenantError';
  }
}

/**
 * Resolves the tenant for the current request. Throws MissingTenantError if no
 * explicit tenant was provided — callers must never substitute a default tenant.
 *
 * ATLAS 46.26 — this reads a value the CLIENT supplies (header/query/body),
 * never verified against the caller's own identity. Safe only for routes
 * that don't use the result to authorize access to another party's data
 * (e.g. a route that's itself still gated by a stronger, object-level
 * check downstream). For anything that returns or mutates tenant-owned
 * data, use requireOrgId() below instead — see the audit in
 * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md's "ATLAS 46.26" section
 * for why this distinction matters (a real BOLA was found and fixed where
 * routes used this value directly for authorization).
 */
export function requireTenantId(ctx: RouteContext, bodyTenantId?: string): string {
  const header = ctx.headers['x-tenant-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const tenantId = fromHeader || ctx.query.get('tenantId') || bodyTenantId;
  if (!tenantId) {
    throw new MissingTenantError();
  }
  return tenantId;
}

/** Thrown when an authenticated session has no organization linked to it. */
export class MissingOrganizationError extends Error {
  readonly status = 403;
  readonly code = 'ORGANIZATION_NOT_LINKED';

  constructor() {
    super('Authenticated session has no associated organization');
    this.name = 'MissingOrganizationError';
  }
}

/**
 * ATLAS 46.26 — the session-derived counterpart to requireTenantId(). Reads
 * `ctx.orgId`, which middleware/auth.ts's global authMiddleware sets from
 * the caller's verified JWT (`app_metadata.organization_id`) before any
 * route handler runs — never from a client-supplied header, query
 * parameter, or request body. Use this for any endpoint whose response or
 * mutation is scoped to "the caller's own tenant/organization" — the
 * value can never be substituted by an attacker the way requireTenantId's
 * can.
 */
export function requireOrgId(ctx: RouteContext): string {
  if (!ctx.orgId) {
    throw new MissingOrganizationError();
  }
  return ctx.orgId;
}
