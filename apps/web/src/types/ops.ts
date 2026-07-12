// ─── Queue ────────────────────────────────────────────────────────────────────
export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

export interface Job {
  id: string;
  type: string;
  priority: JobPriority;
  payload: Record<string, unknown>;
  tenantId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey?: string;
  createdAt: string;
  scheduledAt: string;
  processedAt: string | null;
  failedAt: string | null;
  error: string | null;
}

export interface QueueStats {
  high: number;
  normal: number;
  low: number;
  dlq: number;
  total: number;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
export type FlagOperator = 'eq' | 'neq' | 'in' | 'notIn' | 'contains';

export interface TargetingRule {
  id: string;
  attribute: string;
  operator: FlagOperator;
  values: string[];
  variant: string;
}

export interface FlagVariant {
  id: string;
  key: string;
  description: string;
  weight: number;
}

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetingRules: TargetingRule[];
  variants: FlagVariant[];
  defaultVariant: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface FlagEvaluationResult {
  flagId: string;
  flagKey: string;
  enabled: boolean;
  variant: string;
  reason: 'disabled' | 'targeting_match' | 'rollout' | 'default';
}

// ─── SLO ─────────────────────────────────────────────────────────────────────
export type SloStatus = 'compliant' | 'warning' | 'breached';

export interface SloDefinition {
  id: string;
  name: string;
  metric: string;
  target: number;
  unit: string;
  current: number;
  status: SloStatus;
  errorBudgetPercent: number;
  windowDays: number;
  description: string;
}

export interface SloSummary {
  compliant: number;
  warning: number;
  breached: number;
  total: number;
}

// ─── DR ──────────────────────────────────────────────────────────────────────
export interface DrConfig {
  rto: number;
  rpo: number;
  primaryRegion: string;
  secondaryRegion: string | null;
  backupSchedule: 'hourly' | 'daily' | 'weekly';
  autoBackup: boolean;
  crossRegionReplication: boolean;
}

export interface Backup {
  id: string;
  type: 'full' | 'incremental' | 'snapshot';
  status: 'pending' | 'running' | 'completed' | 'failed';
  sizeBytes: number;
  region: string;
  startedAt: string;
  completedAt: string | null;
  pitrEnabled: boolean;
}

export interface DrTest {
  id: string;
  type: 'failover' | 'restore' | 'partial';
  status: 'passed' | 'failed' | 'in_progress';
  rtoActual: number | null;
  rpoActual: number | null;
  notes: string;
  executedAt: string;
}

// ─── Circuit Breakers ─────────────────────────────────────────────────────────
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  rejectedRequests: number;
  lastFailureTime: string | null;
  lastStateChange: string;
  openedAt: string | null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface OpsDashboard {
  kpis: {
    sloCompliance: { value: number; total: number; unit: string };
    openCircuits: { value: number; total: number; unit: string };
    queueDepth: { value: number; dlq: number };
    featureFlags: { enabled: number; total: number };
    lastBackup: { completedAt: string | null; type: string; region: string } | null;
  };
  slos: Array<
    Pick<
      SloDefinition,
      'id' | 'name' | 'target' | 'current' | 'unit' | 'status' | 'errorBudgetPercent'
    >
  >;
  circuitBreakers: Array<{
    name: string;
    state: CircuitState;
    failures: number;
    totalRequests: number;
  }>;
  queues: QueueStats;
  generatedAt: string;
}
