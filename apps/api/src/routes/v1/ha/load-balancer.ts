import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import {
  loadBalancer,
  LoadBalancer,
  LoadBalancerError,
} from '../../../modules/ha/load-balancer.js';

export function registerHaLoadBalancerRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/ha/load-balancer', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, { targets: loadBalancer.getDistribution() });
  });

  router.post('/api/v1/ha/load-balancer/route', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { strategy = 'round_robin', includeLeader = false } = body;

    if (!LoadBalancer.isValidStrategy(strategy)) {
      return apiError(
        res,
        'strategy must be one of: round_robin, least_connections, weighted',
        400,
        'INVALID_STRATEGY'
      );
    }

    try {
      const decision = loadBalancer.route(strategy, { includeLeader: Boolean(includeLeader) });
      json(res, decision, 201);
    } catch (err) {
      if (err instanceof LoadBalancerError && err.code === 'NO_HEALTHY_TARGETS') {
        return apiError(res, err.message, 503, 'NO_HEALTHY_TARGETS');
      }
      return apiError(res, (err as Error).message, 500, 'ROUTE_ERROR');
    }
  });

  router.post('/api/v1/ha/load-balancer/release', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { nodeId } = body;
    if (!nodeId) return apiError(res, '"nodeId" is required', 400, 'MISSING_FIELDS');

    loadBalancer.release(nodeId);
    json(res, { released: true, nodeId });
  });

  router.post('/api/v1/ha/load-balancer/weight', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { nodeId, weight } = body;
    if (!nodeId) return apiError(res, '"nodeId" is required', 400, 'MISSING_FIELDS');
    if (typeof weight !== 'number')
      return apiError(res, '"weight" must be a number', 400, 'MISSING_FIELDS');

    try {
      loadBalancer.setWeight(nodeId, weight);
      json(res, { nodeId, weight });
    } catch (err) {
      if (err instanceof LoadBalancerError && err.code === 'INVALID_WEIGHT') {
        return apiError(res, err.message, 400, 'INVALID_WEIGHT');
      }
      throw err;
    }
  });
}
