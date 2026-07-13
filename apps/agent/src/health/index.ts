/**
 * @seltriva/agent — health
 * Agent health monitoring and heartbeat.
 *
 * Health checks:
 *   - CPU usage
 *   - Memory usage
 *   - Disk usage
 *   - Database connector latency
 *   - Cloud connectivity
 *   - Sync engine status
 *   - Offline queue depth
 *   - Scheduler status
 *
 * Heartbeat:
 *   The agent sends a periodic heartbeat to the Seltriva cloud.
 *   If the cloud does not receive a heartbeat within the configured
 *   interval, it marks the agent as offline.
 */

import type { AgentResult, ConnectorId } from '../configuration/index';

// ─── Health Monitor ───────────────────────────────────────────────────────

export interface HealthMonitor {
  /**
   * Run all registered health checks and return a consolidated report
   */
  check(): Promise<AgentResult<HealthReport>>;

  /**
   * Run a specific check by ID
   */
  checkOne(checkId: string): Promise<AgentResult<HealthCheckResult>>;

  /**
   * Register a custom health check
   */
  register(check: HealthCheck): void;

  /**
   * Remove a health check
   */
  unregister(checkId: string): void;

  /**
   * Get the last health report (without running checks)
   */
  getLastReport(): HealthReport | null;

  /**
   * Get current overall health status
   */
  getStatus(): HealthStatus;

  /**
   * Subscribe to health status changes
   */
  onStatusChange(handler: HealthStatusChangeHandler): HealthSubscription;

  /**
   * Start continuous background monitoring
   */
  startMonitoring(intervalMs: number): void;

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void;

  readonly isMonitoring: boolean;
}

// ─── Health Check ─────────────────────────────────────────────────────────

export interface HealthCheck {
  readonly id: string;
  readonly name: string;
  readonly kind: HealthCheckKind;
  readonly critical: boolean;
  execute(): Promise<HealthCheckResult>;
}

export type HealthCheckKind =
  | 'system-cpu'
  | 'system-memory'
  | 'system-disk'
  | 'database-connectivity'
  | 'cloud-connectivity'
  | 'sync-status'
  | 'queue-depth'
  | 'scheduler'
  | 'custom';

// ─── Health Report ────────────────────────────────────────────────────────

export interface HealthReport {
  readonly overallStatus: HealthStatus;
  readonly checks: HealthCheckResult[];
  readonly system: SystemMetrics;
  readonly connectors: ConnectorHealthStatus[];
  readonly sync: SyncHealthStatus;
  readonly cloud: CloudHealthStatus;
  readonly generatedAt: Date;
  readonly generationDurationMs: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  readonly id: string;
  readonly name: string;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly metrics?: Record<string, number>;
  readonly durationMs: number;
  readonly checkedAt: Date;
}

// ─── System Metrics ───────────────────────────────────────────────────────

export interface SystemMetrics {
  readonly cpu: CPUMetrics;
  readonly memory: MemoryMetrics;
  readonly disk: DiskMetrics;
  readonly process: ProcessMetrics;
  readonly network: NetworkMetrics;
}

export interface CPUMetrics {
  readonly usagePercent: number;
  readonly coreCount: number;
  readonly model: string;
  readonly loadAverage: [number, number, number];
}

export interface MemoryMetrics {
  readonly totalMb: number;
  readonly usedMb: number;
  readonly availableMb: number;
  readonly usagePercent: number;
  readonly heapUsedMb: number;
  readonly heapTotalMb: number;
}

export interface DiskMetrics {
  readonly mount: string;
  readonly totalGb: number;
  readonly usedGb: number;
  readonly availableGb: number;
  readonly usagePercent: number;
}

export interface ProcessMetrics {
  readonly pid: number;
  readonly uptimeMs: number;
  readonly version: string;
  readonly nodeVersion: string;
  readonly rssBytes: number;
}

export interface NetworkMetrics {
  readonly interfaceName: string;
  readonly rxBytesPerSec?: number;
  readonly txBytesPerSec?: number;
  readonly latencyMs?: number;
}

// ─── Connector Health ─────────────────────────────────────────────────────

export interface ConnectorHealthStatus {
  readonly connectorId: ConnectorId;
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs?: number;
  readonly errorMessage?: string;
  readonly checkedAt: Date;
}

// ─── Sync Health ──────────────────────────────────────────────────────────

export interface SyncHealthStatus {
  readonly status: HealthStatus;
  readonly lastSyncAt?: Date;
  readonly consecutiveFailures: number;
  readonly queueDepth: number;
  readonly isOnlineMode: boolean;
}

// ─── Cloud Health ─────────────────────────────────────────────────────────

export interface CloudHealthStatus {
  readonly status: HealthStatus;
  readonly latencyMs?: number;
  readonly isAuthenticated: boolean;
  readonly sessionExpiresAt?: Date;
  readonly lastContactAt?: Date;
}

// ─── Heartbeat Service ────────────────────────────────────────────────────

export interface HeartbeatService {
  /**
   * Start sending heartbeats
   */
  start(intervalMs: number): void;

  /**
   * Stop sending heartbeats
   */
  stop(): void;

  /**
   * Send an immediate heartbeat (out-of-cycle)
   */
  ping(): Promise<AgentResult<void>>;

  /**
   * Get the last heartbeat result
   */
  getLastHeartbeat(): HeartbeatRecord | null;

  readonly isRunning: boolean;
}

export interface HeartbeatRecord {
  readonly sentAt: Date;
  readonly acknowledgedAt?: Date;
  readonly latencyMs?: number;
  readonly success: boolean;
  readonly error?: string;
}

// ─── Threshold Evaluation ─────────────────────────────────────────────────

export interface ThresholdEvaluator {
  evaluate(metrics: SystemMetrics, thresholds: HealthThresholds): ThresholdViolation[];
}

export interface HealthThresholds {
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly diskPercent: number;
  readonly latencyMs: number;
  readonly queueDepth: number;
}

export interface ThresholdViolation {
  readonly metric: string;
  readonly actual: number;
  readonly threshold: number;
  readonly severity: 'warn' | 'critical';
}

// ─── Health Check IDs ─────────────────────────────────────────────────────

export const HEALTH_CHECK_IDS = {
  SYSTEM_CPU: 'hc-system-cpu',
  SYSTEM_MEMORY: 'hc-system-memory',
  SYSTEM_DISK: 'hc-system-disk',
  DATABASE_CONNECTIVITY: 'hc-database-connectivity',
  CLOUD_CONNECTIVITY: 'hc-cloud-connectivity',
  SYNC_ENGINE: 'hc-sync-engine',
  OFFLINE_QUEUE: 'hc-offline-queue',
  SCHEDULER: 'hc-scheduler',
} as const;

// ─── Events ───────────────────────────────────────────────────────────────

export type HealthStatusChangeHandler = (
  previous: HealthStatus,
  current: HealthStatus,
  report: HealthReport
) => void;

export interface HealthSubscription {
  unsubscribe(): void;
}
