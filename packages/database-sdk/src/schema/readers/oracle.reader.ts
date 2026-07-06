import type { SchemaReader, DatabaseSchema } from '../schema-reader.js';
import type { Table, ForeignKey, Index, PrimaryKey } from '../table.js';
import type { Column } from '../column.js';
import type { Relation } from '../relation.js';
import type { DbQueryClient } from './db-client.js';

export class OracleSchemaReader implements SchemaReader {
  constructor(
    private readonly _client: DbQueryClient,
    private readonly _owner: string,
  ) {}

  async listTables(): Promise<string[]> {
    const { rows } = await this._client.query(
      `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :1 ORDER BY TABLE_NAME`,
      [this._owner.toUpperCase()],
    );
    return rows.map((r) => String(r['TABLE_NAME']));
  }

  async readTable(name: string): Promise<Table | null> {
    const tables = await this.listTables();
    if (!tables.includes(name.toUpperCase())) return null;
    return this._readTableDetails(name.toUpperCase());
  }

  async readSchema(): Promise<DatabaseSchema> {
    const tableNames = await this.listTables();
    const tables = await Promise.all(tableNames.map((n) => this._readTableDetails(n)));
    const relations = this._buildRelations(tables);
    return { name: this._owner, tables, relations, discoveredAt: new Date() };
  }

  private async _readTableDetails(name: string): Promise<Table> {
    const columns    = await this._readColumns(name);
    const { primaryKey, foreignKeys, indexes } = await this._readConstraints(name);
    return { name, schema: this._owner, columns, primaryKey, foreignKeys, indexes };
  }

  private async _readColumns(table: string): Promise<Column[]> {
    const { rows } = await this._client.query(
      `SELECT COLUMN_NAME, DATA_TYPE, NULLABLE
       FROM ALL_TAB_COLUMNS
       WHERE OWNER = :1 AND TABLE_NAME = :2
       ORDER BY COLUMN_ID`,
      [this._owner.toUpperCase(), table],
    );
    return rows.map((r) => ({
      name:         String(r['COLUMN_NAME']),
      type:         String(r['DATA_TYPE']),
      nullable:     r['NULLABLE'] === 'Y',
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
      `SELECT ac.CONSTRAINT_TYPE, ac.CONSTRAINT_NAME,
              acc.COLUMN_NAME,
              rac.TABLE_NAME  AS FK_TABLE,
              racc.COLUMN_NAME AS FK_COLUMN
       FROM ALL_CONSTRAINTS   ac
       JOIN ALL_CONS_COLUMNS  acc
         ON ac.CONSTRAINT_NAME = acc.CONSTRAINT_NAME
        AND ac.OWNER           = acc.OWNER
  LEFT JOIN ALL_CONSTRAINTS    rac
         ON ac.R_CONSTRAINT_NAME = rac.CONSTRAINT_NAME
        AND ac.OWNER             = rac.OWNER
  LEFT JOIN ALL_CONS_COLUMNS   racc
         ON rac.CONSTRAINT_NAME = racc.CONSTRAINT_NAME
        AND rac.OWNER           = racc.OWNER
       WHERE ac.OWNER = :1 AND ac.TABLE_NAME = :2`,
      [this._owner.toUpperCase(), table],
    );

    const pkCols: string[] = [];
    const foreignKeys: ForeignKey[] = [];
    const indexMap = new Map<string, Index>();

    for (const r of rows) {
      const col   = String(r['COLUMN_NAME']);
      const ctype = String(r['CONSTRAINT_TYPE']);
      const cname = String(r['CONSTRAINT_NAME']);

      if (ctype === 'P') {
        pkCols.push(col);
        if (!indexMap.has(cname)) {
          indexMap.set(cname, { name: cname, columns: [], isUnique: true, isPrimary: true });
        }
        indexMap.get(cname)!.columns.push(col);
      }

      if (ctype === 'R' && r['FK_TABLE']) {
        foreignKeys.push({
          column:           col,
          referencedTable:  String(r['FK_TABLE']),
          referencedColumn: String(r['FK_COLUMN'] ?? col),
        });
      }

      if (ctype === 'U') {
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
