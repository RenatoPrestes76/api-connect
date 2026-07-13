// ─── Services ────────────────────────────────────────────────────────────────
export {
  computeHealth,
  HealthStatus,
  HEALTH_ONLINE_THRESHOLD_MS,
  HEALTH_STALE_THRESHOLD_MS,
} from './services/agent-health.js';

export { DashboardMetricsService } from './services/dashboard-metrics-service.js';
export type { DashboardMetrics, ActivityData } from './services/dashboard-metrics-service.js';

// ─── Entities ────────────────────────────────────────────────────────────────
export { HeartbeatRecord, HeartbeatRecordError } from './entity/heartbeat-record.js';
export type { HeartbeatRecordSnapshot } from './entity/heartbeat-record.js';

export { SyncRecord, SyncRecordError } from './entity/sync-record.js';
export type { SyncRecordSnapshot, SyncResult } from './entity/sync-record.js';

// ─── Repository interfaces ────────────────────────────────────────────────────
export type { HeartbeatRecordRepository } from './repository/heartbeat-record-repository.js';
export { DEFAULT_MAX_HEARTBEATS_PER_AGENT } from './repository/heartbeat-record-repository.js';

export type { SyncRecordRepository } from './repository/sync-record-repository.js';
export { DEFAULT_MAX_SYNCS_PER_AGENT } from './repository/sync-record-repository.js';

// ─── In-memory implementations ───────────────────────────────────────────────
export { InMemoryHeartbeatRecordRepository } from './repository/in-memory-heartbeat-record-repository.js';
export { InMemorySyncRecordRepository } from './repository/in-memory-sync-record-repository.js';

// ─── Prisma implementations ───────────────────────────────────────────────────
export { PrismaHeartbeatRecordRepository } from './infrastructure/prisma-heartbeat-record-repository.js';
export { PrismaSyncRecordRepository } from './infrastructure/prisma-sync-record-repository.js';
export type {
  ObservabilityDbClient,
  HeartbeatDbDelegate,
  SyncHistoryDbDelegate,
  PrismaAtlasAgentHeartbeat,
  PrismaAtlasAgentSyncHistory,
} from './infrastructure/prisma-types.js';
