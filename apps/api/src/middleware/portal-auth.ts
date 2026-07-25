/**
 * Portal auth guards for the tenant self-service organization surface.
 * Composable route wrappers, not a global middleware — mirrors
 * middleware/admin-auth.ts exactly, scoped to portal-identity instead of
 * admin-identity.
 *
 * Chain: valida JWT → valida sessão (usuário ainda ativo) → valida
 * permissões (apenas em requirePortalPermission) → permite acesso.
 */
import type { RouteContext, RouteHandler } from '../http/router.js';
import { apiError } from '../http/router.js';
import { verifyPortalSessionToken } from '../modules/portal-identity/jwt.js';
import { portalIdentityStore } from '../modules/portal-identity/portal-identity-store.js';
import { ROLE_PERMISSIONS } from '../modules/portal-identity/permissions.js';
import type { PortalPermissionKey } from '../modules/portal-identity/types.js';

function extractBearerToken(ctx: RouteContext): string | null {
  const header = ctx.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
}

export function requirePortalAuth(handler: RouteHandler): RouteHandler {
  return async (ctx, res) => {
    const token = extractBearerToken(ctx);
    if (!token) {
      return apiError(res, 'Missing portal session token', 401, 'UNAUTHENTICATED');
    }
    const payload = await verifyPortalSessionToken(token);
    if (!payload) {
      return apiError(res, 'Invalid or expired portal session', 401, 'INVALID_SESSION');
    }

    const user = portalIdentityStore.findUserById(payload.sub);
    if (!user || user.status !== 'active') {
      return apiError(res, 'Portal session is no longer valid', 401, 'SESSION_REVOKED');
    }

    ctx.portalUserId = user.id;
    ctx.portalOrganizationId = user.organizationId;
    ctx.portalRole = user.role;
    ctx.portalEmail = user.email;
    ctx.portalPermissions = ROLE_PERMISSIONS[user.role];

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
