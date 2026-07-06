/**
 * @seltriva/cloud — health
 * Platform health monitoring: liveness, readiness, and dependency checks.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface IHealthMonitor {
  check(): Promise<PlatformHealthReport>;
  liveness(): Promise<LivenessResult>;
  readiness(): Promise<ReadinessResult>;
  register(check: HealthCheck): void;
  unregister(checkId: string): void;
}

export interface HealthCheck {
  readonly id: string;
  readonly name: string;
  readonly critical: boolean;
  readonly timeoutMs?: number;
  execute(): Promise<HealthCheckResult>;
}

export interface PlatformHealthReport {
  readonly status: HealthStatus;
  readonly version: string;
  readonly timestamp: Date;
  readonly uptime: number;
  readonly checks: HealthCheckResult[];
  readonly summary: HealthSummary;
}

export interface HealthCheckResult {
  readonly id: string;
  readonly name: string;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly durationMs: number;
  readonly checkedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface HealthSummary {
  readonly totalChecks: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly unhealthyCount: number;
  readonly criticalFailures: string[];
}

export interface LivenessResult {
  readonly alive: boolean;
  readonly timestamp: Date;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly timestamp: Date;
  readonly checks: HealthCheckResult[];
}

export const HEALTH_CHECK_IDS = {
  DATABASE:        'hc-database',
  SUPABASE:        'hc-supabase',
  REDIS:           'hc-redis',
  STORAGE:         'hc-storage',
  EMAIL:           'hc-email',
  QUEUE:           'hc-queue',
  SCHEDULER:       'hc-scheduler',
} as const;
