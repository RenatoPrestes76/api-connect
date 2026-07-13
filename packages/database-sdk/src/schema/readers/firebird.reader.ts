import type { SchemaReader, DatabaseSchema } from '../schema-reader.js';
import type { Table, ForeignKey, Index, PrimaryKey } from '../table.js';
import type { Column } from '../column.js';
import type { Relation } from '../relation.js';
import type { DbQueryClient } from './db-client.js';

export class FirebirdSchemaReader implements SchemaReader {
  constructor(private readonly _client: DbQueryClient) {}

  async listTables(): Promise<string[]> {
    const { rows } = await this._client.query(
      `SELECT RDB$RELATION_NAME FROM RDB$RELATIONS
       WHERE RDB$SYSTEM_FLAG = 0 AND RDB$VIEW_BLR IS NULL
       ORDER BY RDB$RELATION_NAME`
    );
    return rows.map((r) => String(r['RDB$RELATION_NAME']).trim());
  }

  async readTable(name: string): Promise<Table | null> {
    const tables = await this.listTables();
    const upper = name.toUpperCase();
    if (!tables.some((t) => t.toUpperCase() === upper)) return null;
    return this._readTableDetails(name);
  }

  async readSchema(): Promise<DatabaseSchema> {
    const tableNames = await this.listTables();
    const tables = await Promise.all(tableNames.map((n) => this._readTableDetails(n)));
    const relations = this._buildRelations(tables);
    return { name: 'firebird', tables, relations, discoveredAt: new Date() };
  }

  private async _readTableDetails(name: string): Promise<Table> {
    const columns = await this._readColumns(name);
    const { primaryKey, foreignKeys, indexes } = await this._readConstraints(name);
    return { name, columns, primaryKey, foreignKeys, indexes };
  }

  private async _readColumns(table: string): Promise<Column[]> {
    const { rows } = await this._client.query(
      `SELECT r.RDB$FIELD_NAME, f.RDB$FIELD_TYPE, r.RDB$NULL_FLAG
       FROM RDB$RELATION_FIELDS r
       JOIN RDB$FIELDS f ON r.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
       WHERE r.RDB$RELATION_NAME = ?
       ORDER BY r.RDB$FIELD_POSITION`,
      [table.toUpperCase()]
    );
    return rows.map((r) => ({
      name: String(r['RDB$FIELD_NAME']).trim(),
      type: String(r['RDB$FIELD_TYPE']),
      nullable: !r['RDB$NULL_FLAG'],
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    }));
  }

  private async _readConstraints(table: string): Promise<{
    primaryKey?: PrimaryKey;
    foreignKeys: ForeignKey[];
    indexes: Index[];
  }> {
    const { rows } = await this._client.query(
      `SELECT rc.RDB$CONSTRAINT_TYPE, rc.RDB$CONSTRAINT_NAME,
              iseg.RDB$FIELD_NAME,
              rcref.RDB$RELATION_NAME AS FK_TABLE
       FROM RDB$RELATION_CONSTRAINTS rc
       JOIN RDB$INDEX_SEGMENTS iseg ON rc.RDB$INDEX_NAME = iseg.RDB$INDEX_NAME
  LEFT JOIN RDB$REF_CONSTRAINTS rcref ON rc.RDB$CONSTRAINT_NAME = rcref.RDB$CONSTRAINT_NAME
       WHERE rc.RDB$RELATION_NAME = ?`,
      [table.toUpperCase()]
    );

    const pkCols: string[] = [];
    const foreignKeys: ForeignKey[] = [];
    const indexMap = new Map<string, Index>();

    for (const r of rows) {
      const col = String(r['RDB$FIELD_NAME']).trim();
      const ctype = String(r['RDB$CONSTRAINT_TYPE']).trim();
      const cname = String(r['RDB$CONSTRAINT_NAME']).trim();

      if (ctype === 'PRIMARY KEY') {
        pkCols.push(col);
        if (!indexMap.has(cname)) {
          indexMap.set(cname, { name: cname, columns: [], isUnique: true, isPrimary: true });
        }
        indexMap.get(cname)!.columns.push(col);
      }

      if (ctype === 'FOREIGN KEY' && r['FK_TABLE']) {
        foreignKeys.push({
          column: col,
          referencedTable: String(r['FK_TABLE']).trim(),
          referencedColumn: col,
        });
      }
    }

    return {
      primaryKey: pkCols.length ? { columns: pkCols } : undefined,
      foreignKeys,
      indexes: [...indexMap.values()],
    };
  }

  private _buildRelations(tables: Table[]): Relation[] {
    const relations: Relation[] = [];
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        relations.push({
          fromTable: table.name,
          fromColumn: fk.column,
          toTable: fk.referencedTable,
          toColumn: fk.referencedColumn,
          type: 'many-to-one',
        });
      }
    }
    return relations;
  }
}
