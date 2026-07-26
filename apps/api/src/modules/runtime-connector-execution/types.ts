// ─── Lifecycle ───────────────────────────────────────────────────────────────
// PLANNED (built, pre-validation) -> QUEUED (validated, awaiting claim) ->
// CLAIMED (Runtime picked it up) -> EXECUTING -> one terminal Atlas Standard
// Response status. REJECTED short-circuits PLANNED when validation fails —
// it is never dispatched to a Runtime at all.

export type ExecutionLifecycleStatus =
  | 'PLANNED'
  | 'REJECTED'
  | 'QUEUED'
  | 'CLAIMED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'EMPTY'
  | 'TIMEOUT'
  | 'UNAUTHORIZED';

export const TERMINAL_EXECUTION_STATUSES: readonly ExecutionLifecycleStatus[] = [
  'REJECTED',
  'SUCCESS',
  'FAILED',
  'PARTIAL',
  'EMPTY',
  'TIMEOUT',
  'UNAUTHORIZED',
];

/** The six outcomes every ERP-specific result must be normalized into — "Atlas Standard Response". */
export type AtlasStandardResponseStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'EMPTY'
  | 'TIMEOUT'
  | 'UNAUTHORIZED';

// ─── Connector actions ───────────────────────────────────────────────────────
// Known actions are listed for discoverability/payload-validation defaults,
// but the type stays open (string & {}) so new actions never require
// touching this file — mirrors job-orchestration's KnownJobCommand pattern.

export type KnownConnectorAction =
  | 'READ_PRODUCTS'
  | 'SYNC_STOCK'
  | 'SYNC_PRICES'
  | 'PRICE_MARKDOWN'
  | 'CUSTOM';

// eslint-disable-next-line @typescript-eslint/ban-types
export type ConnectorAction = KnownConnectorAction | (string & {});

/**
 * Sprint 46.10's first real use case: a price reduction to push into the
 * ERP. previousPrice is required (not just the new one) so a completed
 * markdown can always be rolled back automatically later — Seltriva already
 * knows both prices at request time, so no round trip to the ERP is needed
 * to recover it.
 */
export interface PriceMarkdownPayload {
  productId: string;
  newPrice: number;
  previousPrice: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ExecutionValidationChecks {
  runtimeAuthorized: boolean;
  connectorActive: boolean;
  profileValid: boolean;
  driverCompatible: boolean;
  minVersionOk: boolean;
  payloadValid: boolean;
  /** ERP Execution Policy — the payload touches only fields this action is allowed to change (e.g. PRICE_MARKDOWN may change newPrice, never cost/stock). */
  policyCompliant: boolean;
}

export interface ExecutionValidationResult {
  ok: boolean;
  checks: ExecutionValidationChecks;
  failureReason: string | null;
}

// ─── Execution plan ──────────────────────────────────────────────────────────

export interface ExecutionMetrics {
  executionTimeMs: number | null;
  latencyMs: number | null;
  retries: number;
  timeoutCount: number;
  failureCount: number;
  successRate: number;
}

/** packages/titan's CircuitBreaker state, keyed per connectorId+profileId — gates whether new attempts are even claimable. */
export type ExecutionCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ExecutionPlanRecord {
  id: string;
  runtimeId: string;
  organizationId: string;
  connectorId: string;
  profileId: string;
  /** The Connector Action requested — e.g. "READ_PRODUCTS" or "PRICE_MARKDOWN". */
  action: ConnectorAction;
  createdBy: string;
  payload: Record<string, unknown>;
  dbType: string;
  driverVersion: string;
  timeoutMs: number;
  maxAttempts: number;
  attempts: number;
  status: ExecutionLifecycleStatus;
  validation: ExecutionValidationChecks;
  metrics: ExecutionMetrics;
  circuitState: ExecutionCircuitState;
  resultData: Record<string, unknown> | null;
  resultError: string | null;
  /** The ERP's own confirmation/transaction identifier for this execution, when it produced one. */
  erpReference: string | null;
  /** De-dupes creation the same way job-orchestration's CreateJobInput does — a repeated request with the same key+organizationId returns the original plan instead of creating a duplicate. */
  idempotencyKey: string | null;
  /** Set when this plan is itself a rollback of an earlier execution. */
  rollbackOfExecutionId: string | null;
  /** Set on the original execution once a rollback has been created for it — prevents rolling back the same execution twice. */
  rolledBackByExecutionId: string | null;
  createdAt: string;
  scheduledAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

export interface ExecutionPlanDTO {
  id: string;
  runtimeId: string;
  organizationId: string;
  connectorId: string;
  profileId: string;
  action: ConnectorAction;
  createdBy: string;
  payload: Record<string, unknown>;
  dbType: string;
  driverVersion: string;
  timeoutMs: number;
  maxAttempts: number;
  attempts: number;
  status: ExecutionLifecycleStatus;
  validation: ExecutionValidationChecks;
  metrics: ExecutionMetrics;
  circuitState: ExecutionCircuitState;
  resultData: Record<string, unknown> | null;
  resultError: string | null;
  erpReference: string | null;
  idempotencyKey: string | null;
  rollbackOfExecutionId: string | null;
  rolledBackByExecutionId: string | null;
  createdAt: string;
  scheduledAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
}

// ─── Create input / errors ──────────────────────────────────────────────────

export interface CreateExecutionInput {
  runtimeId: string;
  organizationId: string;
  connectorId: string;
  profileId: string;
  action: ConnectorAction;
  createdBy: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
  /** Internal — set only when this plan is created by rollbackExecution(), never accepted from a caller directly. */
  rollbackOfExecutionId?: string;
}

export type CreateExecutionError =
  | 'RUNTIME_NOT_FOUND'
  | 'RUNTIME_ORGANIZATION_MISMATCH'
  | 'CONNECTOR_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_RUNTIME_MISMATCH';

// ─── Rollback ────────────────────────────────────────────────────────────────

export type RollbackExecutionError =
  | 'EXECUTION_NOT_FOUND'
  | 'ACTION_NOT_REVERSIBLE'
  | 'EXECUTION_NOT_TERMINAL_SUCCESS'
  | 'ALREADY_ROLLED_BACK';

// ─── Result reporting ────────────────────────────────────────────────────────
// The Runtime reports raw facts observed while executing against the ERP;
// the Result Normalizer (not the Runtime) classifies them into the Atlas
// Standard Response taxonomy — the Runtime never needs to know Atlas's
// classification rules, only what actually happened.

export interface ReportExecutionResultInput {
  executionId: string;
  runtimeId: string;
  success: boolean;
  rowCount?: number;
  partial?: boolean;
  timedOut?: boolean;
  unauthorized?: boolean;
  executionTimeMs?: number;
  latencyMs?: number;
  data?: Record<string, unknown>;
  /** The ERP's own confirmation/transaction identifier for this execution (e.g. PRICE_MARKDOWN's ERP transaction id). */
  erpReference?: string;
  error?: string;
}

export type ReportResultError = 'EXECUTION_NOT_FOUND' | 'RUNTIME_MISMATCH';
