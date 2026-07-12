import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf, assertTenantAccess } from './util.js';

export function registerCatalogRoutes(router: { get: Function }): void {
  router.get('/api/v1/helios/catalog', (ctx: RouteContext, res: ServerResponse) => {
    const producer = ctx.query.get('producer') ?? undefined;
    const classification = ctx.query.get('classification') ?? undefined;
    const criticality = ctx.query.get('criticality') ?? undefined;
    const tenantId = tenantOf(ctx);
    const entries = heliosStore.getCatalog({ producer, classification, criticality, tenantId });
    json(res, { entries, total: entries.length });
  });

  router.get('/api/v1/helios/catalog/:id', (ctx: RouteContext, res: ServerResponse) => {
    const eventType = ctx.params?.id as string;
    const entry = heliosStore.getCatalogEntry(eventType);
    if (!entry || !assertTenantAccess(heliosStore.getTenantIdForEventType(eventType), ctx)) {
      return apiError(res, 'Catalog entry not found', 404, 'CATALOG_ENTRY_NOT_FOUND');
    }
    json(res, entry);
  });
}
