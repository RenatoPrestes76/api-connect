import type { TenantHealth, HealthCheck } from './types.js';
import { operationsStore, computeOverallStatus } from './operations-store.js';

export class HealthEngine {
  getAllTenantHealth(): TenantHealth[] {
    return operationsStore.getTenants().map((t) => this.buildTenantHealth(t.tenantId));
  }

  getTenantHealth(tenantId: string): TenantHealth | null {
    const tenant = operationsStore.getTenant(tenantId);
    if (!tenant) return null;
    return this.buildTenantHealth(tenantId);
  }

  runHealthCheck(tenantId?: string): HealthCheck[] {
    const checks = tenantId
      ? operationsStore.getHealthChecks(tenantId)
      : operationsStore.getAllHealthChecks();
    const now = new Date().toISOString();
    const updated = checks.map((c) => ({ ...c, checkedAt: now }));
    updated.forEach((c) => operationsStore.updateHealthCheck(c));
    return updated;
  }

  private buildTenantHealth(tenantId: string): TenantHealth {
    const tenant = operationsStore.getTenant(tenantId)!;
    const checks = operationsStore.getHealthChecks(tenantId);
    const overallStatus = computeOverallStatus(checks);
    const openAlerts = operationsStore.getAlerts(tenantId, { resolved: false });
    const slaRecord = operationsStore.getSlaHistory(tenantId, 'today')[0];

    return {
      tenantId,
      tenantName: tenant.name,
      plan: tenant.plan,
      overallStatus,
      checks,
      alertCount: openAlerts.length,
      activeAlerts: openAlerts.filter((a) => a.severity === 'critical' || a.severity === 'error')
        .length,
      sla: slaRecord?.availability ?? 100,
    };
  }
}

export const healthEngine = new HealthEngine();
