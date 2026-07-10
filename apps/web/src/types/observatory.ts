// Sprint 30 — OBSERVATORY frontend types

export type SystemEventType =
  | 'WorkflowStarted'
  | 'WorkflowFinished'
  | 'WorkflowFailed'
  | 'ConnectorConnected'
  | 'ConnectorDisconnected'
  | 'AgentOnline'
  | 'AgentOffline'
  | 'RetryStarted'
  | 'RetryFinished'
  | 'QueueOverflow'
  | 'QueueRecovered'
  | 'IncidentOpened'
  | 'IncidentResolved'
  | 'AlertTriggered'
  | 'SLABreached'
  | 'MetricSampled'
  | 'HeartBeat'
  | 'AuditEvent';

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface MetricSample {
  ts: string;
  executionsPerMinute: number;
  successRate: number;
  avgDurationMs: number;
  failureCount: number;
  queueDepth: number;
  activeConnectors: number;
  agentsOnline: number;
  p95DurationMs: number;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  value: number;
  label: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  component: string;
  status: HealthStatus;
  latencyMs?: number;
  uptimePct?: number;
  details?: string;
  lastChecked: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  uptimeSeconds: number;
  components: ComponentHealth[];
  checkedAt: string;
}

export interface ExecutiveDashboard {
  integrationsActive: number;
  workflowsTotal: number;
  executionsToday: number;
  avgDurationMs: number;
  availabilityPct: number;
  failurePct: number;
  alertsOpen: number;
  incidentsOpen: number;
  slaBreachesToday: number;
  throughputPerMin: number;
  trend: MetricSample[];
  componentHealth: ComponentHealth[];
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type AlertChannel = 'email' | 'webhook' | 'slack' | 'teams' | 'discord' | 'whatsapp';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldownMs: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  triggeredCount: number;
  lastTriggeredAt?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  channels: AlertChannel[];
  deliveredTo: AlertChannel[];
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'FIXED' | 'RESOLVED' | 'CLOSED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IncidentEvent {
  id: string;
  incidentId: string;
  status: IncidentStatus;
  message: string;
  author: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  openedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  cause?: string;
  resolution?: string;
  events: IncidentEvent[];
}

export type AuditOutcome = 'success' | 'failure';

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  outcome: AuditOutcome;
}

export interface SLADefinition {
  id: string;
  name: string;
  description: string;
  workflowId?: string;
  maxDurationMs: number;
  warnThresholdMs: number;
  active: boolean;
  createdAt: string;
  compliancePct: number;
  breachCount: number;
  warnCount: number;
  lastBreachAt?: string;
}

export interface SLAEvent {
  id: string;
  slaId: string;
  slaName: string;
  executionId: string;
  workflowName: string;
  actualDurationMs: number;
  limitMs: number;
  breached: boolean;
  violationType: 'warn' | 'breach';
  timestamp: string;
}

export type TimelineEventType =
  | 'started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'retry'
  | 'condition'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TimelineEvent {
  id: string;
  executionId: string;
  workflowId: string;
  timestamp: string;
  type: TimelineEventType;
  message: string;
  stepId?: string;
  stepType?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}
