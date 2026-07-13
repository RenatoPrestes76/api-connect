import type { Table } from './table.js';
import type { Relation } from './relation.js';

export interface DatabaseSchema {
  readonly name: string;
  readonly tables: Table[];
  readonly relations: Relation[];
  readonly discoveredAt: Date;
}
