import type { SchemaReader, DatabaseSchema } from '../schema-reader.js';
import type { Table, ForeignKey, Index, PrimaryKey } from '../table.js';
import type { Column } from '../column.js';
import type { Relation } from '../relation.js';
import type { DbQueryClient } from './db-client.js';

export class PostgresSchemaReader implements SchemaReader {
  constructor(
    private readonly _client: DbQueryClient,
    private readonly _schema = 'public',
  ) {}

  async listTables(): Promise<string[]> {
    const { rows } = await this._client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this._schema],
    );
    return rows.map((r) => String(r['table_name']));
  }

  async readTable(name: string): Promise<Table | null> {
    const tables = await this.listTables();
    if (!tables.includes(name)) return null;
    return this._readTableDetails(name);
  }

  async readSchema(): Promise<DatabaseSchema> {
    const tableNames = await this.listTables();
    const tables = await Promise.all(tableNames.map((n) => this._readTableDetails(n)));
    const relations = this._buildRelations(tables);
    return { name: this._schema, tables, relations, discoveredAt: new Date() };
  }

  private async _readTableDetails(name: string): Promise<Table> {
    const columns    = await this._readColumns(name);
    const { primaryKey, foreignKeys, indexes } = await this._readConstraints(name);
    return { name, schema: this._schema, columns, primaryKey, foreignKeys, indexes };
  }

  private async _readColumns(table: string): Promise<Column[]> {
    const { rows } = await this._client.query(
      `SELECT column_name, data_type, is_nullable, column_key
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [this._schema, table],
    );
    return rows.map((r) => ({
      name:         String(r['column_name']),
      type:         String(r['data_type']),
      nullable:     r['is_nullable'] === 'YES',
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique:     false,
    }));
  }

  private async _readConstraints(table: string): Promise<{
    primaryKey?: PrimaryKey;
    foreignKeys: ForeignKey[];
    indexes:     Index[];
  }> {
    const { rows } = await this._client.query(
      `SELECT tc.constraint_type, tc.constraint_name,
              kcu.column_name, kcu.ordinal_position,
              ccu.table_name  AS foreign_table,
              ccu.column_name AS foreign_column
       FROM information_schema.table_constraints   AS tc
       JOIN information_schema.key_column_usage    AS kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema    = kcu.table_schema
        AND tc.table_name      = kcu.table_name
  LEFT JOIN information_schema.constraint_column_usage AS ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema    = ccu.table_schema
       WHERE tc.table_schema = $1 AND tc.table_name = $2`,
      [this._schema, table],
    );

    const pkCols: string[] = [];
    const foreignKeys: ForeignKey[] = [];
    const indexMap = new Map<string, Index>();

    for (const r of rows) {
      const col        = String(r['column_name']);
      const ctype      = String(r['constraint_type']);
      const cname      = String(r['constraint_name']);

      if (ctype === 'PRIMARY KEY') {
        pkCols.push(col);
        if (!indexMap.has(cname)) {
          indexMap.set(cname, { name: cname, columns: [], isUnique: true, isPrimary: true });
        }
        indexMap.get(cname)!.columns.push(col);
      }

      if (ctype === 'FOREIGN KEY') {
        foreignKeys.push({
          column:           col,
          referencedTable:  String(r['foreign_table']),
          referencedColumn: String(r['foreign_column']),
        });
      }

      if (ctype === 'UNIQUE') {
        if (!indexMap.has(cname)) {
          indexMap.set(cname, { name: cname, columns: [], isUnique: true, isPrimary: false });
        }
        indexMap.get(cname)!.columns.push(col);
      }
    }

    return {
      primaryKey:  pkCols.length ? { columns: pkCols } : undefined,
      foreignKeys,
      indexes:     [...indexMap.values()],
    };
  }

  private _buildRelations(tables: Table[]): Relation[] {
    const relations: Relation[] = [];
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        relations.push({
          fromTable:  table.name,
          fromColumn: fk.column,
          toTable:    fk.referencedTable,
          toColumn:   fk.referencedColumn,
          type:       'many-to-one',
        });
      }
    }
    return relations;
  }
}
