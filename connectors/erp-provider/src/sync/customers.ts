import type { SyncContext, SyncResult, ConnectorContext } from '@seltriva/connector-sdk';
import type { DatabaseAdapter } from '@seltriva/database-sdk';
import { QueryBuilder, greaterThan } from '@seltriva/database-sdk';
import type { AtlasCustomer } from '../mapper.js';
import { mapCustomer } from '../mapper.js';
import { rowToErpCustomer } from '../db/row-mapper.js';
import { resolveTable } from '../db/table-resolver.js';

export interface CustomersSyncResult {
  result:    SyncResult;
  customers: AtlasCustomer[];
}

export class CustomersSync {
  constructor(
    private readonly _ctx: ConnectorContext,
    private readonly _db:  DatabaseAdapter,
  ) {}

  async sync(context: SyncContext): Promise<CustomersSyncResult> {
    const start = Date.now();
    this._ctx.logger.info('Syncing customers', { jobId: context.jobId });

    const schema    = await this._db.schema();
    const tableName = resolveTable('customers', schema.tables.map((t) => t.name));

    if (!tableName) {
      this._ctx.logger.warn('Customers table not found — skipping');
      return {
        result: { synced: 0, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
        customers: [],
      };
    }

    const builder = new QueryBuilder().from(tableName);
    if (context.since) {
      builder.where(greaterThan('dt_alteracao', context.since.toISOString()));
    }
    const query = builder.build();

    type Row = Record<string, unknown>;
    const rows      = await this._db.execute<Row>(query);
    const customers = rows.map((r) => mapCustomer(rowToErpCustomer(r)));
    const count     = customers.length;

    this._ctx.logger.debug('Customers sync complete', { synced: count, durationMs: Date.now() - start });
    return {
      result: { synced: count, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
      customers,
    };
  }
}
