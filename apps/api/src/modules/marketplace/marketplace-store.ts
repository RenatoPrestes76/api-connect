import { randomUUID } from 'node:crypto';
import { CONNECTOR_CATALOG, getConnector } from '@seltriva/connector-registry';
import type {
  ConnectorInstallation,
  MarketplaceAuditLog,
  MarketplaceAction,
} from '@seltriva/connector-registry';

// ─── Store ────────────────────────────────────────────────────────────────────

class MarketplaceStore {
  installations: Map<string, ConnectorInstallation> = new Map();
  auditLogs: MarketplaceAuditLog[] = [];

  constructor() {
    this._seed();
  }

  private _seed(): void {
    const now = new Date();

    // seltriva-erp — installed (latest)
    const erpConn = getConnector('seltriva-erp')!;
    const erpInst: ConnectorInstallation = {
      id: randomUUID(),
      connectorId: 'seltriva-erp',
      connectorName: erpConn.manifest.name,
      version: erpConn.manifest.version,
      installedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      enabled: true,
      sandboxId: `sb-seltriva-erp-${randomUUID().slice(0, 8)}`,
      resourceUsage: { cpuCores: 0.25, memoryMb: 128 },
      permissions: [...erpConn.manifest.permissions],
    };
    this.installations.set(erpInst.id, erpInst);

    // postgresql — installed (latest)
    const pgConn = getConnector('postgresql')!;
    const pgInst: ConnectorInstallation = {
      id: randomUUID(),
      connectorId: 'postgresql',
      connectorName: pgConn.manifest.name,
      version: pgConn.manifest.version,
      installedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      enabled: true,
      sandboxId: `sb-postgresql-${randomUUID().slice(0, 8)}`,
      resourceUsage: { cpuCores: 0.5, memoryMb: 256 },
      permissions: [...pgConn.manifest.permissions],
    };
    this.installations.set(pgInst.id, pgInst);

    // mercado-livre — installed on OLD version → update-available
    const mlConn = getConnector('mercado-livre')!;
    // versions array is newest-first; find an old version string (different from manifest.version)
    const mlOldVersion =
      mlConn.versions.find((v) => v.version !== mlConn.manifest.version)?.version ?? '0.0.1';
    const mlInst: ConnectorInstallation = {
      id: randomUUID(),
      connectorId: 'mercado-livre',
      connectorName: mlConn.manifest.name,
      version: mlOldVersion,
      installedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      enabled: true,
      sandboxId: `sb-mercado-livre-${randomUUID().slice(0, 8)}`,
      resourceUsage: { cpuCores: 0.25, memoryMb: 128 },
      permissions: [...mlConn.manifest.permissions],
    };
    this.installations.set(mlInst.id, mlInst);

    // Seed 10 audit log entries
    const seedLogs: Array<{
      action: MarketplaceAction;
      connectorId: string;
      version?: string;
      daysAgo: number;
    }> = [
      { action: 'install', connectorId: 'seltriva-erp', version: '1.0.0', daysAgo: 30 },
      { action: 'install', connectorId: 'postgresql', version: '1.0.0', daysAgo: 20 },
      { action: 'install', connectorId: 'mercado-livre', version: mlOldVersion, daysAgo: 60 },
      {
        action: 'update',
        connectorId: 'seltriva-erp',
        version: erpConn.manifest.version,
        daysAgo: 5,
      },
      { action: 'disable', connectorId: 'seltriva-erp', daysAgo: 10 },
      { action: 'enable', connectorId: 'seltriva-erp', daysAgo: 9 },
      { action: 'install', connectorId: 'shopify', version: '2.1.0', daysAgo: 45 },
      { action: 'uninstall', connectorId: 'shopify', version: '2.1.0', daysAgo: 15 },
      { action: 'install', connectorId: 'rabbitmq', version: '1.5.0', daysAgo: 25 },
      { action: 'uninstall', connectorId: 'rabbitmq', version: '1.5.0', daysAgo: 3 },
    ];

    for (const entry of seedLogs) {
      const conn = getConnector(entry.connectorId);
      this.auditLogs.push({
        id: randomUUID(),
        action: entry.action,
        connectorId: entry.connectorId,
        connectorName: conn?.manifest.name ?? entry.connectorId,
        version: entry.version,
        actor: 'system',
        createdAt: new Date(now.getTime() - entry.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    this.auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  listInstallations(): ConnectorInstallation[] {
    return [...this.installations.values()];
  }

  getInstallationByConnectorId(connectorId: string): ConnectorInstallation | undefined {
    return [...this.installations.values()].find((i) => i.connectorId === connectorId);
  }

  getInstallationById(id: string): ConnectorInstallation | undefined {
    return this.installations.get(id);
  }

  listUpdatesAvailable(): Array<{ installation: ConnectorInstallation; latestVersion: string }> {
    const results: Array<{ installation: ConnectorInstallation; latestVersion: string }> = [];
    for (const inst of this.installations.values()) {
      const conn = getConnector(inst.connectorId);
      if (!conn) continue;
      const latest = conn.manifest.version;
      if (inst.version !== latest) {
        results.push({ installation: inst, latestVersion: latest });
      }
    }
    return results;
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  install(connectorId: string, version: string, actor: string): ConnectorInstallation {
    const conn = getConnector(connectorId)!;
    const now = new Date().toISOString();
    const inst: ConnectorInstallation = {
      id: randomUUID(),
      connectorId,
      connectorName: conn.manifest.name,
      version,
      installedAt: now,
      updatedAt: now,
      enabled: true,
      sandboxId: `sb-${connectorId}-${randomUUID().slice(0, 8)}`,
      resourceUsage: {
        cpuCores: conn.manifest.resourceLimits.cpuCores * 0.5,
        memoryMb: conn.manifest.resourceLimits.memoryMb * 0.5,
      },
      permissions: [...conn.manifest.permissions],
    };
    this.installations.set(inst.id, inst);
    this._log('install', connectorId, conn.manifest.name, version, actor);
    return inst;
  }

  uninstall(id: string, actor: string): ConnectorInstallation {
    const inst = this.installations.get(id)!;
    this.installations.delete(id);
    this._log('uninstall', inst.connectorId, inst.connectorName, inst.version, actor);
    return inst;
  }

  update(id: string, toVersion: string, actor: string): ConnectorInstallation {
    const inst = this.installations.get(id)!;
    const conn = getConnector(inst.connectorId)!;
    const updated: ConnectorInstallation = {
      ...inst,
      version: toVersion,
      updatedAt: new Date().toISOString(),
      resourceUsage: {
        cpuCores: conn.manifest.resourceLimits.cpuCores * 0.5,
        memoryMb: conn.manifest.resourceLimits.memoryMb * 0.5,
      },
    };
    this.installations.set(id, updated);
    this._log('update', inst.connectorId, inst.connectorName, toVersion, actor);
    return updated;
  }

  setEnabled(id: string, enabled: boolean, actor: string): ConnectorInstallation {
    const inst = this.installations.get(id)!;
    const updated: ConnectorInstallation = {
      ...inst,
      enabled,
      updatedAt: new Date().toISOString(),
    };
    this.installations.set(id, updated);
    this._log(
      enabled ? 'enable' : 'disable',
      inst.connectorId,
      inst.connectorName,
      inst.version,
      actor
    );
    return updated;
  }

  recordPublish(connectorId: string, connectorName: string, version: string, actor: string): void {
    this._log('publish', connectorId, connectorName, version, actor);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _log(
    action: MarketplaceAction,
    connectorId: string,
    connectorName: string,
    version: string | undefined,
    actor: string
  ): void {
    this.auditLogs.unshift({
      id: randomUUID(),
      action,
      connectorId,
      connectorName,
      version,
      actor,
      createdAt: new Date().toISOString(),
    });
  }
}

export const marketplaceStore = new MarketplaceStore();
export { CONNECTOR_CATALOG };
