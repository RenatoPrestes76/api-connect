import type { SchemaReader, DatabaseSchema } from '../schema-reader.js';
import type { Table, ForeignKey, Index, PrimaryKey } from '../table.js';
import type { Column } from '../column.js';
import type { Relation } from '../relation.js';
import type { DbQueryClient } from './db-client.js';

export class SQLServerSchemaReader implements SchemaReader {
  constructor(
    private readonly _client: DbQueryClient,
    private readonly _schema = 'dbo',
  ) {}

  async listTables(): Promise<string[]> {
    const { rows } = await this._client.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = @p1 AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [this._schema],
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
    return { name: this._schema, tables, relations, discoveredAt: new Date() };
  }

  private async _readTableDetails(name: string): Promise<Table> {
    const columns    = await this._readColumns(name);
    const { primaryKey, foreignKeys, indexes } = await this._readConstraints(name);
    return { name, schema: this._schema, columns, primaryKey, foreignKeys, indexes };
  }

  private async _readColumns(table: string): Promise<Column[]> {
    const { rows } = await this._client.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
       ORDER BY ORDINAL_POSITION`,
      [this._schema, table],
    );
    return rows.map((r) => ({
      name:         String(r['COLUMN_NAME']),
      type:         String(r['DATA_TYPE']),
      nullable:     r['IS_NULLABLE'] === 'YES',
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
      `SELECT tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME,
              kcu.COLUMN_NAME,
              ccu.TABLE_NAME  AS FK_TABLE,
              ccu.COLUMN_NAME AS FK_COLUMN
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS        AS tc
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE         AS kcu
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA    = kcu.TABLE_SCHEMA
  LEFT JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE  AS ccu
         ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
       WHERE tc.TABLE_SCHEMA = @p1 AND tc.TABLE_NAME = @p2`,
      [this._schema, table],
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

      if (ctype === 'FOREIGN KEY' && r['FK_TABLE']) {
        foreignKeys.push({
          column:           col,
          referencedTable:  String(r['FK_TABLE']),
          referencedColumn: String(r['FK_COLUMN']),
        });
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
