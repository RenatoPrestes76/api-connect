/**
 * Answers "which ERP integration mode does this company use?" — the single
 * source of truth other Atlas modules will consult before ever touching an
 * ERP connector. No pricing, ERP write path, or sync automation lives here.
 */
import { runWithTenantContext } from '../../infrastructure/data/tenant-context.js';
import type { ErpIntegrationRepositoryPort } from './erp-integration-repository.js';
import type { ErpIntegrationType } from './erp-integration-entity.js';

export interface ErpIntegrationResolution {
  readonly organizationId: string;
  readonly tipo_integracao: ErpIntegrationType;
  readonly permite_leitura: boolean;
  readonly permite_escrita: boolean;
}

export class ErpIntegrationNotConfiguredError extends Error {
  readonly code = 'ERP_INTEGRATION_NOT_CONFIGURED';

  constructor(organizationId: string) {
    super(`No ERP integration is configured for organization "${organizationId}"`);
    this.name = 'ErpIntegrationNotConfiguredError';
  }
}

export class ErpIntegrationResolutionService {
  constructor(private readonly repository: ErpIntegrationRepositoryPort) {}

  /** Resolves the integration mode for exactly one organization — never mixes configs across tenants. */
  async resolve(organizationId: string): Promise<ErpIntegrationResolution> {
    return runWithTenantContext(organizationId, async () => {
      const integration = await this.repository.getForCurrentTenant();
      if (!integration) {
        throw new ErpIntegrationNotConfiguredError(organizationId);
      }

      return {
        organizationId,
        tipo_integracao: integration.integrationType,
        permite_leitura: integration.status === 'ACTIVE',
        // Hard rule for this sprint: no ERP write path exists yet, for any mode or status.
        permite_escrita: false,
      };
    });
  }
}
