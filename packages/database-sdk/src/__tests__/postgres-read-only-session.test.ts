import { describe, it, expect } from 'vitest';
import { PostgresDriver } from '../drivers/postgres.driver.js';
import type { DbQueryClient } from '../schema/readers/db-client.js';
import type { SchemaReader, DatabaseSchema } from '../schema/schema-reader.js';

const CFG = {
  host: 'localhost',
  port: 5432,
  database: 'erp_test',
  username: 'erp_readonly_user',
  password: 'secret',
};

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

function fakePool() {
  return {
    connect: async () => ({ release: () => {} }),
    query: async () => ({ rows: [] }),
    end: async () => {},
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  };
}

/**
 * Third defense-in-depth layer (alongside `ReadOnlyAdapter` and a
 * database-level read-only user) — see docs/ATLAS-RUNTIME-CLIENT.md's
 * "Database access requirements". Even if a write query somehow reached
 * `execute()`, Postgres itself must reject it because every connection in
 * the pool was opened with `default_transaction_read_only = on`.
 */
describe('PostgresDriver readOnlySession', () => {
  it('passes the default_transaction_read_only startup option to every connection when readOnlySession is true', async () => {
    let receivedConfig: { options?: string } | undefined;
    const driver = new PostgresDriver(
      { ...CFG, readOnlySession: true },
      (poolConfig) => {
        receivedConfig = poolConfig as { options?: string };
        return fakePool() as never;
      },
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader()
    );
    await driver.connect();
    expect(receivedConfig?.options).toBe('-c default_transaction_read_only=on');
  });

  it('does not set any read-only startup option when readOnlySession is omitted (every other consumer, unchanged)', async () => {
    let receivedConfig: { options?: string } | undefined;
    const driver = new PostgresDriver(
      CFG,
      (poolConfig) => {
        receivedConfig = poolConfig as { options?: string };
        return fakePool() as never;
      },
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader()
    );
    await driver.connect();
    expect(receivedConfig?.options).toBeUndefined();
  });

  it('does not set it when readOnlySession is explicitly false', async () => {
    let receivedConfig: { options?: string } | undefined;
    const driver = new PostgresDriver(
      { ...CFG, readOnlySession: false },
      (poolConfig) => {
        receivedConfig = poolConfig as { options?: string };
        return fakePool() as never;
      },
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader()
    );
    await driver.connect();
    expect(receivedConfig?.options).toBeUndefined();
  });
});
