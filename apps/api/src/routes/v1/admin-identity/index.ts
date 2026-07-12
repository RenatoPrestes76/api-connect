import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { hashPassword, verifyPassword } from '../../../modules/admin-identity/password.js';
import {
  signAdminAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../../../modules/admin-identity/jwt.js';
import { loginRateLimiter } from '../../../modules/admin-identity/rate-limiter.js';
import { requireAdminAuth, requirePermission } from '../../../middleware/admin-auth.js';

function clientIp(ctx: RouteContext): string {
  const header = ctx.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(',')[0]?.trim() ?? 'unknown';
}

function userAgent(ctx: RouteContext): string {
  const header = ctx.headers['user-agent'];
  return (Array.isArray(header) ? header[0] : header) ?? 'unknown';
}

export function registerAdminIdentityRoutes(router: { get: Function; post: Function }): void {
  // ─── POST /admin/auth/login ────────────────────────────────────────────
  router.post('/admin/auth/login', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as { email?: string; password?: string } | undefined;
    const email = body?.email?.trim();
    const password = body?.password;
    if (!email || !password) {
      return apiError(res, 'email and password are required', 400, 'MISSING_FIELDS');
    }

    const ip = clientIp(ctx);

    if (loginRateLimiter.isLocked(email, ip)) {
      adminIdentityStore.recordAudit({ action: 'ACCOUNT_LOCKED', actorEmail: email, ip });
      return apiError(
        res,
        'Too many failed login attempts. Try again in 15 minutes.',
        423,
        'ACCOUNT_LOCKED'
      );
    }

    const user = adminIdentityStore.findUserByEmail(email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      loginRateLimiter.recordFailure(email, ip);
      adminIdentityStore.recordLoginAttempt(email, ip, false);
      adminIdentityStore.recordAudit({ action: 'LOGIN_FAILED', actorEmail: email, ip });
      return apiError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === 'disabled') {
      adminIdentityStore.recordLoginAttempt(email, ip, false);
      adminIdentityStore.recordAudit({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        actorEmail: email,
        ip,
        metadata: { reason: 'disabled' },
      });
      return apiError(res, 'This account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    if (user.status === 'suspended') {
      adminIdentityStore.recordLoginAttempt(email, ip, false);
      adminIdentityStore.recordAudit({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        actorEmail: email,
        ip,
        metadata: { reason: 'suspended' },
      });
      return apiError(res, 'This account is suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    loginRateLimiter.recordSuccess(email, ip);
    adminIdentityStore.recordLoginAttempt(email, ip, true);
    adminIdentityStore.recordLogin(user.id);

    const role = adminIdentityStore.getRoleById(user.roleId);
    if (!role) return apiError(res, 'Admin role not found', 500, 'INTERNAL_ERROR');

    const accessToken = await signAdminAccessToken({
      sub: user.id,
      role: role.name,
      name: user.name,
      email: user.email,
    });
    const refreshToken = generateRefreshToken();
    adminIdentityStore.createSession(user.id, refreshToken, ip, userAgent(ctx));
    adminIdentityStore.recordAudit({
      action: 'LOGIN',
      actorId: user.id,
      actorEmail: user.email,
      ip,
    });

    json(res, {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      mustChangePassword: user.mustChangePassword,
    });
  });

  // ─── POST /admin/auth/logout ────────────────────────────────────────────
  router.post('/admin/auth/logout', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as { refreshToken?: string } | undefined;
    if (!body?.refreshToken) {
      return apiError(res, 'refreshToken is required', 400, 'MISSING_FIELDS');
    }

    const session = adminIdentityStore.findActiveSessionByRefreshToken(body.refreshToken);
    adminIdentityStore.revokeSessionByRefreshToken(body.refreshToken);

    if (session) {
      const user = adminIdentityStore.findUserById(session.adminUserId);
      adminIdentityStore.recordAudit({
        action: 'LOGOUT',
        actorId: session.adminUserId,
        actorEmail: user?.email ?? 'unknown',
        ip: clientIp(ctx),
      });
    }

    json(res, { success: true });
  });

  // ─── POST /admin/auth/refresh ───────────────────────────────────────────
  router.post('/admin/auth/refresh', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as { refreshToken?: string } | undefined;
    if (!body?.refreshToken) {
      return apiError(res, 'refreshToken is required', 400, 'MISSING_FIELDS');
    }

    const session = adminIdentityStore.findActiveSessionByRefreshToken(body.refreshToken);
    if (!session) {
      return apiError(res, 'Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = adminIdentityStore.findUserById(session.adminUserId);
    if (!user || user.status !== 'active') {
      return apiError(res, 'Admin session is no longer valid', 401, 'SESSION_REVOKED');
    }

    const role = adminIdentityStore.getRoleById(user.roleId);
    if (!role) return apiError(res, 'Admin role not found', 500, 'INTERNAL_ERROR');

    // Rotate: revoke the old session, issue a fresh refresh token + session.
    adminIdentityStore.revokeSession(session.id);
    const newRefreshToken = generateRefreshToken();
    adminIdentityStore.createSession(user.id, newRefreshToken, clientIp(ctx), userAgent(ctx));

    const accessToken = await signAdminAccessToken({
      sub: user.id,
      role: role.name,
      name: user.name,
      email: user.email,
    });

    adminIdentityStore.recordAudit({
      action: 'REFRESH_TOKEN',
      actorId: user.id,
      actorEmail: user.email,
      ip: clientIp(ctx),
    });

    json(res, { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  });

  // ─── GET /admin/auth/me ─────────────────────────────────────────────────
  router.get(
    '/admin/auth/me',
    requireAdminAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const user = adminIdentityStore.findUserById(ctx.adminUserId as string);
      if (!user) return apiError(res, 'Admin user not found', 404, 'USER_NOT_FOUND');
      const dto = adminIdentityStore.toDTO(user);
      json(res, {
        id: dto.id,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        permissions: dto.permissions,
        mustChangePassword: dto.mustChangePassword,
      });
    })
  );

  // ─── POST /admin/auth/change-password ──────────────────────────────────
  router.post(
    '/admin/auth/change-password',
    requireAdminAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as { currentPassword?: string; newPassword?: string } | undefined;
      if (!body?.currentPassword || !body?.newPassword) {
        return apiError(res, 'currentPassword and newPassword are required', 400, 'MISSING_FIELDS');
      }
      if (body.newPassword.length < 8) {
        return apiError(res, 'newPassword must be at least 8 characters', 400, 'WEAK_PASSWORD');
      }

      const user = adminIdentityStore.findUserById(ctx.adminUserId as string);
      if (!user) return apiError(res, 'Admin user not found', 404, 'USER_NOT_FOUND');

      const valid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!valid) return apiError(res, 'Current password is incorrect', 401, 'INVALID_CREDENTIALS');

      const newHash = await hashPassword(body.newPassword);
      adminIdentityStore.setPassword(user.id, newHash);
      adminIdentityStore.recordAudit({
        action: 'PASSWORD_CHANGED',
        actorId: user.id,
        actorEmail: user.email,
        ip: clientIp(ctx),
      });

      json(res, { success: true });
    })
  );

  // ─── GET /admin/audit-log ───────────────────────────────────────────────
  router.get(
    '/admin/audit-log',
    requirePermission('audit.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const limit = ctx.query.get('limit') ? Number(ctx.query.get('limit')) : 50;
      const entries = adminIdentityStore.getAuditLog({
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50,
      });
      json(res, { entries, total: entries.length });
    })
  );
}
