import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { connectorsStore } from '../../../modules/connectors/connectors-store.js';
import { requirePortalAuth } from '../../../middleware/portal-auth.js';
import type { ConnectorCategory } from '../../../modules/connectors/types.js';

/**
 * Read-only browse surface for the connector registry (Sprint 46.6) —
 * organizations pick from this catalog when configuring an instance in a
 * later sprint. Any authenticated org member can browse; only Atlas staff
 * (admin-identity, see routes/v1/connector-registry/) can register
 * connectors or publish versions.
 */
export function registerPortalConnectorCatalogRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/connector-catalog',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const category = (ctx.query.get('category') as ConnectorCategory | null) ?? undefined;
      const connectors = connectorsStore.listConnectors({ category, status: 'active' });
      json(res, { total: connectors.length, connectors });
    })
  );

  router.get(
    '/api/v1/portal/connector-catalog/:id',
    requirePortalAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const connector = connectorsStore.getConnector(ctx.params['id'] as string);
      if (!connector) return apiError(res, 'Connector not found', 404, 'NOT_FOUND');
      const parameters = connectorsStore.listParameters(connector.id);
      const templates = connectorsStore
        .listTemplates(connector.id)
        .map((t) => connectorsStore.toTemplateDTO(t));
      json(res, { connector, parameters, templates });
    })
  );
}
