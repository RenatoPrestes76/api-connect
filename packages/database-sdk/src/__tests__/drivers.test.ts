import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresDriver }  from '../drivers/postgres.driver.js';
import { MySqlDriver }     from '../drivers/mysql.driver.js';
import { SqlServerDriver } from '../drivers/sqlserver.driver.js';
import { OracleDriver }    from '../drivers/oracle.driver.js';
import { FirebirdDriver }  from '../drivers/firebird.driver.js';
import type { DatabaseAdapter } from '../adapters/database-adapter.js';
import type { SchemaReader, DatabaseSchema } from '../schema/schema-reader.js';
import { ConnectionFailedError } from '../errors/database-errors.js';
import { QueryBuilder } from '../query/query-builder.js';
import { equals } from '../query/filters.js';
import type { DbQueryClient, DbRow } from '../schema/readers/db-client.js';
import type { FirebirdConnection } from '../drivers/firebird.driver.js';

// ─── Shared mock schema ──────────────────────────────────────────────────────

const MOCK_SCHEMA: DatabaseSchema = {
  name:     'testdb',
  tables: [
    {
      name:        'users',
      columns:     [
        { name: 'id',    type: 'integer', nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true  },
        { name: 'name',  type: 'varchar', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey:  { columns: ['id'] },
      foreignKeys: [],
      indexes:     [
        { name: 'pk_users', columns: ['id'],    isUnique: true,  isPrimary: true  },
        { name: 'uq_email', columns: ['email'], isUnique: true,  isPrimary: false },
      ],
    },
    {
      name:        'orders',
      columns:     [
        { name: 'id',      type: 'integer', nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true,  isUnique: false },
        { name: 'total',   type: 'decimal', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey:  { columns: ['id'] },
      foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
      indexes:     [
        { name: 'pk_orders',   columns: ['id'],      isUnique: true,  isPrimary: true  },
        { name: 'idx_user_id', columns: ['user_id'], isUnique: false, isPrimary: false },
      ],
    },
  ],
  relations: [{ fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id', type: 'many-to-one' }],
  discoveredAt: new Date(),
};

function makeMockSchemaReader(): SchemaReader {
  return {
    readSchema: async () => MOCK_SCHEMA,
    readTable:  async (name) => MOCK_SCHEMA.tables.find((t) => t.name === name) ?? null,
    listTables: async () => MOCK_SCHEMA.tables.map((t) => t.name),
  };
}

// ─── Per-driver mock factories ────────────────────────────────────────────────

function makePgMockPool(version: string) {
  const released = { done: false };
  return {
    connect: async () => ({ release: () => { released.done = true; } }),
    query:   async (sql: string) => {
      if (sql.includes('version()')) return { rows: [{ version }] };
      return { rows: [] };
    },
    end:           async () => {},
    totalCount:    1,
    idleCount:     1,
    waitingCount:  0,
  };
}

function makeMysqlMockPool(version: string) {
  return {
    query: async (sql: string) => {
      if (sql === 'SELECT 1')                        return [[], []];
      if (sql.includes('version() AS version'))      return [[{ version }], []];
      return [[], []];
    },
    end:  async () => {},
    pool: {
      _allConnections:  [],
      _freeConnections: [],
    },
  };
}

function makeMssqlMockPool(version: string) {
  const makeRequest = () => ({
    input: function(this: unknown) { return this; },
    query: async (sql: string) => {
      if (sql.includes('@@VERSION'))
        return { recordset: [{ version, conns: 1 }] };
      return { recordset: [] };
    },
  });
  return {
    connect:   async () => {},
    close:     async () => {},
    request:   () => makeRequest(),
    connected: true,
  };
}

function makeOracleMockPool(version: string) {
  const makeConn = () => ({
    execute: async (sql: string) => {
      if (sql.includes('V$VERSION')) return { rows: [{ BANNER: version }] };
      return { rows: [] };
    },
    close: async () => {},
  });
  return {
    getConnection:    async () => makeConn(),
    close:            async () => {},
    connectionsOpen:  1,
    connectionsInUse: 0,
  };
}

function makeFirebirdMockConn(version: string): FirebirdConnection {
  return {
    query: (sql: string, _params: unknown[], cb: (err: Error | null, rows: DbRow[]) => void) => {
      if (sql.includes('RDB$DATABASE') && version) {
        cb(null, [{ version }]);
      } else {
        cb(null, []);
      }
    },
    detach: (cb?: (err: Error | null) => void) => { cb?.(null); },
  };
}

// ─── Driver variants ──────────────────────────────────────────────────────────

const CFG = {
  host: 'localhost', port: 5432, database: 'testdb',
  username: 'sa', password: 'secret',
};

type DriverFactory = () => DatabaseAdapter & { isConnected: boolean };

const DRIVERS: [string, DriverFactory, string][] = [
  [
    'PostgreSQL',
    () => new PostgresDriver(
      CFG,
      () => makePgMockPool(PostgresDriver.VERSION) as never,
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader(),
    ),
    PostgresDriver.VERSION,
  ],
  [
    'MySQL',
    () => new MySqlDriver(
      CFG,
      () => makeMysqlMockPool(MySqlDriver.VERSION) as never,
      (_client: DbQueryClient, _db: string) => makeMockSchemaReader(),
    ),
    MySqlDriver.VERSION,
  ],
  [
    'SQL Server',
    () => new SqlServerDriver(
      CFG,
      () => makeMssqlMockPool(SqlServerDriver.VERSION) as never,
      (_client: DbQueryClient, _schema: string) => makeMockSchemaReader(),
    ),
    SqlServerDriver.VERSION,
  ],
  [
    'Oracle',
    () => new OracleDriver(
      CFG,
      async () => makeOracleMockPool(OracleDriver.VERSION) as never,
      (_client: DbQueryClient, _owner: string) => makeMockSchemaReader(),
    ),
    OracleDriver.VERSION,
  ],
  [
    'Firebird',
    () => new FirebirdDriver(
      CFG,
      async () => makeFirebirdMockConn(FirebirdDriver.VERSION),
      (_client: DbQueryClient) => makeMockSchemaReader(),
    ),
    FirebirdDriver.VERSION,
  ],
];

// ─── Test suite ───────────────────────────────────────────────────────────────

for (const [name, factory, version] of DRIVERS) {
  describe(`${name} driver`, () => {
    let driver: DatabaseAdapter & { isConnected: boolean };

    beforeEach(() => {
      driver = factory();
    });

    it('starts disconnected', () => {
      expect(driver.isConnected).toBe(false);
    });

    it('connect sets isConnected = true', async () => {
      await driver.connect();
      expect(driver.isConnected).toBe(true);
    });

    it('disconnect sets isConnected = false', async () => {
      await driver.connect();
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });

    it('reconnect: disconnect + connect cycle', async () => {
      await driver.connect();
      await driver.reconnect();
      expect(driver.isConnected).toBe(true);
    });

    it('execute returns [] when connected', async () => {
      await driver.connect();
      const q = new QueryBuilder().from('products').where(equals('id', 1)).build();
      const result = await driver.execute(q);
      expect(result).toEqual([]);
    });

    it('execute throws ConnectionFailedError when disconnected', async () => {
      const q = QueryBuilder.raw('SELECT 1');
      await expect(driver.execute(q)).rejects.toThrow(ConnectionFailedError);
    });

    it('health reflects connected state', async () => {
      await driver.connect();
      const h = await driver.health();
      expect(h.connected).toBe(true);
      expect(h.status).toBe('healthy');
      expect(typeof h.poolUsage).toBe('number');
    });

    it('health version contains expected string', async () => {
      await driver.connect();
      const h = await driver.health();
      expect(h.databaseVersion).toContain(version.split(' ')[0]!);
    });

    it('health reflects disconnected state', async () => {
      const h = await driver.health();
      expect(h.connected).toBe(false);
      expect(h.status).toBe('unhealthy');
    });

    it('schema returns 2 tables when connected', async () => {
      await driver.connect();
      const s = await driver.schema();
      expect(s.tables).toHaveLength(2);
      const tableNames = s.tables.map((t) => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('orders');
    });

    it('schema throws when disconnected', async () => {
      await expect(driver.schema()).rejects.toThrow(ConnectionFailedError);
    });

    it('schema has a relation', async () => {
      await driver.connect();
      const s = await driver.schema();
      expect(s.relations).toHaveLength(1);
      expect(s.relations[0]!.fromTable).toBe('orders');
      expect(s.relations[0]!.toTable).toBe('users');
    });

    it('listTables returns table names', async () => {
      await driver.connect();
      const d = driver as unknown as { listTables(): Promise<string[]> };
      const tables = await d.listTables();
      expect(tables).toContain('users');
      expect(tables).toContain('orders');
    });

    it('readTable returns specific table', async () => {
      await driver.connect();
      const d = driver as unknown as { readTable(n: string): Promise<unknown> };
      const t = await d.readTable('users') as { name: string } | null;
      expect(t).not.toBeNull();
      expect(t!.name).toBe('users');
    });

    it('readTable returns null for unknown table', async () => {
      await driver.connect();
      const d = driver as unknown as { readTable(n: string): Promise<unknown> };
      const t = await d.readTable('nonexistent');
      expect(t).toBeNull();
    });

    it('transaction executes callback and returns value', async () => {
      await driver.connect();
      const result = await driver.transaction(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('transaction throws TransactionError on callback error', async () => {
      await driver.connect();
      await expect(
        driver.transaction(() => { throw new Error('boom'); }),
      ).rejects.toThrow('Transaction rolled back');
    });

    it('transaction throws when not connected', async () => {
      await expect(
        driver.transaction(() => Promise.resolve()),
      ).rejects.toThrow(ConnectionFailedError);
    });
  });
}
