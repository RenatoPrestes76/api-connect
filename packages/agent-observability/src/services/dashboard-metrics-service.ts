import type { AtlasAgentRepository } from '@seltriva/agent-identity';
import { computeHealth, HealthStatus } from './agent-health.js';
import type { HeartbeatRecordRepository } from '../repository/heartbeat-record-repository.js';
import type { SyncRecordRepository }      from '../repository/sync-record-repository.js';
import type { HeartbeatRecord }           from '../entity/heartbeat-record.js';
import type { SyncRecord }                from '../entity/sync-record.js';

export interface DashboardMetrics {
  companies:               number;
  agents:                  number;
  online:                  number;
  stale:                   number;
  offline:                 number;
  last24hSynchronizations: number;
}

export interface ActivityData {
  recentHeartbeats: HeartbeatRecord[];
  recentSyncs:      SyncRecord[];
}

export class DashboardMetricsService {
  constructor(
    private readonly agentRepo:     AtlasAgentRepository,
    private readonly syncRepo:      SyncRecordRepository,
    private readonly heartbeatRepo: HeartbeatRecordRepository,
  ) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const agents   = await this.agentRepo.findAll();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const syncs    = await this.syncRepo.findRecent(since24h);

    const companies = new Set(agents.map(a => a.companyId)).size;
    let online = 0, stale = 0, offline = 0;
    for (const agent of agents) {
      const h = computeHealth(agent.lastHeartbeat);
      if      (h === HealthStatus.ONLINE)  online++;
      else if (h === HealthStatus.STALE)   stale++;
      else                                 offline++;
    }

    return { companies, agents: agents.length, online, stale, offline, last24hSynchronizations: syncs.length };
  }

  async getActivity(sinceMs = 60 * 60 * 1_000, limit = 50): Promise<ActivityData> {
    const since = new Date(Date.now() - sinceMs);
    const [recentHeartbeats, recentSyncs] = await Promise.all([
      this.heartbeatRepo.findRecent(since, limit),
      this.syncRepo.findRecent(since, limit),
    ]);
    return { recentHeartbeats, recentSyncs };
  }
}
