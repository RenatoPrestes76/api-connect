import type {
  ConnectorResult,
  DiscoveryResult,
  DiscoveredEntity,
  ConnectorContext,
} from '@seltriva/connector-sdk';
import { ok } from '@seltriva/connector-sdk';
import type { DatabaseAdapter } from '@seltriva/database-sdk';
import { detectEntities, resolveTable } from './db/table-resolver.js';

export class DiscoveryEngine {
  constructor(
    private readonly _connectorId: string,
    private readonly _ctx: ConnectorContext,
    private readonly _db: DatabaseAdapter
  ) {}

  async discover(): Promise<ConnectorResult<DiscoveryResult>> {
    const start = Date.now();
    this._ctx.logger.info('Starting schema discovery');

    const schema = await this._db.schema();
    const tableNames = schema.tables.map((t) => t.name);
    const entityNames = detectEntities(tableNames);

    const entities: DiscoveredEntity[] = entityNames.map((name) => {
      const tableName = resolveTable(name, tableNames)!;
      const table = schema.tables.find((t) => t.name === tableName)!;
      return {
        id: `${this._connectorId}/${name}`,
        name,
        type: 'entity-collection',
        path: `/${name}`,
        extra: {
          table: tableName,
          columns: table.columns.length,
          syncable: true,
        },
      };
    });

    const durationMs = Date.now() - start;

    this._ctx.eventBus.emit('discovery.finished', {
      connectorId: this._connectorId,
      entitiesFound: entities.length,
      durationMs,
      finishedAt: new Date(),
    });

    this._ctx.logger.info('Discovery complete', {
      tables: tableNames.length,
      entities: entities.length,
    });

    return ok({ entities, total: entities.length, discoveredAt: new Date() }, durationMs);
  }
}
