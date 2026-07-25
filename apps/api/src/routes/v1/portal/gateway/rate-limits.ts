import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../../http/router.js';
import { json, apiError } from '../../../../http/router.js';
import { gatewayStore } from '../../../../modules/gateway/gateway-store.js';
import { portalIdentityStore } from '../../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../../middleware/portal-auth.js';
import type { RateLimitWindow } from '../../../../modules/gateway/types.js';
import { DEFAULT_RATE_LIMITS } from '../../../../modules/gateway/types.js';

const VALID_WINDOWS: RateLimitWindow[] = ['minute', 'hour', 'day'];

interface UpsertRuleBody {
  window?: RateLimitWindow;
  limit?: number;
}

export function registerGatewayRateLimitRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.get(
    '/api/v1/portal/gateway/rate-limits',
    requirePortalPermission('rate-limits.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.portalOrganizationId as string;
      const rules = gatewayStore.listRateLimitRules(organizationId);
      json(res, { defaults: DEFAULT_RATE_LIMITS, rules });
    })
  );

  router.post(
    '/api/v1/portal/gateway/rate-limits',
    requirePortalPermission('rate-limits.manage')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as UpsertRuleBody;
        if (!body.window || !VALID_WINDOWS.includes(body.window)) {
          return apiError(
            res,
            `window must be one of: ${VALID_WINDOWS.join(', ')}`,
            400,
            'INVALID_WINDOW'
          );
        }
        if (typeof body.limit !== 'number' || body.limit <= 0) {
          return apiError(res, '"limit" must be a positive number', 400, 'INVALID_LIMIT');
        }

        const organizationId = ctx.portalOrganizationId as string;
        const rule = gatewayStore.upsertRateLimitRule(organizationId, body.window, body.limit);

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'RATE_LIMIT_RULE_UPDATED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: rule.id,
          metadata: { window: rule.window, limit: rule.limit },
        });

        json(res, rule, 201);
      }
    )
  );

  router.delete(
    '/api/v1/portal/gateway/rate-limits/:id',
    requirePortalPermission('rate-limits.manage')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const organizationId = ctx.portalOrganizationId as string;
        const id = ctx.params['id'] as string;
        const ok = gatewayStore.deleteRateLimitRule(organizationId, id);
        if (!ok) return apiError(res, 'Rate limit rule not found', 404, 'NOT_FOUND');

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'RATE_LIMIT_RULE_DELETED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: id,
        });

        json(res, { deleted: true });
      }
    )
  );
}
