import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../../http/router.js';
import { json, apiError } from '../../../../http/router.js';
import { gatewayStore } from '../../../../modules/gateway/gateway-store.js';
import {
  generatePublicId,
  generateApiKeySecret,
  hashApiKeySecret,
} from '../../../../modules/gateway/api-key-secret.js';
import { portalIdentityStore } from '../../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../../middleware/portal-auth.js';
import type { OrgRole } from '../../../../modules/portal-identity/types.js';

const VALID_ROLES: OrgRole[] = ['OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'OPERATOR', 'VIEWER'];

interface CreateApiKeyBody {
  name?: string;
  environmentId?: string;
  role?: OrgRole;
}

export function registerGatewayApiKeyRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/gateway/api-keys',
    requirePortalPermission('api-keys.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const keys = gatewayStore
        .listApiKeys(ctx.portalOrganizationId as string)
        .map((k) => gatewayStore.toApiKeyDTO(k));
      json(res, { total: keys.length, keys });
    })
  );

  router.post(
    '/api/v1/portal/gateway/api-keys',
    requirePortalPermission('api-keys.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body ?? {}) as CreateApiKeyBody;
      const organizationId = ctx.portalOrganizationId as string;

      if (!body.name) return apiError(res, '"name" is required', 400, 'MISSING_FIELDS');
      if (!body.environmentId) {
        return apiError(res, '"environmentId" is required', 400, 'MISSING_FIELDS');
      }
      const environment = portalIdentityStore
        .listEnvironments(organizationId)
        .find((e) => e.id === body.environmentId);
      if (!environment) {
        return apiError(
          res,
          'Environment not found for this organization',
          404,
          'ENVIRONMENT_NOT_FOUND'
        );
      }
      const role = body.role ?? 'VIEWER';
      if (!VALID_ROLES.includes(role)) {
        return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
      }

      const secret = generateApiKeySecret();
      const key = gatewayStore.createApiKey({
        organizationId,
        environmentId: body.environmentId,
        name: body.name,
        role,
        publicId: generatePublicId(),
        secretHash: hashApiKeySecret(secret),
      });

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'API_KEY_CREATED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: key.id,
        metadata: { name: key.name },
      });

      // The full "publicId.secret" credential is returned exactly once —
      // only the hash is ever stored.
      json(res, { ...gatewayStore.toApiKeyDTO(key), apiKey: `${key.publicId}.${secret}` }, 201);
    })
  );

  router.post(
    '/api/v1/portal/gateway/api-keys/:id/revoke',
    requirePortalPermission('api-keys.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.portalOrganizationId as string;
      const id = ctx.params['id'] as string;
      const key = gatewayStore.revokeApiKey(organizationId, id);
      if (!key) return apiError(res, 'API key not found or already revoked', 404, 'NOT_FOUND');

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'API_KEY_REVOKED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: id,
      });

      json(res, gatewayStore.toApiKeyDTO(key));
    })
  );

  router.post(
    '/api/v1/portal/gateway/api-keys/:id/regenerate',
    requirePortalPermission('api-keys.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.portalOrganizationId as string;
      const id = ctx.params['id'] as string;
      const secret = generateApiKeySecret();
      const key = gatewayStore.regenerateApiKey(organizationId, id, {
        publicId: generatePublicId(),
        secretHash: hashApiKeySecret(secret),
      });
      if (!key) return apiError(res, 'API key not found or revoked', 404, 'NOT_FOUND');

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'API_KEY_REGENERATED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: id,
      });

      json(res, { ...gatewayStore.toApiKeyDTO(key), apiKey: `${key.publicId}.${secret}` });
    })
  );

  router.delete(
    '/api/v1/portal/gateway/api-keys/:id',
    requirePortalPermission('api-keys.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const key = gatewayStore.revokeApiKey(
        ctx.portalOrganizationId as string,
        ctx.params['id'] as string
      );
      if (!key) return apiError(res, 'API key not found or already revoked', 404, 'NOT_FOUND');
      json(res, { revoked: true });
    })
  );
}
