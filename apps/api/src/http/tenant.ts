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
