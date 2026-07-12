import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';

export function registerStudioRoutes(router: { get: Function; post: Function }): void {
  // Digital Twin
  router.get('/api/v1/helios/twin/topology', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, heliosStore.getTwinTopology());
  });

  router.get('/api/v1/helios/twin/flow/:id', (ctx: RouteContext, res: ServerResponse) => {
    const orderId = ctx.params?.id as string;
    const flow = heliosStore.getTwinFlow(orderId);
    if (!flow) return apiError(res, 'Order flow not found', 404, 'FLOW_NOT_FOUND');
    json(res, flow);
  });

  // Event Marketplace
  router.get('/api/v1/helios/marketplace', (ctx: RouteContext, res: ServerResponse) => {
    const category = ctx.query.get('category') ?? undefined;
    const tags = ctx.query.get('tags') ?? undefined;
    const events = heliosStore.getMarketplaceEvents({ category, tags });
    json(res, { events, total: events.length });
  });

  router.get('/api/v1/helios/marketplace/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const event = heliosStore.getMarketplaceEventById(id);
    if (!event)
      return apiError(res, 'Marketplace event not found', 404, 'MARKETPLACE_EVENT_NOT_FOUND');
    json(res, event);
  });

  // External Gateway
  router.get('/api/v1/helios/gateway/bridges', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const platform = ctx.query.get('platform') ?? undefined;
    const bridges = heliosStore.getBridges({ status, platform });
    json(res, { bridges, total: bridges.length });
  });

  router.post(
    '/api/v1/helios/gateway/bridges/:id/reconnect',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = heliosStore.reconnectBridge(id);
      if (result === null) return apiError(res, 'Bridge not found', 404, 'BRIDGE_NOT_FOUND');
      if (result === 'ALREADY_CONNECTED')
        return apiError(res, 'Bridge is already connected', 400, 'ALREADY_CONNECTED');
      json(res, result);
    }
  );
}
