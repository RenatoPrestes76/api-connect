import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { parseLimit, tenantOf, assertTenantAccess } from './util.js';

export function registerBusRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/helios/bus/topics', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = tenantOf(ctx);
    const status = ctx.query.get('status') ?? undefined;
    const limit = ctx.query.get('limit') ? parseLimit(ctx.query.get('limit'), 200) : undefined;
    const topics = heliosStore.getTopics({ tenantId, status, limit });
    json(res, { topics, total: topics.length });
  });

  router.get('/api/v1/helios/bus/topics/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const topic = heliosStore.getTopicById(id);
    if (!topic || !assertTenantAccess(topic.tenantId, ctx))
      return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
    json(res, topic);
  });

  router.post(
    '/api/v1/helios/bus/topics/:id/publish',
    async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const body = ctx.body as
        | { eventType?: string; payload?: Record<string, unknown>; producer?: string }
        | undefined;
      if (!body?.eventType || !body?.payload || !body?.producer) {
        return apiError(res, 'eventType, payload and producer are required', 400, 'MISSING_FIELDS');
      }
      const topic = heliosStore.getTopicById(id);
      if (!topic || !assertTenantAccess(topic.tenantId, ctx))
        return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
      const msg = heliosStore.publishEvent(id, body.eventType, body.payload, body.producer);
      if (!msg) return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
      json(res, msg);
    }
  );

  router.get('/api/v1/helios/bus/topics/:id/messages', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const limit = parseLimit(ctx.query.get('limit'), 20);
    const topic = heliosStore.getTopicById(id);
    if (!topic || !assertTenantAccess(topic.tenantId, ctx))
      return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
    const messages = heliosStore.getTopicMessages(id, limit);
    json(res, { messages, total: messages.length });
  });

  router.get('/api/v1/helios/mesh/clusters', (_ctx: RouteContext, res: ServerResponse) => {
    const clusters = heliosStore.getClusters();
    json(res, { clusters, total: clusters.length });
  });
}
