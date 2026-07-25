/**
 * Portal auth guards for the tenant self-service organization surface.
 * Composable route wrappers, not a global middleware — mirrors
 * middleware/admin-auth.ts, scoped to portal-identity instead of
 * admin-identity.
 *
 * Sprint 46.5: accepts EITHER a user session (Bearer JWT) OR a service API
 * key (X-Api-Key) — see modules/gateway/resolve-identity.ts — so every
 * existing portal route works for service-to-service calls without any
 * per-route change.
 */
import type { RouteContext, RouteHandler } from '../http/router.js';
import { apiError } from '../http/router.js';
import { resolvePortalIdentity } from '../modules/gateway/resolve-identity.js';
import type { PortalPermissionKey } from '../modules/portal-identity/types.js';

/** Resolves and stashes identity onto ctx if not already resolved (e.g. by
 * the global gateway rate-limit/logging middleware) — avoids verifying the
 * same token/API key twice per request. */
export async function ensurePortalIdentity(ctx: RouteContext): Promise<boolean> {
  if (ctx.portalOrganizationId) return true;
  const identity = await resolvePortalIdentity(ctx);
  if (!identity) return false;
  ctx.portalUserId = identity.actorId;
  ctx.portalOrganizationId = identity.organizationId;
  ctx.portalRole = identity.role;
  ctx.portalEmail = identity.actorLabel;
  ctx.portalPermissions = identity.permissions;
  return true;
}

export function requirePortalAuth(handler: RouteHandler): RouteHandler {
  return async (ctx, res) => {
    const ok = await ensurePortalIdentity(ctx);
    if (!ok) {
      return apiError(res, 'Missing or invalid portal credentials', 401, 'UNAUTHENTICATED');
    }
    return handler(ctx, res);
  };
}

/** Wraps a handler with both authentication and a specific permission check. */
export function requirePortalPermission(permission: PortalPermissionKey) {
  return function wrap(handler: RouteHandler): RouteHandler {
    return requirePortalAuth(async (ctx, res) => {
      if (!ctx.portalPermissions?.includes(permission)) {
        return apiError(res, `Missing required permission: ${permission}`, 403, 'FORBIDDEN');
      }
      return handler(ctx, res);
    });
  };
}
