// ─── Redis ───────────────────────────────────────────────────────────────────
export interface RedisSetOptions {
  ex?: number; // seconds
  px?: number; // milliseconds
  nx?: boolean; // set if not exists
  xx?: boolean; // set if exists
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  clock?: () => number;
}

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

export interface FlagEvaluationContext {
  tenantId?: string;
  userId?: string;
  plan?: string;
  [key: string]: string | undefined;
}

export interface FlagEvaluationResult {
  flagId: string;
  flagKey: string;
  enabled: boolean;
  variant: string;
  reason: 'disabled' | 'targeting_match' | 'rollout' | 'default';
}

// ─── Health Check ─────────────────────────────────────────────────────────────
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  responseTime: number;
  message?: string;
  lastChecked: string;
  metadata?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  version: string;
  uptime: number;
  checks: HealthCheckResult[];
  timestamp: string;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  count: number;
}

export interface ThroughputStats {
  requestsPerSecond: number;
  requestsPerMinute: number;
  totalRequests: number;
}

export interface ErrorRateStats {
  errorRate: number;
  errorCount: number;
  totalCount: number;
  lastError?: string;
  lastErrorTime?: string;
}

export interface MetricsSnapshot {
  latency: LatencyStats;
  throughput: ThroughputStats;
  errorRate: ErrorRateStats;
  timestamp: string;
}

// ─── Bulkhead ─────────────────────────────────────────────────────────────────
export interface BulkheadOptions {
  maxConcurrent?: number;
  maxQueue?: number;
  queueTimeoutMs?: number;
  clock?: () => number;
}

export interface BulkheadMetrics {
  name: string;
  maxConcurrent: number;
  maxQueue: number;
  active: number;
  queued: number;
  totalAccepted: number;
  totalRejected: number;
  totalTimedOut: number;
  totalCompleted: number;
}

// ─── Retry / Timeout ────────────────────────────────────────────────────────
export type JitterStrategy = 'none' | 'full' | 'equal';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: JitterStrategy;
  retryable?: (error: unknown) => boolean;
  onAttempt?: (attempt: number, delayMs: number, error: unknown) => void;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

export class TimeoutError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

// ─── Distributed Lock ─────────────────────────────────────────────────────────
export interface LockAcquisition {
  resource: string;
  token: string;
  acquiredAt: string;
  ttlMs: number;
}
