/**
 * @seltriva/runtime/health
 * Health Monitoring — readiness, liveness, and dependency health
 *
 * Three probes (matching Kubernetes conventions):
 *   Liveness   — is the process alive? (restart if fails)
 *   Readiness  — can the module serve requests? (remove from load balancer if fails)
 *   Startup    — is the module done initializing? (only relevant during bootstrap)
 *
 * Health checks are registered by modules and polled by HealthMonitor.
 * The platform aggregates individual checks into a composite health report.
 */

import type { RuntimeResult, ModuleId, Severity, TimeRange, Disposable } from '../kernel/index';

// ─── Health Monitor ───────────────────────────────────────────────────────

export interface HealthMonitor {
  /**
   * Register a health check
   */
  register(check: HealthCheck): void;

  /**
   * Unregister a health check
   */
  unregister(checkId: string): void;

  /**
   * Run all registered checks and return composite report
   */
  check(): Promise<HealthReport>;

  /**
   * Run a specific check
   */
  checkOne(checkId: string): Promise<HealthCheckResult>;

  /**
   * Run checks for a specific module
   */
  checkModule(moduleId: ModuleId): Promise<HealthReport>;

  /**
   * Get the latest cached report (from last scheduled run)
   */
  getLatestReport(): HealthReport;

  /**
   * Subscribe to status changes
   */
  onStatusChanged(handler: HealthStatusChangeHandler): Disposable;

  /**
   * Get health history for a time period
   */
  getHistory(period: TimeRange, limit?: number): HealthReport[];

  /**
   * Get health statistics
   */
  getStats(): HealthStats;
}

// ─── Health Check ─────────────────────────────────────────────────────────

export interface HealthCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly moduleId: ModuleId;
  readonly probe: HealthProbeKind;
  readonly severity: Severity;
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly tags?: string[];

  /**
   * Execute the check and return its status
   */
  execute(): Promise<HealthCheckResult>;
}

export type HealthProbeKind = 'liveness' | 'readiness' | 'startup' | 'dependency';

// ─── Health Status ────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ─── Health Check Result ──────────────────────────────────────────────────

export interface HealthCheckResult {
  readonly checkId: string;
  readonly checkName: string;
  readonly moduleId: ModuleId;
  readonly probe: HealthProbeKind;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly durationMs: number;
  readonly timestamp: Date;
  readonly error?: string;
}

// ─── Health Report ────────────────────────────────────────────────────────

export interface HealthReport {
  readonly status: HealthStatus;
  readonly platform: HealthStatus;
  readonly checks: HealthCheckResult[];
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly unhealthyCount: number;
  readonly unknownCount: number;
  readonly checkedAt: Date;
  readonly durationMs: number;
  readonly summary: string;
}

// ─── Status Change ────────────────────────────────────────────────────────

export type HealthStatusChangeHandler = (event: HealthStatusChange) => void;

export interface HealthStatusChange {
  readonly checkId: string;
  readonly moduleId: ModuleId;
  readonly previousStatus: HealthStatus;
  readonly currentStatus: HealthStatus;
  readonly message?: string;
  readonly timestamp: Date;
}

// ─── Built-in Health Check IDs ────────────────────────────────────────────

export const HEALTH_CHECK_IDS = {
  DATABASE_CONNECTIVITY:   'hc-database-connectivity',
  SUPABASE_CONNECTIVITY:   'hc-supabase-connectivity',
  EVENT_BUS_LIVENESS:      'hc-event-bus-liveness',
  COMMAND_BUS_LIVENESS:    'hc-command-bus-liveness',
  SCHEDULER_LIVENESS:      'hc-scheduler-liveness',
  WORKER_POOL_READINESS:   'hc-worker-pool-readiness',
  MEMORY_USAGE:            'hc-memory-usage',
  DISK_USAGE:              'hc-disk-usage',
  PLUGIN_MANAGER_LIVENESS: 'hc-plugin-manager-liveness',
  TELEMETRY_EXPORTER:      'hc-telemetry-exporter',
} as const;

// ─── Health Endpoint Formatter ────────────────────────────────────────────

/**
 * Formats a HealthReport for HTTP health endpoints
 * (/health, /health/ready, /health/live)
 */
export interface HealthEndpointFormatter {
  toLiveness(report: HealthReport): HealthEndpointResponse;
  toReadiness(report: HealthReport): HealthEndpointResponse;
  toFull(report: HealthReport): HealthEndpointResponse;
}

export interface HealthEndpointResponse {
  readonly status: HealthStatus;
  readonly httpStatusCode: 200 | 503;
  readonly body: Record<string, unknown>;
}

// ─── Dependency Health ────────────────────────────────────────────────────

export interface DependencyHealthChecker {
  checkDatabase(connectionString: string, timeoutMs?: number): Promise<HealthCheckResult>;
  checkHttp(url: string, timeoutMs?: number): Promise<HealthCheckResult>;
  checkTcp(host: string, port: number, timeoutMs?: number): Promise<HealthCheckResult>;
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface HealthStats {
  readonly totalChecks: number;
  readonly successfulChecks: number;
  readonly failedChecks: number;
  readonly averageCheckDurationMs: number;
  readonly longestCheckId?: string;
  readonly currentStatus: HealthStatus;
  readonly lastStatusChange?: Date;
}
