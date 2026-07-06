import type { SchemaReader, DatabaseSchema } from '../schema-reader.js';
import type { Table, ForeignKey, Index, PrimaryKey } from '../table.js';
import type { Column } from '../column.js';
import type { Relation } from '../relation.js';
import type { DbQueryClient } from './db-client.js';

export class MySQLSchemaReader implements SchemaReader {
  constructor(
    private readonly _client: DbQueryClient,
    private readonly _database: string,
  ) {}

  async listTables(): Promise<string[]> {
    const { rows } = await this._client.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [this._database],
    );
    return rows.map((r) => String(r['TABLE_NAME']));
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
    return { name: this._database, tables, relations, discoveredAt: new Date() };
  }

  private async _readTableDetails(name: string): Promise<Table> {
    const columns    = await this._readColumns(name);
    const { primaryKey, foreignKeys, indexes } = await this._readConstraints(name);
    return { name, schema: this._database, columns, primaryKey, foreignKeys, indexes };
  }

  private async _readColumns(table: string): Promise<Column[]> {
    const { rows } = await this._client.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [this._database, table],
    );
    return rows.map((r) => ({
      name:         String(r['COLUMN_NAME']),
      type:         String(r['DATA_TYPE']),
      nullable:     r['IS_NULLABLE'] === 'YES',
      isPrimaryKey: r['COLUMN_KEY'] === 'PRI',
      isForeignKey: r['COLUMN_KEY'] === 'MUL',
      isUnique:     r['COLUMN_KEY'] === 'UNI' || r['COLUMN_KEY'] === 'PRI',
    }));
  }

  private async _readConstraints(table: string): Promise<{
    primaryKey?: PrimaryKey;
    foreignKeys: ForeignKey[];
    indexes:     Index[];
  }> {
    const { rows } = await this._client.query(
      `SELECT kcu.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE,
              kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
       FROM information_schema.TABLE_CONSTRAINTS  AS tc
       JOIN information_schema.KEY_COLUMN_USAGE   AS kcu
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA    = kcu.TABLE_SCHEMA
        AND tc.TABLE_NAME      = kcu.TABLE_NAME
       WHERE tc.TABLE_SCHEMA = ? AND tc.TABLE_NAME = ?`,
      [this._database, table],
    );

    const pkCols: string[] = [];
    const foreignKeys: ForeignKey[] = [];
    const indexMap = new Map<string, Index>();

    for (const r of rows) {
      const col   = String(r['COLUMN_NAME']);
      const ctype = String(r['CONSTRAINT_TYPE']);
      const cname = String(r['CONSTRAINT_NAME']);

      if (ctype === 'PRIMARY KEY') {
        pkCols.push(col);
        if (!indexMap.has(cname)) {
          indexMap.set(cname, { name: cname, columns: [], isUnique: true, isPrimary: true });
        }
        indexMap.get(cname)!.columns.push(col);
      }

      if (ctype === 'FOREIGN KEY' && r['REFERENCED_TABLE_NAME']) {
        foreignKeys.push({
          column:           col,
          referencedTable:  String(r['REFERENCED_TABLE_NAME']),
          referencedColumn: String(r['REFERENCED_COLUMN_NAME']),
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
