/**
 * @seltriva/agent — diagnostics
 * Runtime inspection, diagnostic reports, and the `doctor` command.
 *
 * The diagnostics module provides:
 *   - Pre-flight checks (before startup)
 *   - Runtime inspection (while running)
 *   - Diagnostic bundles (for support)
 */

import type { AgentResult } from '../configuration/index';
import type { HealthReport } from '../health/index';

// ─── Agent Diagnostics ────────────────────────────────────────────────────

export interface AgentDiagnostics {
  /**
   * Run all diagnostic checks and produce a report
   */
  run(): Promise<AgentResult<DiagnosticReport>>;

  /**
   * Run pre-flight checks before the agent starts
   */
  preflight(): Promise<AgentResult<PreflightReport>>;

  /**
   * Run a specific check by ID
   */
  runCheck(checkId: string): Promise<DiagnosticCheckResult>;

  /**
   * Register a custom diagnostic check
   */
  registerCheck(check: DiagnosticCheck): void;

  /**
   * Create a diagnostic bundle (zip file for support)
   */
  createBundle(outputDir: string): Promise<AgentResult<DiagnosticBundle>>;

  /**
   * Get the last diagnostic report
   */
  getLastReport(): DiagnosticReport | null;
}

// ─── Diagnostic Check ─────────────────────────────────────────────────────

export interface DiagnosticCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: DiagnosticCategory;
  readonly critical: boolean;
  execute(): Promise<DiagnosticCheckResult>;
}

export type DiagnosticCategory =
  | 'configuration'
  | 'connectivity'
  | 'security'
  | 'filesystem'
  | 'runtime'
  | 'connector'
  | 'cloud'
  | 'sync'
  | 'performance';

// ─── Diagnostic Results ───────────────────────────────────────────────────

export interface DiagnosticCheckResult {
  readonly id: string;
  readonly name: string;
  readonly category: DiagnosticCategory;
  readonly status: DiagnosticStatus;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly suggestion?: string;
  readonly docUrl?: string;
  readonly durationMs: number;
  readonly checkedAt: Date;
}

export type DiagnosticStatus = 'pass' | 'warn' | 'fail' | 'skip';

// ─── Diagnostic Report ────────────────────────────────────────────────────

export interface DiagnosticReport {
  readonly agentId: string;
  readonly version: string;
  readonly generatedAt: Date;
  readonly overallStatus: DiagnosticStatus;
  readonly checks: DiagnosticCheckResult[];
  readonly health?: HealthReport;
  readonly summary: DiagnosticSummary;
  readonly environment: DiagnosticEnvironment;
}

export interface DiagnosticSummary {
  readonly totalChecks: number;
  readonly passCount: number;
  readonly warnCount: number;
  readonly failCount: number;
  readonly skipCount: number;
  readonly criticalFailures: string[];
  readonly recommendations: string[];
}

export interface DiagnosticEnvironment {
  readonly os: string;
  readonly arch: string;
  readonly nodeVersion: string;
  readonly agentVersion: string;
  readonly environment: string;
  readonly dataDir: string;
  readonly configPath?: string;
}

// ─── Preflight Report ─────────────────────────────────────────────────────

export interface PreflightReport {
  readonly canStart: boolean;
  readonly checks: DiagnosticCheckResult[];
  readonly blockers: string[];
  readonly warnings: string[];
}

// ─── Diagnostic Bundle ────────────────────────────────────────────────────

export interface DiagnosticBundle {
  readonly bundleId: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly includes: string[];
}

// ─── Built-in Diagnostic Check IDs ───────────────────────────────────────

export const DIAGNOSTIC_CHECK_IDS = {
  CONFIG_FILE_EXISTS:       'dc-config-file-exists',
  CONFIG_VALID:             'dc-config-valid',
  DATA_DIR_WRITABLE:        'dc-data-dir-writable',
  ENCRYPTION_KEY_READABLE:  'dc-encryption-key-readable',
  TLS_CERTS_VALID:          'dc-tls-certs-valid',
  NODE_VERSION:             'dc-node-version',
  DISK_SPACE:               'dc-disk-space',
  DB_CONNECTOR_REACHABLE:   'dc-db-connector-reachable',
  DB_USER_READONLY:         'dc-db-user-readonly',
  CLOUD_REACHABLE:          'dc-cloud-reachable',
  CLOUD_AUTH_VALID:         'dc-cloud-auth-valid',
  AGENT_REGISTERED:         'dc-agent-registered',
  SYNC_QUEUE_HEALTHY:       'dc-sync-queue-healthy',
  PLUGINS_VALID:            'dc-plugins-valid',
} as const;
