import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePortalAuth } from '../../../middleware/portal-auth.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import type { ConnectorHealth } from '@seltriva/release';

const VALID_HEALTH: ConnectorHealth[] = ['healthy', 'degraded', 'error', 'unknown'];

interface UpdateHealthBody {
  health?: string;
}

/**
 * ATLAS 46.26 — this route family was previously unauthenticated
 * (`/api/v1/portal/` is a PUBLIC_PATH_PREFIX in middleware/auth.ts,
 * intentionally bypassed by the global Supabase-style check in favor of
 * each route self-guarding via requirePortalAuth — these two routes never
 * did) and scoped by `requireTenantId(ctx)`, which reads a client-supplied
 * `x-tenant-id` header/query param with no verification at all — any
 * caller could view or mutate any tenant's connector data. Fixed to
 * authenticate via the real portal session and scope/verify ownership
 * through `ctx.portalOrganizationId` (server-derived from the verified
 * JWT/API key, never client-supplied) — see
 * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md's "ATLAS 46.26" section.
 */
export function registerPortalConnectorRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/connectors',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const connectors = portalStore.listConnectors(ctx.portalOrganizationId as string);
      const summary = {
        total: connectors.length,
        healthy: connectors.filter((c) => c.health === 'healthy').length,
        degraded: connectors.filter((c) => c.health === 'degraded').length,
        error: connectors.filter((c) => c.health === 'error').length,
      };
      json(res, { summary, connectors });
    })
  );

  router.put(
    '/api/v1/portal/connectors/:id/health',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const { health } = (ctx.body as UpdateHealthBody | undefined) ?? {};
      if (!health || !VALID_HEALTH.includes(health as ConnectorHealth)) {
        return apiError(
          res,
          `health must be one of: ${VALID_HEALTH.join(', ')}`,
          400,
          'INVALID_HEALTH'
        );
      }
      const connector = portalStore.updateConnectorHealth(
        ctx.params['id'],
        ctx.portalOrganizationId as string,
        health as ConnectorHealth
      );
      if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      json(res, connector);
    })
  );
}
