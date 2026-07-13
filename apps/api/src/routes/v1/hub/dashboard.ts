import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { hubStore } from './hub-store.js';

export async function hubDashboard(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const connectors = [...hubStore.connectors.values()];
  const agents = [...hubStore.agents.values()];
  const syncs = hubStore.syncHistory;

  const connectorsOnline = connectors.filter((c) => c.status === 'RUNNING').length;
  const agentsOnline = agents.filter((a) => a.status === 'ONLINE').length;
  const lastSync = syncs.find((s) => s.finishedAt)?.finishedAt;
  const failures24h = syncs.filter((s) => {
    const age = Date.now() - Date.parse(s.startedAt);
    return s.result === 'FAILED' && age < 86_400_000;
  }).length;

  const completed = syncs.filter((s) => s.durationMs);
  const avgSyncMs = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / completed.length)
    : 0;

  const hasError = connectors.some((c) => c.health === 'unhealthy');
  const hasDegraded = connectors.some((c) => c.health === 'degraded');
  const overallHealth = hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  // 24-h trend in 1-h buckets
  const syncTrend: Array<{ ts: string; count: number; failed: number }> = [];
  for (let h = 23; h >= 0; h--) {
    const bucketStart = Date.now() - (h + 1) * 3_600_000;
    const bucketEnd = Date.now() - h * 3_600_000;
    const bucket = syncs.filter((s) => {
      const t = Date.parse(s.startedAt);
      return t >= bucketStart && t < bucketEnd;
    });
    syncTrend.push({
      ts: new Date(bucketEnd).toISOString(),
      count: bucket.length,
      failed: bucket.filter((s) => s.result === 'FAILED').length,
    });
  }

  const recentActivity = syncs.slice(0, 8).map((s) => ({
    ts: s.startedAt,
    event: `Sync ${s.result.toLowerCase()} — ${s.entities.join(', ')}`,
    connector: s.connector,
  }));

  json(res, {
    connectors: connectors.length,
    connectorsOnline,
    agents: agents.length,
    agentsOnline,
    lastSync,
    databases: hubStore.databases.size,
    discoveryRuns: 0,
    failures24h,
    avgSyncMs,
    overallHealth,
    syncTrend,
    recentActivity,
  });
}
