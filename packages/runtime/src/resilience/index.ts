/**
 * @seltriva/runtime/resilience
 * Resilience Layer — fault tolerance patterns for the CRP
 *
 * Patterns implemented (as composable policies):
 *   Circuit Breaker — stops calling failing services
 *   Retry           — re-attempts failed operations with backoff
 *   Bulkhead        — limits concurrent calls to a dependency
 *   Timeout         — enforces maximum call duration
 *   Rate Limiter    — controls request rate to a resource
 *   Fallback        — executes alternative when primary fails
 *   Hedging         — issues redundant calls, takes first response
 *
 * Policies are composable via ResiliencePipeline:
 *   pipeline = timeout(5s) → circuit-breaker → retry(3) → bulkhead(10)
 */

import type { RuntimeResult, ModuleId, Priority, TimeRange } from '../kernel/index';

// ─── Resilience Factory ───────────────────────────────────────────────────

export interface ResilienceFactory {
  circuitBreaker(options: CircuitBreakerOptions): CircuitBreaker;
  retry(options: RetryOptions): RetryPolicy;
  bulkhead(options: BulkheadOptions): BulkheadPolicy;
  timeout(options: TimeoutOptions): TimeoutPolicy;
  rateLimiter(options: RateLimiterOptions): RateLimiter;
  fallback<T>(options: FallbackOptions<T>): FallbackPolicy<T>;
  pipeline(...policies: ResiliencePolicy[]): ResiliencePipeline;
}

// ─── Base Policy ──────────────────────────────────────────────────────────

export interface ResiliencePolicy {
  readonly id: string;
  readonly kind: ResiliencePolicyKind;
  execute<T>(operation: ResilienceOperation<T>): Promise<RuntimeResult<T>>;
}

export type ResilienceOperation<T> = () => Promise<T>;

export type ResiliencePolicyKind =
  | 'circuit-breaker'
  | 'retry'
  | 'bulkhead'
  | 'timeout'
  | 'rate-limiter'
  | 'fallback'
  | 'hedge'
  | 'pipeline';

// ─── Circuit Breaker ──────────────────────────────────────────────────────

export interface CircuitBreaker extends ResiliencePolicy {
  readonly kind: 'circuit-breaker';
  readonly state: CircuitState;
  readonly metrics: CircuitBreakerMetrics;

  /**
   * Manually open the circuit (block all calls)
   */
  open(reason?: string): void;

  /**
   * Manually close the circuit (allow calls)
   */
  close(): void;

  /**
   * Reset to initial state
   */
  reset(): void;

  /**
   * Subscribe to state transitions
   */
  onStateChange(handler: CircuitStateChangeHandler): void;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  readonly id: string;
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly timeoutMs: number;
  readonly halfOpenMaxCalls?: number;
  readonly countingWindowMs?: number;
  readonly recordException?: (error: unknown) => boolean;
}

export interface CircuitBreakerMetrics {
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly callCount: number;
  readonly lastStateChange?: Date;
  readonly lastFailureAt?: Date;
}

export type CircuitStateChangeHandler = (from: CircuitState, to: CircuitState, reason?: string) => void;

// ─── Retry Policy ─────────────────────────────────────────────────────────

export interface RetryPolicy extends ResiliencePolicy {
  readonly kind: 'retry';
  readonly metrics: RetryMetrics;
}

export interface RetryOptions {
  readonly id: string;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
  readonly maxDelayMs?: number;
  readonly jitterMs?: number;
  readonly retryOn?: (error: unknown) => boolean;
  readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface RetryMetrics {
  readonly totalAttempts: number;
  readonly totalSuccesses: number;
  readonly totalFailures: number;
  readonly retriesTotal: number;
}

// ─── Bulkhead ─────────────────────────────────────────────────────────────

export interface BulkheadPolicy extends ResiliencePolicy {
  readonly kind: 'bulkhead';
  readonly activeCount: number;
  readonly queueDepth: number;
  readonly metrics: BulkheadMetrics;
}

export interface BulkheadOptions {
  readonly id: string;
  readonly maxConcurrent: number;
  readonly maxQueueDepth: number;
  readonly queueTimeoutMs?: number;
}

export interface BulkheadMetrics {
  readonly executingCount: number;
  readonly queuedCount: number;
  readonly rejectedCount: number;
}

// ─── Timeout ──────────────────────────────────────────────────────────────

export interface TimeoutPolicy extends ResiliencePolicy {
  readonly kind: 'timeout';
}

export interface TimeoutOptions {
  readonly id: string;
  readonly timeoutMs: number;
  readonly onTimeout?: (durationMs: number) => void;
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────

export interface RateLimiter extends ResiliencePolicy {
  readonly kind: 'rate-limiter';
  readonly metrics: RateLimiterMetrics;

  /**
   * Check whether a request is permitted right now
   */
  tryAcquire(): boolean;

  /**
   * Wait until a permit is available
   */
  acquire(timeoutMs?: number): Promise<boolean>;
}

export interface RateLimiterOptions {
  readonly id: string;
  readonly kind: 'token-bucket' | 'sliding-window' | 'fixed-window';
  readonly permitsPerSecond: number;
  readonly burstCapacity?: number;
  readonly windowMs?: number;
}

export interface RateLimiterMetrics {
  readonly permittedCount: number;
  readonly rejectedCount: number;
  readonly currentPermits: number;
}

// ─── Fallback ─────────────────────────────────────────────────────────────

export interface FallbackPolicy<T> extends ResiliencePolicy {
  readonly kind: 'fallback';
}

export interface FallbackOptions<T> {
  readonly id: string;
  readonly fallback: T | (() => T | Promise<T>);
  readonly handleException?: (error: unknown) => boolean;
}

// ─── Resilience Pipeline ──────────────────────────────────────────────────

/**
 * Composable pipeline that applies policies in order:
 *   timeout → circuit-breaker → retry → bulkhead
 *
 * Policies wrap each other: outermost executes first.
 */
export interface ResiliencePipeline extends ResiliencePolicy {
  readonly kind: 'pipeline';
  readonly policies: ResiliencePolicy[];
}

// ─── Resilience Registry ──────────────────────────────────────────────────

export interface ResilienceRegistry {
  register(id: string, policy: ResiliencePolicy): void;
  get(id: string): ResiliencePolicy | null;
  getForModule(moduleId: ModuleId): ResiliencePolicy[];
  getAll(): ResiliencePolicy[];
  getMetrics(): ResilienceMetricsSnapshot;
}

export interface ResilienceMetricsSnapshot {
  readonly circuitBreakers: Array<{ id: string; state: CircuitState; metrics: CircuitBreakerMetrics }>;
  readonly retries: Array<{ id: string; metrics: RetryMetrics }>;
  readonly rateLimiters: Array<{ id: string; metrics: RateLimiterMetrics }>;
  readonly snapshotAt: Date;
}
