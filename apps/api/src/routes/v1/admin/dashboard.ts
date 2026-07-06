import type { ServerResponse }            from 'node:http';
import type { RouteContext }              from '../../../http/router.js';
import { json }                           from '../../../http/router.js';
import { DashboardMetricsService }        from '@seltriva/agent-observability';
import type { AtlasAgentRepository }      from '@seltriva/agent-identity';
import type {
  HeartbeatRecordRepository,
  SyncRecordRepository,
} from '@seltriva/agent-observability';

export function createDashboardMetricsHandler(
  agentRepo:     AtlasAgentRepository,
  syncRepo:      SyncRecordRepository,
  heartbeatRepo: HeartbeatRecordRepository,
) {
  const svc = new DashboardMetricsService(agentRepo, syncRepo, heartbeatRepo);
  return async (_ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const metrics = await svc.getMetrics();
    json(res, { data: metrics });
  };
}

export function createDashboardActivityHandler(
  agentRepo:     AtlasAgentRepository,
  syncRepo:      SyncRecordRepository,
  heartbeatRepo: HeartbeatRecordRepository,
) {
  const svc = new DashboardMetricsService(agentRepo, syncRepo, heartbeatRepo);
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const q       = ctx.query;
    const sinceMs = Math.max(1, parseInt(q.get('sinceMs') ?? String(60 * 60 * 1_000), 10));
    const limit   = Math.min(200, Math.max(1, parseInt(q.get('limit') ?? '50', 10)));
    const { recentHeartbeats, recentSyncs } = await svc.getActivity(sinceMs, limit);
    json(res, {
      data: {
        heartbeats: recentHeartbeats.map(h => h.toSnapshot()),
        syncs:      recentSyncs.map(s => s.toSnapshot()),
      },
    });
  };
}
