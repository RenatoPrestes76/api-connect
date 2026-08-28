import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { hashPassword, verifyPassword } from '../../../modules/portal-identity/password.js';
import { signPortalSessionToken } from '../../../modules/portal-identity/jwt.js';
import { requirePortalAuth } from '../../../middleware/portal-auth.js';
import { ROLE_PERMISSIONS } from '../../../modules/portal-identity/permissions.js';
import type { OrganizationPlan } from '../../../modules/portal-identity/types.js';

interface RegisterBody {
  name?: string;
  razaoSocial?: string;
  cnpj?: string;
  internalCode?: string;
  plan?: OrganizationPlan;
  owner?: { name?: string; email?: string; password?: string };
}

interface LoginBody {
  email?: string;
  password?: string;
}

export function registerPortalAuthRoutes(router: Router): void {
  router.post('/api/v1/portal/auth/register', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body ?? {}) as RegisterBody;
    const { name, razaoSocial, cnpj, internalCode, plan, owner } = body;

    if (!name || !razaoSocial || !cnpj || !internalCode) {
      return apiError(
        res,
        '"name", "razaoSocial", "cnpj" and "internalCode" are required',
        400,
        'MISSING_FIELDS'
      );
    }
    if (!owner?.name || !owner?.email || !owner?.password) {
      return apiError(
        res,
        'owner.name, owner.email and owner.password are required',
        400,
        'MISSING_FIELDS'
      );
    }
    if (portalIdentityStore.findUserByEmail(owner.email)) {
      return apiError(res, 'Email already in use', 409, 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(owner.password);
    const { organization, owner: ownerUser } = await portalIdentityStore.createOrganization({
      name,
      razaoSocial,
      cnpj,
      internalCode,
      plan,
      owner: { name: owner.name, email: owner.email, passwordHash },
    });

    portalIdentityStore.recordAudit({
      organizationId: organization.id,
      action: 'ORG_CREATED',
      actorId: ownerUser.id,
      actorEmail: ownerUser.email,
      target: organization.id,
    });

    const token = await signPortalSessionToken({
      sub: ownerUser.id,
      organizationId: organization.id,
      role: ownerUser.role,
      name: ownerUser.name,
      email: ownerUser.email,
    });

    json(res, { token, organization, user: portalIdentityStore.toDTO(ownerUser) }, 201);
  });

  router.post('/api/v1/portal/auth/login', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body ?? {}) as LoginBody;
    const { email, password } = body;
    if (!email || !password) {
      return apiError(res, '"email" and "password" are required', 400, 'MISSING_FIELDS');
    }

    const user = portalIdentityStore.findUserByEmail(email);
    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) {
      if (user) {
        portalIdentityStore.recordAudit({
          organizationId: user.organizationId,
          action: 'LOGIN_FAILED',
          actorId: user.id,
          actorEmail: user.email,
        });
      }
      return apiError(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    portalIdentityStore.recordLogin(user.id);
    portalIdentityStore.recordAudit({
      organizationId: user.organizationId,
      action: 'LOGIN',
      actorId: user.id,
      actorEmail: user.email,
    });

    const token = await signPortalSessionToken({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    json(res, { token, user: portalIdentityStore.toDTO(user) });
  });

  router.get(
    '/api/v1/portal/auth/me',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const user = portalIdentityStore.findUserById(ctx.portalUserId as string);
      if (!user) return apiError(res, 'User not found', 404, 'NOT_FOUND');
      json(res, {
        user: portalIdentityStore.toDTO(user),
        permissions: ROLE_PERMISSIONS[user.role],
      });
    })
  );
}
