// ─── Priority / status ──────────────────────────────────────────────────────

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type JobStatus =
  | 'QUEUED'
  | 'DISPATCHED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED'
  | 'EXPIRED';

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
];

// ─── Commands ───────────────────────────────────────────────────────────────
// Known commands are listed for discoverability/validation defaults, but the
// type stays open (string & {}) so new commands never require touching this
// file — "adicionar novos comandos sem modificar os já existentes".

export type KnownJobCommand =
  | 'APPLY_MARKDOWN'
  | 'REVERT_MARKDOWN'
  | 'SYNC_PRODUCTS'
  | 'SYNC_STOCK'
  | 'SYNC_PRICES'
  | 'PING'
  | 'CUSTOM';

// eslint-disable-next-line @typescript-eslint/ban-types
export type JobCommand = KnownJobCommand | (string & {});

// ─── Origin (who/what created the job) ─────────────────────────────────────

export type JobOrigin = 'SELTRIVA' | 'ADMIN' | 'SYSTEM';

// ─── Attempt history ────────────────────────────────────────────────────────

export interface JobAttemptRecord {
  attempt: number;
  startedAt: string;
  finishedAt: string;
  outcome: 'success' | 'failure' | 'timeout';
  error: string | null;
}

// ─── Job ────────────────────────────────────────────────────────────────────

export interface JobRecord {
  id: string;
  organizationId: string;
  runtimeId: string;
  connectorId: string | null;
  command: JobCommand;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  /** Milliseconds a dispatched/running attempt may take before it's treated as a timeout. */
  timeoutMs: number;
  /** Optional client-supplied key — a second POST /jobs with the same key+organizationId returns the original job instead of creating a duplicate. */
  idempotencyKey: string | null;
  createdBy: string;
  origin: JobOrigin;
  result: Record<string, unknown> | null;
  lastError: string | null;
  history: JobAttemptRecord[];
  createdAt: string;
  /** When this job (or its next retry) becomes eligible to be claimed. */
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Signature of the most recently accepted result report — rejects verbatim replay within the timestamp tolerance window. Not exposed via any DTO. */
  lastResultSignature: string | null;
}

export interface JobDTO {
  id: string;
  organizationId: string;
  runtimeId: string;
  connectorId: string | null;
  command: JobCommand;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdBy: string;
  origin: JobOrigin;
  result: Record<string, unknown> | null;
  lastError: string | null;
  history: JobAttemptRecord[];
  createdAt: string;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

// ─── Create input / errors ─────────────────────────────────────────────────

export interface CreateJobInput {
  organizationId: string;
  runtimeId: string;
  connectorId?: string;
  command: JobCommand;
  payload?: Record<string, unknown>;
  priority?: JobPriority;
  createdBy: string;
  origin: JobOrigin;
  idempotencyKey?: string;
  maxAttempts?: number;
  timeoutMs?: number;
}

export type CreateJobError = 'RUNTIME_NOT_FOUND' | 'RUNTIME_ORGANIZATION_MISMATCH';

export type CancelJobError = 'JOB_NOT_FOUND' | 'JOB_ALREADY_TERMINAL';

export type ReportResultError =
  | 'JOB_NOT_FOUND'
  | 'RUNTIME_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'REPLAY_REJECTED';

export type ClaimJobsError =
  | 'RUNTIME_NOT_FOUND'
  | 'RUNTIME_NOT_ACTIVE'
  | 'INVALID_SIGNATURE'
  | 'REPLAY_REJECTED';
