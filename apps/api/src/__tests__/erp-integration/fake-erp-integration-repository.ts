/**
 * In-memory fake for ErpIntegrationRepositoryPort — used by tests so the ERP
 * integration mode feature is fully testable without a live database. Reads
 * the ambient TenantContext exactly like the real Prisma-backed repository,
 * so tests genuinely exercise the tenant-isolation guarantee.
 */
import { getTenantContext } from '../../infrastructure/data/tenant-context.js';
import { ErpIntegrationEntity } from '../../modules/erp-integration/erp-integration-entity.js';
import type {
  ErpIntegrationInput,
  ErpIntegrationRepositoryPort,
} from '../../modules/erp-integration/erp-integration-repository.js';

export class FakeErpIntegrationRepository implements ErpIntegrationRepositoryPort {
  private readonly store = new Map<string, ErpIntegrationEntity>();

  async getForCurrentTenant(): Promise<ErpIntegrationEntity | null> {
    const { tenantId } = getTenantContext();
    return this.store.get(tenantId) ?? null;
  }

  async upsertForCurrentTenant(input: ErpIntegrationInput): Promise<ErpIntegrationEntity> {
    const { tenantId } = getTenantContext();
    const existing = this.store.get(tenantId);
    const now = new Date();
    const entity = new ErpIntegrationEntity(existing?.id ?? `fake-${tenantId}`, {
      organizationId: tenantId,
      integrationType: input.integrationType,
      status: input.status ?? existing?.status ?? 'ACTIVE',
      erpName: input.erpName ?? existing?.erpName ?? null,
      host: input.host ?? existing?.host ?? null,
      database: input.database ?? existing?.database ?? null,
      schema: input.schema ?? existing?.schema ?? null,
      lastConnectionAt: existing?.lastConnectionAt ?? null,
      lastSyncAt: existing?.lastSyncAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.store.set(tenantId, entity);
    return entity;
  }

  clear(): void {
    this.store.clear();
  }
}
