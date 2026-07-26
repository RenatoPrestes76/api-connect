// ─── Installation status ────────────────────────────────────────────────────

export type InstallationStatus =
  | 'PENDING'
  | 'DOWNLOADING'
  | 'INSTALLING'
  | 'RUNNING'
  | 'FAILED'
  | 'ROLLBACK';

// ─── Telemetry ──────────────────────────────────────────────────────────────

export interface ConnectorTelemetry {
  uptimeSeconds: number;
  lastSyncAt: string | null;
  failureCount: number;
  restartCount: number;
  resourceUsage: { cpuPercent: number; memoryMb: number } | null;
}

// ─── Connector installation ─────────────────────────────────────────────────

export interface ConnectorInstallationRecord {
  id: string;
  runtimeId: string;
  connectorId: string;
  installedVersion: string;
  /** Set when an update/rollback is in flight; null once RUNNING or FAILED with no prior version. */
  previousVersion: string | null;
  status: InstallationStatus;
  failureReason: string | null;
  installedAt: string;
  lastUpdate: string;
  telemetry: ConnectorTelemetry;
}

export interface ConnectorInstallationDTO {
  id: string;
  runtimeId: string;
  connectorId: string;
  connectorName: string;
  installedVersion: string;
  previousVersion: string | null;
  status: InstallationStatus;
  failureReason: string | null;
  installedAt: string;
  lastUpdate: string;
  telemetry: ConnectorTelemetry;
}

// ─── Assign / update results ────────────────────────────────────────────────

export type AssignConnectorError =
  | 'RUNTIME_NOT_FOUND'
  | 'CONNECTOR_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'INCOMPATIBLE_RUNTIME_VERSION'
  | 'INVALID_PACKAGE_SIGNATURE'
  | 'ALREADY_ASSIGNED';

export type UpdateConnectorError =
  | 'INSTALLATION_NOT_FOUND'
  | 'VERSION_NOT_FOUND'
  | 'INCOMPATIBLE_RUNTIME_VERSION'
  | 'INVALID_PACKAGE_SIGNATURE';

export type RollbackError = 'INSTALLATION_NOT_FOUND' | 'NO_PREVIOUS_VERSION';
