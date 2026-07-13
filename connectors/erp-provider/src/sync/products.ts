import type { SyncContext, SyncResult, ConnectorContext } from '@seltriva/connector-sdk';
import type { DatabaseAdapter } from '@seltriva/database-sdk';
import { QueryBuilder, greaterThan } from '@seltriva/database-sdk';
import type { AtlasProduct } from '../mapper.js';
import { mapProduct } from '../mapper.js';
import { rowToErpProduct } from '../db/row-mapper.js';
import { resolveTable } from '../db/table-resolver.js';

const PRODUCT_TABLE_CANDIDATES = ['produtos', 'products', 'itens', 'items', 'mercadorias'];

export interface ProductsSyncResult {
  result: SyncResult;
  products: AtlasProduct[];
}

export class ProductsSync {
  constructor(
    private readonly _ctx: ConnectorContext,
    private readonly _db: DatabaseAdapter
  ) {}

  async sync(context: SyncContext): Promise<ProductsSyncResult> {
    const start = Date.now();
    this._ctx.logger.info('Syncing products', { jobId: context.jobId });

    const schema = await this._db.schema();
    const tableName = resolveTable(
      'products',
      schema.tables.map((t) => t.name)
    );

    if (!tableName) {
      this._ctx.logger.warn('Products table not found — skipping', {
        candidates: PRODUCT_TABLE_CANDIDATES,
      });
      return {
        result: { synced: 0, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
        products: [],
      };
    }

    const builder = new QueryBuilder().from(tableName);
    if (context.since) {
      builder.where(greaterThan('dt_alteracao', context.since.toISOString()));
    }
    const query = builder.build();

    type Row = Record<string, unknown>;
    const rows = await this._db.execute<Row>(query);
    const products = rows.map((r) => mapProduct(rowToErpProduct(r)));
    const count = products.length;

    this._ctx.logger.debug('Products sync complete', {
      synced: count,
      durationMs: Date.now() - start,
    });
    return {
      result: { synced: count, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
      products,
    };
  }
}
