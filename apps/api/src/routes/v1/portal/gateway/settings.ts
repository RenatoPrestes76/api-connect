import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../../http/router.js';
import { json, apiError } from '../../../../http/router.js';
import { gatewayStore } from '../../../../modules/gateway/gateway-store.js';
import { portalIdentityStore } from '../../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../../middleware/portal-auth.js';
import type { LogLevel } from '../../../../modules/gateway/types.js';

const VALID_LOG_LEVELS: LogLevel[] = ['minimal', 'standard', 'verbose'];

interface UpdateSettingsBody {
  corsAllowedOrigins?: string[];
  logLevel?: LogLevel;
  timeoutMs?: number;
  internalBaseUrl?: string;
}

export function registerGatewaySettingsRoutes(router: { get: Function; patch: Function }): void {
  router.get(
    '/api/v1/portal/gateway/settings/:environmentId',
    requirePortalPermission('gateway-settings.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const organizationId = ctx.portalOrganizationId as string;
        const environmentId = ctx.params['environmentId'] as string;
        const environment = portalIdentityStore
          .listEnvironments(organizationId)
          .find((e) => e.id === environmentId);
        if (!environment) {
          return apiError(
            res,
            'Environment not found for this organization',
            404,
            'ENVIRONMENT_NOT_FOUND'
          );
        }
        json(res, gatewayStore.getSettings(organizationId, environmentId));
      }
    )
  );

  router.patch(
    '/api/v1/portal/gateway/settings/:environmentId',
    requirePortalPermission('gateway-settings.manage')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as UpdateSettingsBody;
        if (body.logLevel && !VALID_LOG_LEVELS.includes(body.logLevel)) {
          return apiError(
            res,
            `logLevel must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
            400,
            'INVALID_LOG_LEVEL'
          );
        }

        const organizationId = ctx.portalOrganizationId as string;
        const environmentId = ctx.params['environmentId'] as string;
        const environment = portalIdentityStore
          .listEnvironments(organizationId)
          .find((e) => e.id === environmentId);
        if (!environment) {
          return apiError(
            res,
            'Environment not found for this organization',
            404,
            'ENVIRONMENT_NOT_FOUND'
          );
        }

        const settings = gatewayStore.updateSettings(organizationId, environmentId, body);

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'GATEWAY_SETTINGS_UPDATED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: environmentId,
        });

        json(res, settings);
      }
    )
  );
}
