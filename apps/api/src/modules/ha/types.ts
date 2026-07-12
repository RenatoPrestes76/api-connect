export type NodeRole = 'leader' | 'secondary' | 'standby' | 'worker';
export type NodeStatus = 'online' | 'degraded' | 'failover' | 'recovering' | 'offline';
export type BackupType = 'full' | 'incremental' | 'snapshot';
export type BackupStatus = 'completed' | 'failed' | 'in_progress';
export type ReplicationStatus = 'in_sync' | 'lagging' | 'diverged' | 'stopped';
export type ClusterHealth = 'healthy' | 'degraded' | 'critical' | 'offline';
export type HaEventType =
  | 'node.joined'
  | 'node.left'
  | 'node.degraded'
  | 'node.recovered'
  | 'failover.initiated'
  | 'failover.completed'
  | 'backup.started'
  | 'backup.completed'
  | 'backup.failed'
  | 'restore.started'
  | 'restore.completed'
  | 'restore.failed'
  | 'replication.stopped'
  | 'replication.normalized'
  | 'replication.lagging'
  | 'recovery.test.passed'
  | 'recovery.test.failed';

export interface ClusterNode {
  id: string;
  hostname: string;
  role: NodeRole;
  status: NodeStatus;
  region: string;
  version: string;
  lastHeartbeat: string;
  createdAt: string;
}

export interface ReplicationState {
  nodeId: string;
  status: ReplicationStatus;
  lagMs: number;
  lastSynced: string;
  divergenceBytes: number;
}

export interface ClusterNodeWithReplication extends ClusterNode {
  replication?: ReplicationState;
}

export interface FailoverEvent {
  id: string;
  fromNodeId: string;
  fromHostname: string;
  toNodeId: string;
  toHostname: string;
  reason: string;
  automatic: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  rtoSeconds: number;
  success: boolean;
}

export interface BackupRecord {
  id: string;
  tenantId: string;
  type: BackupType;
  sizeBytes: number;
  sizeLabel: string;
  status: BackupStatus;
  checksum: string;
  createdAt: string;
  expiresAt: string;
}

export interface RecoveryTest {
  id: string;
  tenantId: string;
  result: 'passed' | 'failed';
  rtoSeconds: number;
  rpoMinutes: number;
  durationMs: number;
  notes: string;
  testedAt: string;
}

export interface HaEvent {
  id: string;
  type: HaEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ClusterReplicationSummary {
  totalReplicas: number;
  inSync: number;
  lagging: number;
  stopped: number;
  avgLagMs: number;
}

export interface ClusterOverview {
  totalNodes: number;
  onlineNodes: number;
  degradedNodes: number;
  offlineNodes: number;
  clusterHealth: ClusterHealth;
  leaderNode: ClusterNodeWithReplication | null;
  replication: ClusterReplicationSummary;
  lastBackup: BackupRecord | null;
  lastFailover: FailoverEvent | null;
  avgRtoSeconds: number;
  avgRpoMinutes: number;
}

export interface FailoverResult {
  event: FailoverEvent;
  newLeader: ClusterNode;
  affectedNodes: number;
  message: string;
}

export interface RestoreResult {
  success: boolean;
  restoreId: string;
  backupId: string;
  tenantId: string;
  environment: string;
  startedAt: string;
  estimatedDuration: string;
  message: string;
}
