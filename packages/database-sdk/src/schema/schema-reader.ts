import type { Table } from './table.js';
export type { DatabaseSchema } from './metadata.js';
import type { DatabaseSchema } from './metadata.js';

export interface SchemaReader {
  readSchema():            Promise<DatabaseSchema>;
  readTable(name: string): Promise<Table | null>;
  listTables():            Promise<string[]>;
}
