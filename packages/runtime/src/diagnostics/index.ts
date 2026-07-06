/**
 * @seltriva/runtime/diagnostics
 * Diagnostics — runtime introspection, profiling, and debug snapshots
 *
 * Diagnostics provides a window into the running platform:
 *   - Runtime state snapshots (all modules, services, jobs, workers)
 *   - Memory profiling and leak detection
 *   - Dependency graph visualization
 *   - Audit trail of significant platform events
 *   - Debug mode with verbose instrumentation
 *
 * Diagnostics data is never sent externally by default —
 * it is available through the internal diagnostics interface only.
 */

import type {
  RuntimeResult, ModuleId, Severity, TimeRange,
} from '../kernel/index';
import type { LifecycleState } from '../lifecycle/index';
import type { HealthStatus } from '../health/index';
import type { CircuitState } from '../resilience/index';

// ─── Diagnostics Provider ─────────────────────────────────────────────────

export interface DiagnosticsProvider {
  /**
   * Take a complete snapshot of the platform state
   */
  snapshot(): Promise<PlatformSnapshot>;

  /**
   * Get the current platform topology (modules + dependencies)
   */
  getTopology(): PlatformTopology;

  /**
   * Run a named diagnostic check
   */
  runCheck(checkId: string): Promise<DiagnosticCheckResult>;

  /**
   * Run all diagnostic checks
   */
  runAllChecks(): Promise<DiagnosticReport>;

  /**
   * Get the audit trail
   */
  getAuditTrail(filter?: AuditFilter): AuditEntry[];

  /**
   * Get memory usage breakdown
   */
  getMemoryProfile(): MemoryProfile;

  /**
   * Get the dependency graph
   */
  getDependencyGraph(): DependencyGraphView;

  /**
   * Enable/disable verbose debug mode
   */
  setDebugMode(enabled: boolean, modules?: ModuleId[]): void;

  /**
   * Register a custom diagnostic check
   */
  registerCheck(check: DiagnosticCheck): void;
}

// ─── Platform Snapshot ────────────────────────────────────────────────────

export interface PlatformSnapshot {
  readonly id: string;
  readonly takenAt: Date;
  readonly platform: PlatformStateView;
  readonly modules: ModuleStateView[];
  readonly services: ServiceStateView[];
  readonly scheduledJobs: JobStateView[];
  readonly workerPools: WorkerPoolStateView[];
  readonly plugins: PluginStateView[];
  readonly resilience: ResilienceStateView;
  readonly health: HealthStateView;
  readonly memory: MemoryProfile;
}

export interface PlatformStateView {
  readonly isReady: boolean;
  readonly isShuttingDown: boolean;
  readonly environment: string;
  readonly version: string;
  readonly uptimeMs: number;
  readonly startedAt: Date;
}

export interface ModuleStateView {
  readonly id: ModuleId;
  readonly name: string;
  readonly kind: string;
  readonly state: LifecycleState;
  readonly errorCount: number;
  readonly uptimeMs?: number;
}

export interface ServiceStateView {
  readonly token: string;
  readonly scope: string;
  readonly providedBy: ModuleId;
  readonly isHealthy?: boolean;
}

export interface JobStateView {
  readonly id: string;
  readonly name: string;
  readonly isPaused: boolean;
  readonly lastRunAt?: Date;
  readonly nextRunAt?: Date;
  readonly lastStatus?: string;
}

export interface WorkerPoolStateView {
  readonly id: string;
  readonly name: string;
  readonly workerCount: number;
  readonly busyWorkers: number;
  readonly queueDepth: number;
}

export interface PluginStateView {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: string;
  readonly sandboxLevel: string;
}

export interface ResilienceStateView {
  readonly circuitBreakers: Array<{
    id: string;
    state: CircuitState;
    failureCount: number;
  }>;
  readonly rateLimiters: Array<{
    id: string;
    permittedCount: number;
    rejectedCount: number;
  }>;
}

export interface HealthStateView {
  readonly status: HealthStatus;
  readonly unhealthyModules: ModuleId[];
  readonly degradedModules: ModuleId[];
}

// ─── Platform Topology ────────────────────────────────────────────────────

export interface PlatformTopology {
  readonly nodes: TopologyNode[];
  readonly edges: TopologyEdge[];
  readonly cycles: ModuleId[][];
}

export interface TopologyNode {
  readonly id: ModuleId;
  readonly name: string;
  readonly kind: string;
  readonly state: LifecycleState;
  readonly level: number;
}

export interface TopologyEdge {
  readonly from: ModuleId;
  readonly to: ModuleId;
  readonly kind: 'depends-on' | 'provides-for' | 'communicates-with';
}

// ─── Diagnostic Checks ────────────────────────────────────────────────────

export interface DiagnosticCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: Severity;
  readonly category: DiagnosticCategory;
  execute(): Promise<DiagnosticCheckResult>;
}

export type DiagnosticCategory =
  | 'configuration'
  | 'connectivity'
  | 'performance'
  | 'memory'
  | 'security'
  | 'integrity'
  | 'compatibility';

export interface DiagnosticCheckResult {
  readonly checkId: string;
  readonly checkName: string;
  readonly status: 'pass' | 'warn' | 'fail' | 'skip';
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly durationMs: number;
  readonly checkedAt: Date;
}

export interface DiagnosticReport {
  readonly takenAt: Date;
  readonly overallStatus: 'pass' | 'warn' | 'fail';
  readonly checks: DiagnosticCheckResult[];
  readonly passCount: number;
  readonly warnCount: number;
  readonly failCount: number;
  readonly skipCount: number;
  readonly summary: string;
}

// ─── Audit Trail ──────────────────────────────────────────────────────────

export interface AuditEntry {
  readonly id: string;
  readonly category: AuditCategory;
  readonly severity: Severity;
  readonly action: string;
  readonly actor: string;
  readonly target?: string;
  readonly outcome: 'success' | 'failure' | 'denied';
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;
}

export type AuditCategory =
  | 'module-lifecycle'
  | 'plugin-lifecycle'
  | 'service-registration'
  | 'configuration-change'
  | 'permission-check'
  | 'security-violation'
  | 'job-execution'
  | 'platform-event';

export interface AuditFilter {
  readonly categories?: AuditCategory[];
  readonly severity?: Severity;
  readonly actor?: string;
  readonly period?: TimeRange;
  readonly limit?: number;
}

// ─── Memory Profile ───────────────────────────────────────────────────────

export interface MemoryProfile {
  readonly heapUsedMb: number;
  readonly heapTotalMb: number;
  readonly externalMb: number;
  readonly rssMb: number;
  readonly usagePercent: number;
  readonly topConsumers?: Array<{ label: string; estimatedMb: number }>;
  readonly profiledAt: Date;
}

// ─── Dependency Graph View ────────────────────────────────────────────────

export interface DependencyGraphView {
  readonly startupOrder: ModuleId[];
  readonly shutdownOrder: ModuleId[];
  readonly independentModules: ModuleId[];
  readonly criticalPath: ModuleId[];
  readonly hasCircularDependencies: boolean;
  readonly cycles: ModuleId[][];
}
