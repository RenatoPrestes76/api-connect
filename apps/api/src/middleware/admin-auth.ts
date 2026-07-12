/**
 * Admin auth guards for the Atlas Control Plane identity system.
 * Composable route wrappers, not a global middleware — each protected route
 * opts in explicitly via requireAdminAuth() or requirePermission().
 *
 * Chain: valida JWT → valida sessão (user ainda ativo) → valida role → valida
 * permissões (apenas em requirePermission) → permite acesso.
 */
import type { RouteContext, RouteHandler } from '../http/router.js';
import { apiError } from '../http/router.js';
import { verifyAdminAccessToken } from '../modules/admin-identity/jwt.js';
import { adminIdentityStore } from '../modules/admin-identity/admin-identity-store.js';
import type { PermissionKey } from '../modules/admin-identity/types.js';

function extractBearerToken(ctx: RouteContext): string | null {
  const header = ctx.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7);
}

export function requireAdminAuth(handler: RouteHandler): RouteHandler {
  return async (ctx, res) => {
    // 1. Valida JWT
    const token = extractBearerToken(ctx);
    if (!token) {
      return apiError(res, 'Missing admin session token', 401, 'UNAUTHENTICATED');
    }
    const payload = await verifyAdminAccessToken(token);
    if (!payload) {
      return apiError(res, 'Invalid or expired admin session', 401, 'INVALID_SESSION');
    }

    // 2. Valida sessão — the underlying admin account must still exist and be active
    const user = adminIdentityStore.findUserById(payload.sub);
    if (!user || user.status !== 'active') {
      return apiError(res, 'Admin session is no longer valid', 401, 'SESSION_REVOKED');
    }

    // 3. Valida Role
    const role = adminIdentityStore.getRoleById(user.roleId);
    if (!role) {
      return apiError(res, 'Admin role not found', 403, 'INVALID_ROLE');
    }

    ctx.adminUserId = user.id;
    ctx.adminEmail = user.email;
    ctx.adminRole = role.name;
    ctx.adminPermissions = adminIdentityStore.getPermissionsForRole(user.roleId);

    // 4. Permite acesso
    return handler(ctx, res);
  };
}

/** Wraps a handler with both authentication and a specific permission check. */
export function requirePermission(permission: PermissionKey) {
  return function wrap(handler: RouteHandler): RouteHandler {
    return requireAdminAuth(async (ctx, res) => {
      if (!ctx.adminPermissions?.includes(permission)) {
        return apiError(res, `Missing required permission: ${permission}`, 403, 'FORBIDDEN');
      }
      return handler(ctx, res);
    });
  };
}
