import type { SyncContext, SyncResult, ConnectorContext } from '@seltriva/connector-sdk';
import type { DatabaseAdapter } from '@seltriva/database-sdk';
import { QueryBuilder } from '@seltriva/database-sdk';
import type { AtlasInventory } from '../mapper.js';
import { mapInventory } from '../mapper.js';
import { rowToErpInventory } from '../db/row-mapper.js';
import { resolveTable } from '../db/table-resolver.js';

const INVENTORY_JOIN_SQL = `
  SELECT
    p.codigo                   AS produto_codigo,
    e.cod_deposito::text        AS deposito,
    e.qtd_atual,
    COALESCE(e.qtd_reservada, 0) AS qtd_reservada,
    e.dt_ultima_saida
  FROM estoque e
  JOIN produtos p ON e.cod_produto = p.id
  WHERE e.qtd_atual > 0
`;

const INVENTORY_JOIN_SQL_SINCE = `
  SELECT
    p.codigo                   AS produto_codigo,
    e.cod_deposito::text        AS deposito,
    e.qtd_atual,
    COALESCE(e.qtd_reservada, 0) AS qtd_reservada,
    e.dt_ultima_saida
  FROM estoque e
  JOIN produtos p ON e.cod_produto = p.id
  WHERE e.qtd_atual > 0
    AND e.dt_ultima_saida >= $1
`;

export interface InventorySyncResult {
  result:    SyncResult;
  inventory: AtlasInventory[];
}

export class InventorySync {
  constructor(
    private readonly _ctx: ConnectorContext,
    private readonly _db:  DatabaseAdapter,
  ) {}

  async sync(context: SyncContext): Promise<InventorySyncResult> {
    const start = Date.now();
    this._ctx.logger.info('Syncing inventory', { jobId: context.jobId });

    const schema    = await this._db.schema();
    const tableName = resolveTable('inventory', schema.tables.map((t) => t.name));

    if (!tableName) {
      this._ctx.logger.warn('Inventory table not found — skipping');
      return {
        result: { synced: 0, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
        inventory: [],
      };
    }

    const query = context.since
      ? QueryBuilder.raw(INVENTORY_JOIN_SQL_SINCE, [context.since.toISOString()])
      : QueryBuilder.raw(INVENTORY_JOIN_SQL);

    type Row = Record<string, unknown>;
    const rows      = await this._db.execute<Row>(query);
    const inventory = rows.map((r) => mapInventory(rowToErpInventory(r)));
    const count     = inventory.length;

    this._ctx.logger.debug('Inventory sync complete', { synced: count, durationMs: Date.now() - start });
    return {
      result: { synced: count, skipped: 0, failed: 0, errors: [], finishedAt: new Date() },
      inventory,
    };
  }
}
