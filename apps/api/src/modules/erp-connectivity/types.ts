// ─── Database driver types ──────────────────────────────────────────────────
// Keyed registry (drivers.ts) so a new database can be added without
// modifying any existing driver — "permitir adicionar novos drivers sem
// alterar os existentes".

export type DbType = 'POSTGRESQL' | 'SQLSERVER' | 'MYSQL' | 'MARIADB' | 'ORACLE' | 'FIREBIRD';

// ─── Connection status ──────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'PENDING_VALIDATION'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'CIRCUIT_OPEN'
  | 'DOWN'
  | 'DISABLED';

// ─── Connection profile ─────────────────────────────────────────────────────
// apps/api is the control plane — it never dials the customer's ERP database
// itself (no DB driver dependencies exist in this package, by design). The
// Atlas Runtime installed at the customer site is the only thing with
// network access to the ERP, so it fetches its profiles (incl. decrypted
// credential, over its own JWT session) and reports health/diagnostics back.

export interface ConnectionProfileRecord {
  id: string;
  runtimeId: string;
  organizationId: string;
  name: string;
  erpName: string | null;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  /** Envelope-encrypted (AES-256-GCM) — decrypted only in memory, only for the runtime-profiles fetch. Never serialized to a DTO. */
  encryptedCredential: string;
  additionalParams: Record<string, string>;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionProfileDTO {
  id: string;
  runtimeId: string;
  organizationId: string;
  name: string;
  erpName: string | null;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  hasCredential: boolean;
  additionalParams: Record<string, string>;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/** Only surfaced to the owning Runtime, over its authenticated JWT session — the one place plaintext crosses the wire. */
export interface ConnectionProfileWithCredentialDTO extends ConnectionProfileDTO {
  password: string;
}

export interface CreateConnectionProfileInput {
  runtimeId: string;
  organizationId: string;
  name: string;
  erpName?: string;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  additionalParams?: Record<string, string>;
}

export interface UpdateConnectionProfileInput {
  name?: string;
  erpName?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  /** Presence rotates the stored credential. */
  password?: string;
  additionalParams?: Record<string, string>;
}

export type CreateProfileError = 'RUNTIME_NOT_FOUND' | 'RUNTIME_ORGANIZATION_MISMATCH';
export type ProfileNotFoundError = 'PROFILE_NOT_FOUND';

// ─── Health monitoring ───────────────────────────────────────────────────────

export interface HealthCheckEvent {
  at: string;
  success: boolean;
  responseTimeMs: number | null;
  error: string | null;
}

export interface ConnectionHealthRecord {
  profileId: string;
  responseTimeMs: number | null;
  activeConnections: number;
  consecutiveFailures: number;
  /** Rolling success rate over `history`, as a 0-100 percentage. */
  availabilityPercent: number;
  avgQueryTimeMs: number | null;
  lastCheckAt: string | null;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  /** When the circuit (or a plain failure streak) next allows a retry — informational; the Runtime owns its own retry loop. */
  nextRetryAt: string | null;
  history: HealthCheckEvent[];
}

export interface ReportHealthInput {
  profileId: string;
  runtimeId: string;
  success: boolean;
  responseTimeMs?: number;
  activeConnections?: number;
  avgQueryTimeMs?: number;
  error?: string;
  timestamp: string;
  signature: string;
}

export type ReportHealthError =
  | 'PROFILE_NOT_FOUND'
  | 'RUNTIME_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'REPLAY_REJECTED';

export interface ReportHealthOutcome {
  health: ConnectionHealthRecord;
  reconnected: boolean;
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export type DiagnosticCheckResult = 'OK' | 'FAIL';

export interface DiagnosticsReportRecord {
  id: string;
  profileId: string;
  runtimeId: string;
  dns: DiagnosticCheckResult;
  tcp: DiagnosticCheckResult;
  authentication: DiagnosticCheckResult;
  database: DiagnosticCheckResult;
  latencyMs: number | null;
  permissions: DiagnosticCheckResult;
  driver: string;
  encryption: string;
  overallOk: boolean;
  createdAt: string;
}

export interface ReportDiagnosticsInput {
  profileId: string;
  runtimeId: string;
  dns: DiagnosticCheckResult;
  tcp: DiagnosticCheckResult;
  authentication: DiagnosticCheckResult;
  database: DiagnosticCheckResult;
  latencyMs?: number;
  permissions: DiagnosticCheckResult;
  driver: string;
  encryption: string;
  timestamp: string;
  signature: string;
}

export type ReportDiagnosticsError = ReportHealthError;
