export type AgentDomainStatus =
  | 'REGISTERING'
  | 'ONLINE'
  | 'OFFLINE'
  | 'SYNCING'
  | 'ERROR'
  | 'DISABLED';
export type AgentHealthStatus = 'ONLINE' | 'STALE' | 'OFFLINE';

export interface Agent {
  agentId: string;
  companyId: string;
  name: string;
  hostname: string;
  machineId: string;
  connectorType: string;
  version: string;
  status: AgentDomainStatus;
  healthStatus: AgentHealthStatus;
  lastHeartbeat: string | null;
  lastSynchronization: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgentListResponse {
  data: Agent[];
  meta: AgentListMeta;
}

export interface DashboardMetrics {
  companies: number;
  agents: number;
  online: number;
  stale: number;
  offline: number;
  last24hSynchronizations: number;
}

export interface HeartbeatRecord {
  id: string;
  agentId: string;
  receivedAt: string;
  version: string;
  hostname: string;
  memoryUsage: number | null;
  uptime: number | null;
  queueSize: number | null;
  status: string;
}

export interface SyncRecord {
  id: string;
  agentId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  recordsSent: number;
  recordsFailed: number;
  bytesTransferred: number;
  compressionRatio: number | null;
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export interface ActivityData {
  heartbeats: HeartbeatRecord[];
  syncs: SyncRecord[];
}

export interface Company {
  companyId: string;
  agentCount: number;
  onlineCount: number;
}

export interface AgentFilter {
  companyId?: string;
  healthStatus?: AgentHealthStatus | '';
  connectorType?: string;
  version?: string;
  hostname?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
