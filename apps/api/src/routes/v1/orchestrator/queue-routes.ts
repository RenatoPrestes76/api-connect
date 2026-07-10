/**
 * Sprint 29 — ORCHESTRATOR
 * Queue inspection and DLQ management routes.
 */
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import { retryFromDlq } from '../../../modules/orchestrator/queue.js';

export async function getQueue(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, {
    queue: orchestratorStore.queue,
    depth: orchestratorStore.queue.length,
  });
}

export async function getDlq(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, {
    dlq: orchestratorStore.dlq,
    depth: orchestratorStore.dlq.length,
  });
}

export async function retryDlqJob(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const job = retryFromDlq(ctx.params['jobId']!);
  if (!job) {
    apiError(res, 'DLQ job not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, job);
}

export async function purgeDlq(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const count = orchestratorStore.dlq.length;
  orchestratorStore.dlq.length = 0;
  json(res, { purged: count });
}
