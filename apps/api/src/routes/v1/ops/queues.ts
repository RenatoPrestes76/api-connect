import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';
import type { JobPriority } from '../../../modules/titan/titan-store.js';

export function registerQueuesRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/ops/queues — queue summary + job list
  router.get('/api/v1/ops/queues', (ctx: RouteContext, res: ServerResponse) => {
    const priority = ctx.query.get('priority') as JobPriority | null;
    const jobs = titanStore.listJobs(priority ?? undefined);
    const dlq = titanStore.listDlq();
    const stats = titanStore.getQueueStats();
    json(res, { stats, jobs, dlq });
  });

  // POST /api/v1/ops/queues/enqueue — enqueue a new job
  router.post('/api/v1/ops/queues/enqueue', (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as any;
    const type = body?.['type'] as string | undefined;
    const tenantId =
      (ctx.headers['x-tenant-id'] as string) ||
      ctx.query.get('tenantId') ||
      (body?.['tenantId'] as string | undefined) ||
      'tenant-enterprise';

    if (!type) return apiError(res, '"type" is required', 400, 'MISSING_TYPE');

    const result = titanStore.enqueue({
      type,
      priority: body?.['priority'] ?? 'normal',
      payload: body?.['payload'] ?? {},
      tenantId,
      maxAttempts: body?.['maxAttempts'] ?? 3,
      idempotencyKey: body?.['idempotencyKey'],
    });

    if (!result) {
      return apiError(res, 'Duplicate idempotency key', 409, 'DUPLICATE_JOB');
    }
    json(res, { job: result }, 201);
  });

  // POST /api/v1/ops/queues/dlq/retry — retry a dead job
  router.post('/api/v1/ops/queues/dlq/retry', (ctx: RouteContext, res: ServerResponse) => {
    const jobId = (ctx.body as any)?.['jobId'] as string | undefined;
    if (!jobId) return apiError(res, '"jobId" is required', 400, 'MISSING_JOB_ID');
    const job = titanStore.retryDlq(jobId);
    if (!job) return apiError(res, 'Job not found in DLQ', 404, 'JOB_NOT_FOUND');
    json(res, { job });
  });
}
