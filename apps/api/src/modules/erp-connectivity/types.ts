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
// itself (no DB driver dependencies exist in this package, by design), and
// (Sprint A2.6) it never holds the ERP credential in any form either — not
// encrypted, not in memory, not even transiently. The password lives
// exactly once, encrypted at rest on the customer's own machine (see
// apps/runtime-installer/src/erp-connection/erp-connection-store.ts and
// docs/ATLAS-RUNTIME-CLIENT.md's "ERP credentials never leave the client
// machine"). This profile is connection-shape metadata only — useful for
// the admin panel to show what a Runtime talks to — plus the health/
// diagnostics history the Runtime reports back, never a credential fetch.

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
  additionalParams: Record<string, string>;
  status: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
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
  additionalParams?: Record<string, string>;
}

export interface UpdateConnectionProfileInput {
  name?: string;
  erpName?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
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
