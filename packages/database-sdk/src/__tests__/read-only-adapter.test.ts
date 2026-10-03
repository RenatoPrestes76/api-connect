import { describe, it, expect, beforeEach } from 'vitest';
import { ReadOnlyAdapter } from '../adapters/read-only-adapter.js';
import { PostgresDriver } from '../drivers/postgres.driver.js';
import { ReadOnlyViolationError } from '../errors/database-errors.js';
import type {
  SelectQuery,
  InsertQuery,
  UpdateQuery,
  DeleteQuery,
  RawQuery,
} from '../query/query-types.js';
import type { DbQueryClient } from '../schema/readers/db-client.js';
import type { SchemaReader, DatabaseSchema } from '../schema/schema-reader.js';

const CFG = {
  host: 'localhost',
  port: 5432,
  database: 'erp_test',
  username: 'erp_readonly_user',
  password: 'secret',
};

/** Tracks every SQL statement that actually reached the "database", so a test can assert zero reached it. */
function makeTrackingPgPool() {
  const queries: string[] = [];
  return {
    pool: {
      connect: async () => ({ release: () => {} }),
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('version()')) return { rows: [{ version: 'PostgreSQL 16' }] };
        return { rows: [{ ok: true }] };
      },
      end: async () => {},
      totalCount: 1,
      idleCount: 1,
      waitingCount: 0,
    },
    queries,
  };
}

function makeMockSchemaReader(): SchemaReader {
  const schema: DatabaseSchema = {
    name: 'erp_test',
    tables: [],
    relations: [],
    discoveredAt: new Date(),
  };
  return {
    readSchema: async () => schema,
    listTables: async () => [],
    readTable: async () => null,
  };
}

const SELECT_QUERY: SelectQuery = { type: 'SELECT', table: 'produtos', columns: ['id', 'nome'] };
const INSERT_QUERY: InsertQuery = { type: 'INSERT', table: 'produtos', values: [{ nome: 'hack' }] };
const UPDATE_QUERY: UpdateQuery = {
  type: 'UPDATE',
  table: 'produtos',
  set: { preco: 0 },
  where: [],
};
const DELETE_QUERY: DeleteQuery = { type: 'DELETE', table: 'produtos', where: [] };
const RAW_QUERY: RawQuery = { type: 'RAW', sql: 'DELETE FROM produtos' };

describe('ReadOnlyAdapter', () => {
  let tracking: ReturnType<typeof makeTrackingPgPool>;
  let adapter: ReadOnlyAdapter;

  beforeEach(async () => {
    tracking = makeTrackingPgPool();
    const driver = new PostgresDriver(
      CFG,
      () => tracking.pool as never,
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader()
    );
    adapter = new ReadOnlyAdapter(driver);
    await adapter.connect();
  });

  it('forwards a SELECT to the underlying driver and returns its rows', async () => {
    const rows = await adapter.execute(SELECT_QUERY);
    expect(rows).toEqual([{ ok: true }]);
    expect(tracking.queries).toHaveLength(1);
  });

  it('blocks INSERT before it ever reaches the database', async () => {
    await expect(adapter.execute(INSERT_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks UPDATE before it ever reaches the database', async () => {
    await expect(adapter.execute(UPDATE_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks DELETE before it ever reaches the database', async () => {
    await expect(adapter.execute(DELETE_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks RAW queries too — free-text SQL can hide a write and is never vetted as safe', async () => {
    await expect(adapter.execute(RAW_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('error message names the rejected query type, for operators reading logs', async () => {
    await expect(adapter.execute(DELETE_QUERY)).rejects.toThrow(/DELETE/);
  });

  it('still allows schema introspection (read-only by construction, bypasses execute())', async () => {
    const schema = await adapter.readSchema();
    expect(schema.name).toBe('erp_test');
  });

  it('a second, independent ReadOnlyAdapter instance over the same kind of driver also blocks writes', async () => {
    // Guards against a stateful/singleton implementation mistake where
    // blocking depends on shared module state rather than per-call checks.
    const other = makeTrackingPgPool();
    const otherAdapter = new ReadOnlyAdapter(
      new PostgresDriver(
        CFG,
        () => other.pool as never,
        () => makeMockSchemaReader()
      )
    );
    await otherAdapter.connect();
    await expect(otherAdapter.execute(INSERT_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(other.queries).toHaveLength(0);
  });
});
