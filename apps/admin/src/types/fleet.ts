export interface RuntimeMetric {
  id: string;
  runtimeId: string;
  status: string;
  cpuPct: number;
  memPct: number;
  diskPct: number;
  latencyMs: number;
  version: string;
  recordedAt: string;
}

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

export type RuntimeCommandType =
  | 'RESTART'
  | 'UPDATE'
  | 'REINSTALL'
  | 'SYNC_NOW'
  | 'CLEAR_CACHE'
  | 'FORCE_HEARTBEAT'
  | 'DISABLE'
  | 'ENABLE';

export interface RuntimeCommand {
  id: string;
  runtimeId: string;
  type: RuntimeCommandType;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  requestedBy?: string;
  issuedAt: string;
  completedAt?: string;
}

export interface RuntimeLog {
  id: string;
  runtimeId: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source?: string;
  createdAt: string;
}

export interface RuntimeDetail {
  runtime: {
    id: string;
    name: string;
    status: string;
    version: string;
    hostname?: string;
    ipAddress?: string;
    platform?: string;
    arch?: string;
    lastSeenAt?: string;
    registeredAt: string;
  };
  metrics: RuntimeMetric[];
  healthSnapshots: RuntimeHealthSnapshot[];
  logs: RuntimeLog[];
  commands: RuntimeCommand[];
}

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

export type NotificationChannel = 'EMAIL' | 'WEBSOCKET' | 'SLACK' | 'TEAMS' | 'WEBHOOK';

export interface FleetNotification {
  id: string;
  channel: NotificationChannel;
  target: string;
  subject?: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error?: string;
  createdAt: string;
  sentAt?: string;
}

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

export interface DeploymentJob {
  id: string;
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
  mode: DeploymentMode;
  status: DeploymentJobStatus;
  scheduledAt?: string;
  requestedBy?: string;
  approvedBy?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DeploymentTask {
  id: string;
  jobId: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  order: number;
}

export interface FleetOverview {
  runtimesTotal: number;
  runtimesOnline: number;
  runtimesOffline: number;
  runtimesDegraded: number;
  avgCpuPct: number;
  avgMemPct: number;
  avgDiskPct: number;
  avgLatencyMs: number;
  alertsActive: number;
  alertsCritical: number;
}
