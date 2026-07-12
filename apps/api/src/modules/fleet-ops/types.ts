// Mirrors apps/cloud/prisma/schema.prisma. RuntimeMetric and RuntimeCommand
// reuse the shapes of the existing AgentHeartbeat/AgentCommand models rather
// than duplicating them — see the schema's "FLEET OPERATIONS" section header.

// ─── Runtime metrics (= AgentHeartbeat shape) ────────────────────────────────

export interface RuntimeMetric {
  id: string;
  runtimeId: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNRESPONSIVE' | 'RETIRED';
  cpuPct: number;
  memPct: number;
  diskPct: number;
  latencyMs: number;
  version: string;
  recordedAt: string;
}

// ─── Health snapshots ───────────────────────────────────────────────────────

export type HealthCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  message?: string;
}

export interface RuntimeHealthSnapshot {
  id: string;
  runtimeId: string;
  status: HealthCheckStatus;
  checks: HealthCheck[];
  recordedAt: string;
}

// ─── Runtime commands (= AgentCommand shape) — remote actions ───────────────

export type RuntimeCommandType =
  | 'RESTART'
  | 'UPDATE'
  | 'REINSTALL'
  | 'SYNC_NOW'
  | 'CLEAR_CACHE'
  | 'FORCE_HEARTBEAT'
  | 'DISABLE'
  | 'ENABLE';

export type RuntimeCommandStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface RuntimeCommand {
  id: string;
  runtimeId: string;
  type: RuntimeCommandType;
  status: RuntimeCommandStatus;
  requestedBy?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  issuedAt: string;
  completedAt?: string;
}

// ─── Runtime logs ───────────────────────────────────────────────────────────

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface RuntimeLog {
  id: string;
  runtimeId: string;
  level: LogLevel;
  message: string;
  source?: string;
  createdAt: string;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

export type AlertType =
  | 'RUNTIME_OFFLINE'
  | 'HIGH_CPU'
  | 'HIGH_MEMORY'
  | 'SYNC_FAILURE'
  | 'CONNECTOR_STOPPED'
  | 'DEPLOY_FAILED'
  | 'TOKEN_EXPIRING';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface RuntimeAlert {
  id: string;
  organizationId: string;
  runtimeId?: string;
  pluginId?: string;
  deploymentId?: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationChannel = 'EMAIL' | 'WEBSOCKET' | 'SLACK' | 'TEAMS' | 'WEBHOOK';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface FleetNotification {
  id: string;
  channel: NotificationChannel;
  target: string;
  subject?: string;
  body: string;
  relatedAlertId?: string;
  status: NotificationStatus;
  error?: string;
  createdAt: string;
  sentAt?: string;
}

// ─── Deployment jobs (approval / scheduling wrapper) ─────────────────────────

export type DeploymentMode = 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED';
export type DeploymentJobStatus =
  | 'PENDING_APPROVAL'
  | 'SCHEDULED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'ROLLED_BACK';

/** Zero-Downtime Deployment strategy (Sprint 47 / ATLAS FORTRESS). Governs the task sequence executeJob() runs. */
export type DeploymentStrategy = 'ROLLING' | 'BLUE_GREEN' | 'CANARY';

export interface DeploymentJob {
  id: string;
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
  mode: DeploymentMode;
  strategy: DeploymentStrategy;
  status: DeploymentJobStatus;
  /** Whether a failed step automatically triggers rollback tasks (default true). */
  autoRollback: boolean;
  rollbackReason?: string;
  scheduledAt?: string;
  requestedBy?: string;
  approvedBy?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type DeploymentTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface DeploymentTask {
  id: string;
  jobId: string;
  name: string;
  status: DeploymentTaskStatus;
  order: number;
  startedAt?: string;
  completedAt?: string;
}

// ─── Horizontal autoscaler (Sprint 47 / ATLAS FORTRESS) ──────────────────────

export interface AutoscalePolicy {
  id: string;
  organizationId: string;
  environmentId: string;
  minInstances: number;
  maxInstances: number;
  /** Scale up when the pool's average CPU exceeds this percentage. */
  targetCpuPct: number;
  /** Scale up when the pool's average memory exceeds this percentage. */
  targetMemPct: number;
  /** Minimum time between two scaling actions on this policy, in ms. */
  cooldownMs: number;
  enabled: boolean;
  lastScaledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScalingActionType = 'SCALE_UP' | 'SCALE_DOWN' | 'NO_ACTION';

export interface ScalingEvent {
  id: string;
  policyId: string;
  organizationId: string;
  environmentId: string;
  action: ScalingActionType;
  reason: string;
  instancesBefore: number;
  instancesAfter: number;
  avgCpuPct: number;
  avgMemPct: number;
  createdAt: string;
}
