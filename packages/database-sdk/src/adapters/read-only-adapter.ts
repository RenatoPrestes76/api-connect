import type { DatabaseAdapter, DatabaseHealth } from './database-adapter.js';
import type { Query } from '../query/query-types.js';
import type { DatabaseSchema } from '../schema/schema-reader.js';
import type { SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import { ReadOnlyViolationError } from '../errors/database-errors.js';

/** The only query type a `ReadOnlyAdapter` ever forwards to the wrapped driver. */
const ALLOWED_QUERY_TYPE = 'SELECT';

/**
 * Wraps any `DatabaseAdapter` (+ `SchemaReader`) so only `SELECT` queries can
 * reach the underlying driver's `execute()` — `INSERT`/`UPDATE`/`DELETE`/`RAW`
 * are rejected before the call ever reaches the wrapped driver, let alone the
 * database. This is the structural enforcement for Atlas's "the runtime never
 * writes to a customer's ERP" requirement: the underlying drivers in this
 * package expose a general-purpose `execute(query: Query)` capable of running
 * any query type, so nothing before this wrapper stopped a future caller from
 * building an `InsertQuery`/`UpdateQuery`/`DeleteQuery` and running it.
 *
 * `RAW` is rejected too, deliberately without attempting to parse the SQL
 * text — a free-text SQL string can't be safely vetted for "is this really
 * read-only" (comments, multiple statements, dialect quirks), so the only
 * safe policy is to refuse it outright rather than pretend to validate it.
 *
 * This is one of two independent layers (defense in depth), not the whole
 * story — the ERP connection itself should also use a database-level
 * read-only user wherever the ERP vendor supports one; see
 * docs/ATLAS-RUNTIME-CLIENT.md's "Database access requirements" section.
 */
export class ReadOnlyAdapter implements DatabaseAdapter, SchemaReader {
  constructor(private readonly _inner: DatabaseAdapter & SchemaReader) {}

  async connect(): Promise<void> {
    await this._inner.connect();
  }

  async disconnect(): Promise<void> {
    await this._inner.disconnect();
  }

  async reconnect(): Promise<void> {
    await this._inner.reconnect();
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (query.type !== ALLOWED_QUERY_TYPE) {
      throw new ReadOnlyViolationError(query.type);
    }
    return this._inner.execute<T>(query);
  }

  /**
   * The callback itself could still try to write if it closes over the raw
   * inner adapter instead of this wrapper — callers must only ever hold a
   * reference to the `ReadOnlyAdapter`, never to the driver passed into its
   * constructor, for this guarantee to hold.
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this._inner.transaction(callback);
  }

  async health(): Promise<DatabaseHealth> {
    return this._inner.health();
  }

  async schema(): Promise<DatabaseSchema> {
    return this._inner.schema();
  }

  async readSchema(): Promise<DatabaseSchema> {
    return this._inner.readSchema();
  }

  async listTables(): Promise<string[]> {
    return this._inner.listTables();
  }

  async readTable(name: string): Promise<Table | null> {
    return this._inner.readTable(name);
  }
}
