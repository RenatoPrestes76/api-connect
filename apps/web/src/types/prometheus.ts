export type SpanStatus = 'ok' | 'error' | 'timeout';
export type NodeStatus = 'healthy' | 'degraded' | 'down';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyStatus = 'active' | 'investigating' | 'resolved';
export type IncidentStatus = 'open' | 'investigating' | 'resolved';
export type AlertType = 'disk' | 'memory' | 'cpu' | 'connections' | 'latency' | 'error_rate';
export type RecommendationCategory =
  | 'performance'
  | 'cost'
  | 'reliability'
  | 'scaling'
  | 'security';
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed';
export type HealingTrigger =
  | 'agent_down'
  | 'high_error_rate'
  | 'memory_leak'
  | 'connector_timeout'
  | 'worker_overload';
export type HealingAction =
  | 'restart_service'
  | 'migrate_agent'
  | 'scale_up'
  | 'failover'
  | 'clear_cache';
export type SLOStatus = 'healthy' | 'at_risk' | 'breached';
export type RunbookMode = 'manual' | 'assisted' | 'automatic';
export type RunbookStepType = 'check' | 'action' | 'decision' | 'notify';
export type CapacityUrgency = 'low' | 'medium' | 'high' | 'critical';
export type IncidentEventType = 'detection' | 'escalation' | 'action' | 'resolution';
export type DashboardType = 'executive' | 'operations' | 'ai' | 'connectors';

export interface Span {
  spanId: string;
  parentSpanId?: string;
  service: string;
  operation: string;
  startedAt: string;
  durationMs: number;
  status: SpanStatus;
  tags?: Record<string, string>;
}

export interface Trace {
  traceId: string;
  rootService: string;
  operation: string;
  startedAt: string;
  totalDurationMs: number;
  spanCount: number;
  status: SpanStatus;
  spans: Span[];
  tenantId?: string;
}

export interface ServiceNode {
  id: string;
  name: string;
  type: string;
  status: NodeStatus;
  requestsPerMin: number;
  errorRate: number;
  avgLatencyMs: number;
}

export interface ServiceEdge {
  source: string;
  target: string;
  requestsPerMin: number;
  errorRate: number;
}

export interface ServiceMap {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  generatedAt: string;
}

export interface TelemetryOverview {
  totalTraces: number;
  errorTraces: number;
  timeoutTraces: number;
  avgDurationMs: number;
  p99DurationMs: number;
  servicesHealthy: number;
  servicesDegraded: number;
  servicesDown: number;
  servicesTotal: number;
  logsPerMin: number;
  activeAlerts: number;
  openIncidents: number;
}

export interface ExecutiveDashboard {
  slaUptime: number;
  activeClients: number;
  monthlyRevenue: number;
  monthlyInfrastructureCost: number;
  availability: number;
  openIncidents: number;
  resolvedToday: number;
  mttrMinutes: number;
}

export interface OperationsDashboard {
  cpuUsage: number;
  memoryUsage: number;
  networkThroughputMbps: number;
  dbConnections: number;
  activeWorkers: number;
  totalWorkers: number;
  queueDepth: number;
  avgProcessingTimeMs: number;
  nodesHealthy: number;
  nodesTotal: number;
}

export interface AIDashboard {
  tokensUsedToday: number;
  aiCostToday: number;
  modelsInUse: string[];
  avgInferenceLatencyMs: number;
  accuracyRate: number;
  cacheHitRate: number;
  totalInferencesToday: number;
}

export interface ConnectorMetric {
  id: string;
  name: string;
  type: string;
  successRate: number;
  failureCount: number;
  avgLatencyMs: number;
  volumeToday: number;
  lastSyncAt: string;
  availability: number;
}

export interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  probability: number;
  source: string;
  metric: string;
  normalValue: number;
  detectedValue: number;
  unit: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface IncidentTimelineEvent {
  timestamp: string;
  description: string;
  type: IncidentEventType;
}

export interface RCAHypothesis {
  component: string;
  hypothesis: string;
  confidence: number;
  evidence: string[];
}

export interface Incident {
  id: string;
  title: string;
  severity: AnomalySeverity;
  status: IncidentStatus;
  affectedServices: string[];
  detectedAt: string;
  resolvedAt?: string;
  timeline: IncidentTimelineEvent[];
  rca: RCAHypothesis[];
}

export interface PredictiveAlert {
  id: string;
  type: AlertType;
  resource: string;
  currentValue: number;
  thresholdValue: number;
  unit: string;
  trendPerDay: number;
  predictedFailureInDays: number;
  confidence: number;
  recommendation: string;
  createdAt: string;
}

export interface AIRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  estimatedImpact: string;
  estimatedSavingPercent?: number;
  estimatedSavingMs?: number;
  confidence: number;
  status: RecommendationStatus;
  createdAt: string;
  appliedAt?: string;
}

export interface SelfHealingRule {
  id: string;
  name: string;
  trigger: HealingTrigger;
  action: HealingAction;
  enabled: boolean;
  executionCount: number;
  lastTriggeredAt?: string;
  successRate: number;
  description: string;
}

export interface SLOTarget {
  id: string;
  tenantId: string;
  tenantName: string;
  targetUptime: number;
  currentUptime: number;
  errorBudgetMinutes: number;
  errorBudgetUsed: number;
  status: SLOStatus;
  period: string;
  incidentsThisMonth: number;
}

export interface CapacityForecast {
  resource: string;
  currentValue: number;
  unit: string;
  forecast6Months: number;
  forecast12Months: number;
  recommendedAddition: string;
  urgency: CapacityUrgency;
}

export interface CapacityPlan {
  generatedAt: string;
  currentClients: number;
  forecastedClients6m: number;
  forecastedClients12m: number;
  forecasts: CapacityForecast[];
}

export interface TenantCostBreakdown {
  tenantId: string;
  tenantName: string;
  period: string;
  apiCost: number;
  aiCost: number;
  storageCost: number;
  networkCost: number;
  workerCost: number;
  totalCost: number;
}

export interface WorkflowCost {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  totalCost: number;
  avgCostPerExecution: number;
}

export interface CostReport {
  period: string;
  tenants: TenantCostBreakdown[];
  topWorkflows: WorkflowCost[];
  totalPlatformCost: number;
  totalRevenue: number;
  margin: number;
  generatedAt: string;
}

export interface RunbookStep {
  order: number;
  title: string;
  description: string;
  type: RunbookStepType;
  automated: boolean;
  estimatedDurationSeconds: number;
}

export interface Runbook {
  id: string;
  title: string;
  trigger: string;
  mode: RunbookMode;
  steps: RunbookStep[];
  lastUsedAt?: string;
  executionCount: number;
  avgResolutionMinutes: number;
  createdAt: string;
}

export interface CopilotResponse {
  question: string;
  answer: string;
  sources: string[];
  confidence: number;
  generatedAt: string;
  relatedMetrics: Array<{ label: string; value: string }>;
}
