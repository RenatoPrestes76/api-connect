/**
 * Generic, tenant-scoped Prisma repository. Concrete repositories (built in
 * later migration sprints) extend this and supply their own model delegate
 * plus the TEntity <-> row mapping — no domain-specific logic lives here.
 */
import type { Entity, Repository, RepositoryCriteria } from '@seltriva/core';
import type { PrismaModelDelegate } from './prisma-delegate.js';
import { getTenantContext } from '../tenant-context.js';
import { buildFindManyArgs, buildWhere } from '../query/query-builder.js';

// @seltriva/core's Repository<TEntity, TId = string> constrains TEntity to
// `extends Entity` — i.e. Entity<string> — regardless of TId, so TId is fixed
// to string here to satisfy that constraint exactly as declared upstream.
export abstract class BaseRepository<TEntity extends Entity<string>, TRow> implements Repository<
  TEntity,
  string
> {
  protected constructor(
    protected readonly delegate: PrismaModelDelegate<TRow>,
    protected readonly idField: string = 'id',
    protected readonly tenantField: string = 'tenantId'
  ) {}

  /** Maps a raw Prisma row to the domain entity. */
  protected abstract toDomain(row: TRow): TEntity;

  /** Maps a domain entity to the persistence shape Prisma expects for create/update. */
  protected abstract toPersistence(entity: TEntity): Record<string, unknown>;

  async findById(id: string): Promise<TEntity | null> {
    const row = await this.delegate.findFirst({
      where: buildWhere({ [this.idField]: id }, this.tenantField),
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(criteria?: RepositoryCriteria): Promise<TEntity[]> {
    const rows = await this.delegate.findMany(buildFindManyArgs(criteria, this.tenantField));
    return rows.map((row) => this.toDomain(row));
  }

  async save(entity: TEntity): Promise<void> {
    const { tenantId } = getTenantContext();
    const data = { ...this.toPersistence(entity), [this.tenantField]: tenantId };

    if (await this.exists(entity.id)) {
      await this.delegate.update({
        where: buildWhere({ [this.idField]: entity.id }, this.tenantField),
        data,
      });
    } else {
      await this.delegate.create({ data });
    }
  }

  async delete(id: string): Promise<void> {
    await this.delegate.delete({ where: buildWhere({ [this.idField]: id }, this.tenantField) });
  }

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async count(criteria?: RepositoryCriteria): Promise<number> {
    const { where } = buildFindManyArgs(criteria, this.tenantField);
    return this.delegate.count({ where });
  }
}
