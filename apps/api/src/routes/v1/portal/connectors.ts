import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import type { ConnectorHealth } from '@seltriva/release';

const VALID_HEALTH: ConnectorHealth[] = ['healthy', 'degraded', 'error', 'unknown'];

export function registerPortalConnectorRoutes(router: { get: Function; put: Function }): void {
  router.get('/api/v1/portal/connectors', (ctx: RouteContext, res: ServerResponse) => {
    const connectors = portalStore.listConnectors(requireTenantId(ctx));
    const summary = {
      total: connectors.length,
      healthy: connectors.filter((c) => c.health === 'healthy').length,
      degraded: connectors.filter((c) => c.health === 'degraded').length,
      error: connectors.filter((c) => c.health === 'error').length,
    };
    json(res, { summary, connectors });
  });

  router.put('/api/v1/portal/connectors/:id/health', (ctx: RouteContext, res: ServerResponse) => {
    const { health } = (ctx.body as any) ?? {};
    if (!VALID_HEALTH.includes(health)) {
      return apiError(
        res,
        `health must be one of: ${VALID_HEALTH.join(', ')}`,
        400,
        'INVALID_HEALTH'
      );
    }
    const connector = portalStore.updateConnectorHealth(ctx.params['id']!, health);
    if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    json(res, connector);
  });
}
