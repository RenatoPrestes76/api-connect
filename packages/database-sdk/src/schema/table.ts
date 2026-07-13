import type { Column } from './column.js';

export interface PrimaryKey {
  readonly columns: string[];
}

export interface ForeignKey {
  readonly column: string;
  readonly referencedTable: string;
  readonly referencedColumn: string;
}

export interface Index {
  readonly name: string;
  readonly columns: string[];
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
}

export interface Table {
  readonly name: string;
  readonly schema?: string;
  readonly columns: Column[];
  readonly primaryKey?: PrimaryKey;
  readonly foreignKeys: ForeignKey[];
  readonly indexes: Index[];
}
