import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf, assertTenantAccess } from './util.js';

export function registerReplayRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/helios/replay', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const tenantId = tenantOf(ctx);
    const jobs = heliosStore.getReplayJobs({ status, tenantId });
    json(res, { jobs, total: jobs.length });
  });

  router.get('/api/v1/helios/replay/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const job = heliosStore.getReplayJobById(id);
    if (!job || !assertTenantAccess(job.tenantId, ctx))
      return apiError(res, 'Replay job not found', 404, 'REPLAY_JOB_NOT_FOUND');
    json(res, job);
  });

  router.post('/api/v1/helios/replay', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as
      | {
          topicId?: string;
          tenantId?: string;
          startTime?: string;
          endTime?: string;
          workflowId?: string;
        }
      | undefined;
    if (!body?.topicId || !body?.tenantId || !body?.startTime || !body?.endTime) {
      return apiError(
        res,
        'topicId, tenantId, startTime and endTime are required',
        400,
        'MISSING_FIELDS'
      );
    }
    const topic = heliosStore.getTopicById(body.topicId);
    if (!topic || !assertTenantAccess(topic.tenantId, ctx))
      return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
    const result = heliosStore.createReplayJob(
      body.topicId,
      topic.tenantId,
      body.startTime,
      body.endTime,
      body.workflowId
    );
    if (result === 'TOPIC_NOT_FOUND')
      return apiError(res, 'Topic not found', 404, 'TOPIC_NOT_FOUND');
    json(res, result);
  });
}
