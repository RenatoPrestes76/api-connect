import type { ConnectorMetadata } from './metadata.js';

// ─── Result wrapper ────────────────────────────────────────────────────────────

export interface ConnectorResult<T = void> {
  readonly ok:        boolean;
  readonly data?:     T;
  readonly error?:    ConnectorError;
  readonly durationMs: number;
}

export interface ConnectorError {
  readonly code:    string;
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?:  Error;
}

export function ok<T>(data: T, durationMs = 0): ConnectorResult<T> {
  return { ok: true, data, durationMs };
}

export function fail(code: string, message: string, retryable = false, cause?: Error): ConnectorResult<never> {
  return { ok: false, error: { code, message, retryable, cause }, durationMs: 0 };
}

// ─── Discovery ─────────────────────────────────────────────────────────────────

export interface DiscoveredEntity {
  readonly id:       string;
  readonly name:     string;
  readonly type:     string;
  readonly path?:    string;
  readonly children?: DiscoveredEntity[];
  readonly extra?:   Record<string, unknown>;
}

export interface DiscoveryResult {
  readonly entities:     DiscoveredEntity[];
  readonly total:        number;
  readonly discoveredAt: Date;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid:    boolean;
  readonly errors:   ValidationIssue[];
  readonly warnings: ValidationIssue[];
}

export interface ValidationIssue {
  readonly field:   string;
  readonly code:    string;
  readonly message: string;
}

// ─── Sync ──────────────────────────────────────────────────────────────────────

export interface SyncContext {
  readonly jobId:        string;
  readonly since?:       Date;
  readonly entities?:    string[];
  readonly batchSize?:   number;
}

export interface SyncResult {
  readonly synced:     number;
  readonly skipped:    number;
  readonly failed:     number;
  readonly errors:     SyncError[];
  readonly finishedAt: Date;
}

export interface SyncError {
  readonly entityId: string;
  readonly code:     string;
  readonly message:  string;
}

// ─── Health ────────────────────────────────────────────────────────────────────

export type HealthStatusKind = 'healthy' | 'degraded' | 'unhealthy';

export interface ConnectorHealthStatus {
  readonly status:         HealthStatusKind;
  readonly responseTimeMs: number;
  readonly lastSync?:      Date;
  readonly lastFailure?:   Date;
  readonly uptimeSince?:   Date;
  readonly message?:       string;
}

// ─── The Connector interface ───────────────────────────────────────────────────

/**
 * The single interface every connector must implement.
 * The Runtime calls only this interface — it never calls provider code directly.
 */
export interface Connector {
  /** Immutable identity and capability declaration. */
  metadata(): ConnectorMetadata;

  /** Establish connection to the data source. */
  connect(): Promise<ConnectorResult<void>>;

  /** Gracefully close the connection. */
  disconnect(): Promise<ConnectorResult<void>>;

  /** Validate configuration without a real connection. */
  validate(): Promise<ConnectorResult<ValidationResult>>;

  /** Enumerate available entities (tables, endpoints, files, …). */
  discover(): Promise<ConnectorResult<DiscoveryResult>>;

  /** Pull or push data according to the sync context. */
  synchronize(context: SyncContext): Promise<ConnectorResult<SyncResult>>;

  /** Return the current health of the underlying data source. */
  health(): Promise<ConnectorResult<ConnectorHealthStatus>>;
}

/** Factory function signature — every plugin entry point must export this as default. */
export type ConnectorFactory = (context: import('../core/connector-context.js').ConnectorContext) => Connector;
