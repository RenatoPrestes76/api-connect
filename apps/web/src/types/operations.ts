export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type SlaPeriod = 'today' | '7d' | '30d' | '12m';
export type ActionType = 'restart-agent' | 'retry' | 'run-health' | 'sync';

export interface TenantHealth {
  tenantId: string;
  tenantName: string;
  plan: string;
  overallStatus: HealthStatus;
  checks: HealthCheck[];
  alertCount: number;
  activeAlerts: number;
  sla: number;
}

export interface HealthCheck {
  id: string;
  componentType: string;
  componentId: string;
  tenantId: string;
  status: HealthStatus;
  message: string;
  checkedAt: string;
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
  componentType: string;
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
