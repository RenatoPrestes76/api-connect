import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { hashPassword } from '../../../modules/portal-identity/password.js';
import { signPortalSessionToken } from '../../../modules/portal-identity/jwt.js';
import { requirePortalPermission } from '../../../middleware/portal-auth.js';
import type { OrgRole } from '../../../modules/portal-identity/types.js';

const VALID_ROLES: OrgRole[] = ['OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'OPERATOR', 'VIEWER'];

interface InviteBody {
  email?: string;
  name?: string;
  role?: OrgRole;
}

interface AcceptBody {
  password?: string;
}

export function registerPortalInviteRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/api/v1/portal/invites',
    requirePortalPermission('invites.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const invites = portalIdentityStore
        .listInvites(ctx.portalOrganizationId as string)
        .map((i) => portalIdentityStore.inviteToDTO(i));
      json(res, { total: invites.length, invites });
    })
  );

  router.post(
    '/api/v1/portal/invites',
    requirePortalPermission('invites.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body ?? {}) as InviteBody;
      const { email, name, role } = body;
      if (!email || !name) {
        return apiError(res, '"email" and "name" are required', 400, 'MISSING_FIELDS');
      }
      if (!role || !VALID_ROLES.includes(role)) {
        return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
      }
      if (portalIdentityStore.findUserByEmail(email)) {
        return apiError(res, 'Email already belongs to an organization member', 409, 'EMAIL_TAKEN');
      }

      const organizationId = ctx.portalOrganizationId as string;
      const { invite, token } = portalIdentityStore.createInvite({
        organizationId,
        email,
        name,
        role,
        invitedBy: ctx.portalUserId as string,
      });

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'USER_INVITED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: invite.id,
        metadata: { email, role },
      });

      // No email infra exists yet — the invite link is returned directly so
      // the inviter can share it manually (matches the pragmatism already
      // used by the setup wizard, which collects and discards a password).
      json(res, { invite: portalIdentityStore.inviteToDTO(invite), token }, 201);
    })
  );

  router.get('/api/v1/portal/invites/:token', async (ctx: RouteContext, res: ServerResponse) => {
    const invite = portalIdentityStore.findInviteByToken(ctx.params['token'] as string);
    if (!invite || invite.acceptedAt) {
      return apiError(res, 'Invite not found', 404, 'INVITE_NOT_FOUND');
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return apiError(res, 'Invite has expired', 410, 'INVITE_EXPIRED');
    }
    json(res, portalIdentityStore.inviteToDTO(invite));
  });

  router.post(
    '/api/v1/portal/invites/:token/accept',
    async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body ?? {}) as AcceptBody;
      if (!body.password || body.password.length < 8) {
        return apiError(res, 'password must be at least 8 characters', 400, 'WEAK_PASSWORD');
      }

      const passwordHash = await hashPassword(body.password);
      const result = portalIdentityStore.acceptInvite(ctx.params['token'] as string, passwordHash);

      if (result === 'INVALID_TOKEN')
        return apiError(res, 'Invite not found', 404, 'INVITE_NOT_FOUND');
      if (result === 'EXPIRED') return apiError(res, 'Invite has expired', 410, 'INVITE_EXPIRED');
      if (result === 'ALREADY_ACCEPTED') {
        return apiError(res, 'Invite has already been accepted', 409, 'INVITE_ALREADY_ACCEPTED');
      }

      const { user, invite } = result;
      portalIdentityStore.recordAudit({
        organizationId: invite.organizationId,
        action: 'INVITE_ACCEPTED',
        actorId: user.id,
        actorEmail: user.email,
        target: invite.id,
      });

      const token = await signPortalSessionToken({
        sub: user.id,
        organizationId: user.organizationId,
        role: user.role,
        name: user.name,
        email: user.email,
      });

      json(res, { token, user: portalIdentityStore.toDTO(user) }, 201);
    }
  );
}
