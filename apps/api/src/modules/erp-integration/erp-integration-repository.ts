/**
 * Prisma-backed repository for ErpIntegration, built on the Sprint 01.1 data
 * foundation. Scoped by `organizationId` (this table's natural tenant column,
 * not a literal `tenantId`) via BaseRepository's configurable tenantField.
 */
import type { ErpIntegration as ErpIntegrationRow, Prisma } from '@prisma/client';
import { BaseRepository } from '../../infrastructure/data/repositories/base-repository.js';
import type { PrismaModelDelegate } from '../../infrastructure/data/repositories/prisma-delegate.js';
import { buildWhere } from '../../infrastructure/data/query/query-builder.js';
import {
  ErpIntegrationEntity,
  type ErpIntegrationProps,
  type ErpIntegrationStatus,
  type ErpIntegrationType,
} from './erp-integration-entity.js';

type ErpIntegrationDelegate = Prisma.ErpIntegrationDelegate;

const TENANT_FIELD = 'organizationId';

/** Adapts the strongly-typed Prisma delegate to BaseRepository's generic port. */
function toGenericDelegate(
  delegate: ErpIntegrationDelegate
): PrismaModelDelegate<ErpIntegrationRow> {
  return {
    findFirst: (args) => delegate.findFirst(args as Prisma.ErpIntegrationFindFirstArgs),
    findMany: (args) => delegate.findMany(args as Prisma.ErpIntegrationFindManyArgs),
    create: (args) => delegate.create(args as Prisma.ErpIntegrationCreateArgs),
    update: (args) => delegate.update(args as Prisma.ErpIntegrationUpdateArgs),
    delete: (args) => delegate.delete(args as Prisma.ErpIntegrationDeleteArgs),
    count: (args) => delegate.count(args as Prisma.ErpIntegrationCountArgs),
  };
}

/** Fields a caller may set when registering or updating a company's ERP integration config. */
export interface ErpIntegrationInput {
  readonly integrationType: ErpIntegrationType;
  readonly status?: ErpIntegrationStatus;
  readonly erpName?: string | null;
  readonly host?: string | null;
  readonly database?: string | null;
  readonly schema?: string | null;
}

/** Narrow port the resolution service and health checker depend on — easy to fake in tests. */
export interface ErpIntegrationRepositoryPort {
  getForCurrentTenant(): Promise<ErpIntegrationEntity | null>;
  upsertForCurrentTenant(input: ErpIntegrationInput): Promise<ErpIntegrationEntity>;
}

export class ErpIntegrationRepository
  extends BaseRepository<ErpIntegrationEntity, ErpIntegrationRow>
  implements ErpIntegrationRepositoryPort
{
  constructor(delegate: ErpIntegrationDelegate) {
    super(toGenericDelegate(delegate), 'id', TENANT_FIELD);
  }

  /** Reads the (at most one) ErpIntegration row for the ambient TenantContext's organization. */
  async getForCurrentTenant(): Promise<ErpIntegrationEntity | null> {
    const row = await this.delegate.findFirst({ where: buildWhere(undefined, TENANT_FIELD) });
    return row ? this.toDomain(row) : null;
  }

  /** Creates or replaces the single ErpIntegration config for the ambient tenant's organization. */
  async upsertForCurrentTenant(input: ErpIntegrationInput): Promise<ErpIntegrationEntity> {
    const existing = await this.getForCurrentTenant();
    const entity = this.fromInput(existing?.id ?? '', input, existing);
    await this.save(entity);
    const saved = await this.getForCurrentTenant();
    if (!saved) {
      throw new Error('ErpIntegration upsert did not persist — this should be unreachable');
    }
    return saved;
  }

  protected toDomain(row: ErpIntegrationRow): ErpIntegrationEntity {
    const props: ErpIntegrationProps = {
      organizationId: row.organizationId,
      integrationType: row.integrationType,
      status: row.status,
      erpName: row.erpName,
      host: row.host,
      database: row.database,
      schema: row.schema,
      lastConnectionAt: row.lastConnectionAt,
      lastSyncAt: row.lastSyncAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return new ErpIntegrationEntity(row.id, props);
  }

  protected toPersistence(entity: ErpIntegrationEntity): Record<string, unknown> {
    return {
      integrationType: entity.integrationType,
      status: entity.status,
      erpName: entity.erpName,
      host: entity.host,
      database: entity.database,
      schema: entity.schema,
      lastConnectionAt: entity.lastConnectionAt,
      lastSyncAt: entity.lastSyncAt,
    };
  }

  private fromInput(
    id: string,
    input: ErpIntegrationInput,
    existing: ErpIntegrationEntity | null
  ): ErpIntegrationEntity {
    const now = new Date();
    return new ErpIntegrationEntity(id, {
      organizationId: existing?.organizationId ?? '',
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
  }
}
