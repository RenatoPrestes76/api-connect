// ─── RBAC ─────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'READ_ONLY';

export interface HubUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface SessionPayload {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export type ConnectorStatus = 'RUNNING' | 'STOPPED' | 'ERROR' | 'STARTING' | 'STOPPING' | 'UNKNOWN';

export interface ConnectorInstance {
  id: string;
  name: string;
  version: string;
  driver: string;
  database: string;
  host: string;
  status: ConnectorStatus;
  lastSync?: string;
  syncCount: number;
  errorCount: number;
  health: HealthStatus;
  agentId?: string;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'STALE' | 'REGISTERING' | 'DISABLED';

export interface AgentSummary {
  id: string;
  hostname: string;
  version: string;
  os: string;
  ip: string;
  status: AgentStatus;
  lastSeen: string;
  connectors: number;
  syncCount: number;
  errorCount: number;
}

// ─── Database ─────────────────────────────────────────────────────────────────

export type DatabaseDriver = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'firebird';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface DatabaseConnection {
  id: string;
  name: string;
  driver: DatabaseDriver;
  host: string;
  port: number;
  database: string;
  version: string;
  status: HealthStatus;
  latencyMs: number;
  poolSize: number;
  poolUsed: number;
  connectedAt: string;
  schema: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncResult = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'RUNNING' | 'CANCELLED';

export interface SyncRecord {
  id: string;
  connectorId: string;
  connector: string;
  agentId: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  result: SyncResult;
  synced: number;
  skipped: number;
  failed: number;
  entities: string[];
  errors: string[];
}

export interface SyncRunRequest {
  connectorId: string;
  entities?: string[];
  since?: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface SystemMetric {
  label: string;
  value: number;
  unit: string;
  status: HealthStatus;
  threshold?: number;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: HealthStatus;
  timestamp: string;
  uptime: number;
  metrics: SystemMetric[];
  components: ComponentHealth[];
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface DiscoveryEntity {
  table: string;
  entity: string;
  confidence: number;
  isAuxiliary: boolean;
  isJunctionTable: boolean;
  estimatedRows: number | null;
  fieldRoles: Record<string, { role: string; confidence: number }>;
  alternatives: Array<{ entity: string; confidence: number }>;
}

export interface DiscoverySuggestion {
  priority: 1 | 2 | 3;
  entity: string;
  table: string;
  reason: string;
  fieldMapping: Record<string, string>;
}

export interface DiscoveryGraph {
  nodes: Array<{
    id: string;
    entity: string;
    confidence: number;
    schema: string;
    table: string;
    columns: number;
    rows: number | null;
  }>;
  edges: Array<{
    from: string;
    to: string;
    kind: string;
    cardinality: string;
    label: string;
    confidence: number;
  }>;
  stats: { nodeCount: number; edgeCount: number };
}

export interface DiscoveryAnalysis {
  analysisId: string;
  generatedAt: string;
  durationMs: number;
  database: string;
  host: string;
  port: number;
  summary: {
    schemasFound: number;
    tablesFound: number;
    columnsFound: number;
    entitiesIdentified: number;
    relationshipsFound: number;
    auxiliaryTables: number;
    junctionTables: number;
    overallConfidence: number;
    hasRisks: boolean;
  };
  entities: DiscoveryEntity[];
  suggestions: DiscoverySuggestion[];
  risks: Array<{ level: string; category: string; description: string; tables: string[] }>;
}

// ─── Log ──────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  connector?: string;
  agent?: string;
  runtime?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LogQuery {
  connector?: string;
  level?: LogLevel;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface HubSettings {
  sync: {
    intervalMs: number;
    retryAttempts: number;
    timeoutMs: number;
    batchSize: number;
    enableIncremental: boolean;
  };
  cache: {
    ttlMs: number;
    maxEntries: number;
  };
  discovery: {
    autoRunOnConnect: boolean;
    confidenceMinimum: number;
    schemaTtlMs: number;
  };
  notifications: {
    enableEmailAlerts: boolean;
    alertEmail: string;
    alertOnFailure: boolean;
    alertOnDegraded: boolean;
  };
}

// ─── API response envelopes ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface ApiError {
  error: { code: string; message: string };
}

export interface DashboardMetrics {
  connectors: number;
  connectorsOnline: number;
  agents: number;
  agentsOnline: number;
  lastSync?: string;
  databases: number;
  discoveryRuns: number;
  failures24h: number;
  avgSyncMs: number;
  overallHealth: HealthStatus;
  syncTrend: Array<{ ts: string; count: number; failed: number }>;
  recentActivity: Array<{ ts: string; event: string; connector?: string }>;
}
