import { randomUUID } from 'node:crypto';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import type { TimelineEvent, TimelineEventType } from '../../../modules/observatory/types.js';

// In-memory timeline events (built from audit + execution history for demo)
const TIMELINE: TimelineEvent[] = (() => {
  function minsAgo(n: number) {
    return new Date(Date.now() - n * 60_000).toISOString();
  }
  const wfId = 'wf-erp-product-sync';
  const rows: Array<[TimelineEventType, string, number]> = [
    ['started', 'ERP Product Sync execution started', 5],
    ['step_started', 'Step: trigger — Webhook trigger received payload', 4],
    ['step_completed', 'Step: trigger — completed (32ms)', 4],
    ['step_started', 'Step: validate — Schema validation started', 3],
    ['step_completed', 'Step: validate — passed (14ms)', 3],
    ['step_started', 'Step: transform — ERP→Atlas mapping', 2],
    ['step_completed', 'Step: transform — 48 products mapped (112ms)', 2],
    ['step_started', 'Step: http — POST /api/seltriva/products', 2],
    ['retry', 'Step: http — Retry 1/3: connection timeout (attempt 1)', 2],
    ['step_completed', 'Step: http — 200 OK after retry (1842ms)', 1],
    ['step_started', 'Step: notification — Sending Slack summary', 1],
    ['step_completed', 'Step: notification — sent (88ms)', 1],
    ['completed', 'ERP Product Sync completed successfully in 2.1s', 0],
  ];
  return rows.map(([type, message, mAgo]) => ({
    id: randomUUID(),
    executionId: randomUUID(),
    workflowId: wfId,
    timestamp: minsAgo(mAgo),
    type,
    message,
    durationMs: type === 'step_completed' ? Math.floor(Math.random() * 500 + 10) : undefined,
  }));
})();

export async function getTimeline(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const executionId = ctx.query.get('executionId');
  const workflowId = ctx.query.get('workflowId');
  const limit = Number(ctx.query.get('limit') ?? 50);
  const offset = Number(ctx.query.get('offset') ?? 0);
  let items = [...TIMELINE];
  if (executionId) items = items.filter((e) => e.executionId === executionId);
  if (workflowId) items = items.filter((e) => e.workflowId === workflowId);
  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const total = items.length;
  items = items.slice(offset, offset + limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}
