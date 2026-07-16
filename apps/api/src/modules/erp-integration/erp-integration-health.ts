/**
 * Structure-only scaffold for future ERP integration health checks — this
 * sprint defines the shape, not the checks themselves. OFF mode will
 * eventually check replica-database availability + last sync; ON mode will
 * check live ERP connectivity, latency, and connection status.
 */
import { runWithTenantContext } from '../../infrastructure/data/tenant-context.js';
import type { ErpIntegrationRepositoryPort } from './erp-integration-repository.js';
import type { ErpIntegrationType } from './erp-integration-entity.js';
import { ErpIntegrationNotConfiguredError } from './erp-integration-resolution.service.js';

export type HealthCheckStatus = 'PENDING' | 'OK' | 'DEGRADED' | 'DOWN';

export interface HealthCheckItem {
  readonly name: string;
  readonly status: HealthCheckStatus;
  readonly detail: string;
}

export interface ErpIntegrationHealthReport {
  readonly organizationId: string;
  readonly tipo_integracao: ErpIntegrationType;
  readonly checkedAt: Date;
  readonly checks: readonly HealthCheckItem[];
}

const NOT_IMPLEMENTED = 'Not implemented in this sprint — structure only';

function pendingChecks(tipo: ErpIntegrationType): HealthCheckItem[] {
  if (tipo === 'OFF') {
    return [
      { name: 'replica_database_available', status: 'PENDING', detail: NOT_IMPLEMENTED },
      { name: 'last_synchronization', status: 'PENDING', detail: NOT_IMPLEMENTED },
    ];
  }
  return [
    { name: 'erp_connection_available', status: 'PENDING', detail: NOT_IMPLEMENTED },
    { name: 'latency', status: 'PENDING', detail: NOT_IMPLEMENTED },
    { name: 'connection_status', status: 'PENDING', detail: NOT_IMPLEMENTED },
  ];
}

export class ErpIntegrationHealthChecker {
  constructor(private readonly repository: ErpIntegrationRepositoryPort) {}

  /** Returns the health-check structure for one organization. Every item is PENDING in this sprint. */
  async check(organizationId: string): Promise<ErpIntegrationHealthReport> {
    return runWithTenantContext(organizationId, async () => {
      const integration = await this.repository.getForCurrentTenant();
      if (!integration) {
        throw new ErpIntegrationNotConfiguredError(organizationId);
      }

      return {
        organizationId,
        tipo_integracao: integration.integrationType,
        checkedAt: new Date(),
        checks: pendingChecks(integration.integrationType),
      };
    });
  }
}
