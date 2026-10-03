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

// Adversarial RAW payloads: each looks read-only-ish (or is syntactically a
// SELECT) at a glance, but has a write side effect. None of these can be
// expressed through the typed Query AST (SelectQuery has no `into`/
// `forUpdate` field, and RawQuery.sql is one opaque string) — they only
// exist to prove the policy of "RAW is rejected outright, never pattern-
// matched against SQL text" actually holds for the exact attacks that
// pattern-matching ("does it start with SELECT/WITH?") would miss.
const CTE_DELETE_QUERY: RawQuery = {
  type: 'RAW',
  sql: 'WITH deleted AS (DELETE FROM produtos RETURNING *) SELECT * FROM deleted',
};
const SELECT_INTO_QUERY: RawQuery = {
  type: 'RAW',
  sql: 'SELECT * INTO backup_produtos FROM produtos',
};
const SELECT_FOR_UPDATE_QUERY: RawQuery = {
  type: 'RAW',
  sql: 'SELECT * FROM produtos WHERE id = 1 FOR UPDATE',
};
const STACKED_STATEMENTS_QUERY: RawQuery = {
  type: 'RAW',
  sql: 'SELECT 1; DROP TABLE produtos;',
};

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

  it('blocks a CTE whose body is a DELETE, even though the outer statement is a SELECT', async () => {
    await expect(adapter.execute(CTE_DELETE_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks SELECT ... INTO (creates and populates a new table — a write disguised as a SELECT)', async () => {
    await expect(adapter.execute(SELECT_INTO_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks SELECT ... FOR UPDATE (takes row locks on the customer ERP — a liveness risk even without a write)', async () => {
    await expect(adapter.execute(SELECT_FOR_UPDATE_QUERY)).rejects.toThrow(ReadOnlyViolationError);
    expect(tracking.queries).toHaveLength(0);
  });

  it('blocks multiple ";"-stacked statements (a harmless-looking SELECT hiding a second, destructive statement)', async () => {
    await expect(adapter.execute(STACKED_STATEMENTS_QUERY)).rejects.toThrow(ReadOnlyViolationError);
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
