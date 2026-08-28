import { randomUUID } from 'node:crypto';
import { connectorsStore } from '../connectors/connectors-store.js';
import { verifyPackageSignature } from '../connectors/package-integrity.js';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { isVersionAtLeast } from './version-compat.js';
import type {
  ConnectorInstallationRecord,
  ConnectorInstallationDTO,
  InstallationStatus,
  AssignConnectorError,
  UpdateConnectorError,
  RollbackError,
} from './types.js';
import type { ConnectorVersionRecord } from '../connectors/types.js';

export type AssignConnectorResult =
  | { ok: true; installation: ConnectorInstallationRecord }
  | { ok: false; error: AssignConnectorError };

export type UpdateConnectorResult =
  | { ok: true; installation: ConnectorInstallationRecord }
  | { ok: false; error: UpdateConnectorError };

export type RollbackResult =
  | { ok: true; installation: ConnectorInstallationRecord }
  | { ok: false; error: RollbackError };

let _instance: ConnectorInstallationStore | null = null;

export class ConnectorInstallationStore {
  private installations: ConnectorInstallationRecord[] = [];

  static getInstance(): ConnectorInstallationStore {
    if (!_instance) _instance = new ConnectorInstallationStore();
    return _instance;
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  getInstallation(id: string): ConnectorInstallationRecord | undefined {
    return this.installations.find((i) => i.id === id);
  }

  listByRuntime(runtimeId: string): ConnectorInstallationRecord[] {
    return this.installations.filter((i) => i.runtimeId === runtimeId);
  }

  findActive(runtimeId: string, connectorId: string): ConnectorInstallationRecord | undefined {
    return this.installations.find(
      (i) => i.runtimeId === runtimeId && i.connectorId === connectorId
    );
  }

  toDTO(installation: ConnectorInstallationRecord): ConnectorInstallationDTO {
    const connector = connectorsStore.getConnector(installation.connectorId);
    return {
      id: installation.id,
      runtimeId: installation.runtimeId,
      connectorId: installation.connectorId,
      connectorName: connector?.name ?? 'unknown',
      installedVersion: installation.installedVersion,
      previousVersion: installation.previousVersion,
      status: installation.status,
      failureReason: installation.failureReason,
      installedAt: installation.installedAt,
      lastUpdate: installation.lastUpdate,
      telemetry: installation.telemetry,
    };
  }

  // ─── Compatibility / signature helpers ──────────────────────────────────

  private resolveVersion(
    connectorId: string,
    version?: string
  ): ConnectorVersionRecord | undefined {
    const versions = connectorsStore.listVersions(connectorId);
    if (version) return versions.find((v) => v.version === version);
    return versions.find((v) => v.status === 'stable');
  }

  private checkCompatibilityAndSignature(
    runtimeVersion: string,
    versionRecord: ConnectorVersionRecord
  ): 'INCOMPATIBLE_RUNTIME_VERSION' | 'INVALID_PACKAGE_SIGNATURE' | null {
    if (!isVersionAtLeast(runtimeVersion, versionRecord.minRuntimeVersion)) {
      return 'INCOMPATIBLE_RUNTIME_VERSION';
    }
    const verified = verifyPackageSignature(versionRecord.packageSignature);
    if (
      !verified ||
      verified.connectorId !== versionRecord.connectorId ||
      verified.version !== versionRecord.version ||
      verified.checksum !== versionRecord.checksum
    ) {
      return 'INVALID_PACKAGE_SIGNATURE';
    }
    return null;
  }

  // ─── Assign ──────────────────────────────────────────────────────────────

  async assignConnector(
    runtimeId: string,
    connectorId: string,
    version?: string
  ): Promise<AssignConnectorResult> {
    const runtime = await runtimeRegistrationStore.getRuntime(runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };

    const connector = connectorsStore.getConnector(connectorId);
    if (!connector) return { ok: false, error: 'CONNECTOR_NOT_FOUND' };

    const versionRecord = this.resolveVersion(connectorId, version);
    if (!versionRecord) return { ok: false, error: 'VERSION_NOT_FOUND' };

    if (this.findActive(runtimeId, connectorId)) {
      return { ok: false, error: 'ALREADY_ASSIGNED' };
    }

    const incompatibility = this.checkCompatibilityAndSignature(runtime.version, versionRecord);
    if (incompatibility) return { ok: false, error: incompatibility };

    const now = new Date().toISOString();
    const installation: ConnectorInstallationRecord = {
      id: randomUUID(),
      runtimeId,
      connectorId,
      installedVersion: versionRecord.version,
      previousVersion: null,
      status: 'PENDING',
      failureReason: null,
      installedAt: now,
      lastUpdate: now,
      telemetry: {
        uptimeSeconds: 0,
        lastSyncAt: null,
        failureCount: 0,
        restartCount: 0,
        resourceUsage: null,
      },
    };
    this.installations.push(installation);
    return { ok: true, installation };
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async requestUpdate(
    installationId: string,
    targetVersion: string
  ): Promise<UpdateConnectorResult> {
    const installation = this.getInstallation(installationId);
    if (!installation) return { ok: false, error: 'INSTALLATION_NOT_FOUND' };

    const versionRecord = this.resolveVersion(installation.connectorId, targetVersion);
    if (!versionRecord) return { ok: false, error: 'VERSION_NOT_FOUND' };

    const runtime = await runtimeRegistrationStore.getRuntime(installation.runtimeId);
    const runtimeVersion = runtime?.version ?? '0.0.0';
    const incompatibility = this.checkCompatibilityAndSignature(runtimeVersion, versionRecord);
    if (incompatibility) return { ok: false, error: incompatibility };

    installation.previousVersion = installation.installedVersion;
    installation.installedVersion = versionRecord.version;
    installation.status = 'PENDING';
    installation.failureReason = null;
    installation.lastUpdate = new Date().toISOString();
    return { ok: true, installation };
  }

  // ─── Runtime-reported progress (simulates the install/update lifecycle) ──

  setStatus(
    installationId: string,
    status: InstallationStatus
  ): ConnectorInstallationRecord | null {
    const installation = this.getInstallation(installationId);
    if (!installation) return null;
    installation.status = status;
    installation.lastUpdate = new Date().toISOString();
    return installation;
  }

  /**
   * The Runtime calls this once it's finished attempting an install/update.
   * On failure, this IS the "Rollback automático" flow: stop, restore the
   * previous version, record the event — no separate manual step needed.
   */
  reportOutcome(
    installationId: string,
    outcome: 'success' | 'failure',
    reason?: string
  ): ConnectorInstallationRecord | null {
    const installation = this.getInstallation(installationId);
    if (!installation) return null;
    const now = new Date().toISOString();

    if (outcome === 'success') {
      installation.status = 'RUNNING';
      installation.previousVersion = null;
      installation.failureReason = null;
      installation.telemetry.lastSyncAt = now;
    } else {
      installation.telemetry.failureCount += 1;
      if (installation.previousVersion) {
        installation.status = 'ROLLBACK';
        installation.installedVersion = installation.previousVersion;
        installation.previousVersion = null;
        installation.failureReason = reason ?? 'Update failed — rolled back automatically';
      } else {
        installation.status = 'FAILED';
        installation.failureReason = reason ?? 'Installation failed';
      }
    }
    installation.lastUpdate = now;
    return installation;
  }

  // ─── Manual rollback (staff-triggered, via POST /runtime/:id/rollback) ──

  rollback(installationId: string): RollbackResult {
    const installation = this.getInstallation(installationId);
    if (!installation) return { ok: false, error: 'INSTALLATION_NOT_FOUND' };
    if (!installation.previousVersion) return { ok: false, error: 'NO_PREVIOUS_VERSION' };

    installation.installedVersion = installation.previousVersion;
    installation.previousVersion = null;
    installation.status = 'ROLLBACK';
    installation.failureReason = null;
    installation.lastUpdate = new Date().toISOString();
    return { ok: true, installation };
  }

  // ─── Telemetry ───────────────────────────────────────────────────────────

  recordTelemetry(
    installationId: string,
    telemetry: Partial<ConnectorInstallationRecord['telemetry']>
  ): ConnectorInstallationRecord | null {
    const installation = this.getInstallation(installationId);
    if (!installation) return null;
    Object.assign(installation.telemetry, telemetry);
    installation.lastUpdate = new Date().toISOString();
    return installation;
  }
}

export const connectorInstallationStore = ConnectorInstallationStore.getInstance();
