export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type ComponentType =
  | 'tenant'
  | 'workspace'
  | 'database'
  | 'agent'
  | 'connector'
  | 'scheduler'
  | 'heartbeat'
  | 'secrets'
  | 'queue'
  | 'storage'
  | 'api'
  | 'webhook'
  | 'worker';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type SlaPeriod = 'today' | '7d' | '30d' | '12m';
export type ActionType = 'restart-agent' | 'retry' | 'run-health' | 'sync';
export type SetupPlan = 'community' | 'professional' | 'enterprise';

export interface TenantInfo {
  tenantId: string;
  name: string;
  plan: SetupPlan;
}

export interface HealthCheck {
  id: string;
  componentType: ComponentType;
  componentId: string;
  tenantId: string;
  status: HealthStatus;
  message: string;
  checkedAt: string;
}

export interface TenantHealth {
  tenantId: string;
  tenantName: string;
  plan: SetupPlan;
  overallStatus: HealthStatus;
  checks: HealthCheck[];
  alertCount: number;
  activeAlerts: number;
  sla: number;
}

export interface OperationsOverview {
  totalTenants: number;
  agentsOnline: number;
  agentsOffline: number;
  connectorsActive: number;
  errorsToday: number;
  jobsExecuted: number;
  heartbeatsPerMin: number;
  availability: number;
  slaCompliant: number;
  openAlerts: number;
  criticalAlerts: number;
  tenants: TenantHealth[];
}

export interface OperationsAlert {
  id: string;
  tenantId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  componentType: ComponentType;
  componentId: string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

export interface OperationsEvent {
  id: string;
  tenantId: string;
  event: string;
  severity: AlertSeverity;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface OperationsMetric {
  id: string;
  tenantId: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface SlaRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  availability: number;
  period: SlaPeriod;
  target: number;
  met: boolean;
  createdAt: string;
}

export interface DiagnosticReport {
  componentId: string;
  componentType: ComponentType;
  tenantId: string;
  status: HealthStatus;
  origin: string;
  lastHeartbeat: string;
  stackSummary: string;
  recentLogs: string[];
  recentEvents: Pick<OperationsEvent, 'event' | 'createdAt' | 'severity'>[];
}

export interface ActionResult {
  actionId: string;
  action: ActionType;
  target: string;
  tenantId: string;
  success: boolean;
  message: string;
  executedAt: string;
  executedBy: string;
}
