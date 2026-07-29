import type { SqlDialect, SqlParameter } from '../sql-generator/types.js';

/**
 * DISPATCHED covers both "claimed by the Runtime" and "actively running" —
 * there is no separate heartbeat-while-executing signal in this pipeline
 * (the Runtime reports once, on completion), so RUNNING exists in the type
 * union for semantic completeness with the spec but is never independently
 * observed; a caller polling GET /:id will only ever see QUEUED, DISPATCHED,
 * or a terminal status.
 */
export type ExecutionStatus =
  | 'QUEUED'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export const TERMINAL_EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
];

export interface QueryExecutionResult {
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
  readonly totalRows: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

export interface QueryExecutionLogEntry {
  readonly at: string;
  readonly event: string;
  readonly detail?: string;
}

export interface QueryExecutionRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly runtimeId: string;
  readonly profileId: string;
  readonly generatedQueryId: string;
  readonly queryPlanId: string;
  readonly canonicalVersion: string;
  /** Snapshot of the SQL/dialect/parameters at dispatch time — immutable audit trail even if the GeneratedQuery is later regenerated. */
  readonly sql: string;
  readonly dialect: SqlDialect;
  readonly parameters: readonly SqlParameter[];
  status: ExecutionStatus;
  attempts: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  error: string | null;
  /** Full result set, capped at MAX_STORED_ROWS — GET /:id paginates over this without re-executing. */
  storedRows: Record<string, unknown>[] | null;
  storedColumns: string[] | null;
  totalRows: number | null;
  readonly requestedBy: string;
  readonly createdAt: string;
  scheduledAt: string;
  dispatchedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  logs: QueryExecutionLogEntry[];
}

export interface QueryExecutionDTO {
  id: string;
  organizationId: string;
  runtimeId: string;
  profileId: string;
  generatedQueryId: string;
  queryPlanId: string;
  canonicalVersion: string;
  dialect: SqlDialect;
  status: ExecutionStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  totalRows: number | null;
  requestedBy: string;
  createdAt: string;
  dispatchedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface CreateExecutionInput {
  organizationId: string;
  generatedQueryId: string;
  requestedBy: string;
  maxAttempts?: number;
  timeoutMs?: number;
}

export type CreateExecutionError =
  | 'GENERATED_QUERY_NOT_FOUND'
  | 'GENERATED_QUERY_ORGANIZATION_MISMATCH'
  | 'CONNECTION_PROFILE_NOT_FOUND'
  | 'RUNTIME_NOT_FOUND'
  | 'RUNTIME_OFFLINE';

export interface ReportExecutionResultInput {
  executionId: string;
  runtimeId: string;
  success: boolean;
  /** Set false for a permanent failure (bad SQL, permission denied) that should never be retried. Defaults to true. */
  transient?: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  totalRows?: number;
  error?: string;
}

export type ReportExecutionResultError = 'EXECUTION_NOT_FOUND' | 'RUNTIME_MISMATCH';

export type CancelExecutionError =
  | 'EXECUTION_NOT_FOUND'
  | 'EXECUTION_ORGANIZATION_MISMATCH'
  | 'EXECUTION_ALREADY_TERMINAL';
