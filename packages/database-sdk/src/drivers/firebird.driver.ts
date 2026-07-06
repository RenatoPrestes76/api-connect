import { SqlAdapter } from '../adapters/sql-adapter.js';
import type { DriverConfig } from '../connection/connection-options.js';
import type { DatabaseHealth } from '../health/database-health.js';
import type { DatabaseSchema, SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import type { Query } from '../query/query-types.js';
import { ConnectionFailedError, QueryError } from '../errors/database-errors.js';
import { FirebirdSchemaReader } from '../schema/readers/firebird.reader.js';
import type { DbQueryClient, DbRow } from '../schema/readers/db-client.js';

export interface FirebirdConnection {
  query(sql: string, params: unknown[], callback: (err: Error | null, rows: DbRow[]) => void): void;
  detach(callback?: (err: Error | null) => void): void;
}

export interface FirebirdDatabase {
  attach(options: FirebirdOptions, callback: (err: Error | null, db: FirebirdConnection) => void): void;
  detach(callback?: (err: Error | null) => void): void;
}

export interface FirebirdOptions {
  host:     string;
  port:     number;
  database: string;
  user:     string;
  password: string;
}

export type FirebirdFactory = (options: FirebirdOptions) => Promise<FirebirdConnection>;

async function defaultFirebirdFactory(options: FirebirdOptions): Promise<FirebirdConnection> {
  const Firebird = (await import('node-firebird')).default as {
    attach(opts: FirebirdOptions, cb: (err: Error | null, db: FirebirdConnection) => void): void;
  };
  return new Promise<FirebirdConnection>((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function connectionToDbClient(conn: FirebirdConnection): DbQueryClient {
  return {
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
    },
  };
}

export class FirebirdDriver extends SqlAdapter implements SchemaReader {
  static readonly VERSION = 'Firebird 5.0';

  private _conn: FirebirdConnection | null = null;

  constructor(
    config: DriverConfig,
    private readonly _connFactory: FirebirdFactory = defaultFirebirdFactory,
    private readonly _schemaReaderFactory?: (client: DbQueryClient) => SchemaReader,
  ) {
    super(config, 'firebird');
  }

  async connect(): Promise<void> {
    this._conn = await this._connFactory({
      host:     this._config.host,
      port:     this._config.port,
      database: this._config.database,
      user:     this._config.username,
      password: this._config.password,
    });
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (this._conn) this._conn.detach(() => resolve());
      else resolve();
    });
    this._conn        = null;
    this._isConnected = false;
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (!this._conn) throw new ConnectionFailedError('Not connected to Firebird');
    try {
      const { sql, params } = this._renderer.render(query);
      return await new Promise<T[]>((resolve, reject) => {
        this._conn!.query(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as T[]);
        });
      });
    } catch (err) {
      if (err instanceof ConnectionFailedError) throw err;
      throw new QueryError(
        err instanceof Error ? err.message : String(err),
        err instanceof Error ? err : undefined,
      );
    }
  }

  async health(): Promise<DatabaseHealth> {
    if (!this._conn) {
      return { connected: false, latency: 0, databaseVersion: '', activeConnections: 0, poolUsage: 0, status: 'unhealthy' };
    }
    try {
      const start = Date.now();
      await new Promise<void>((resolve, reject) => {
        this._conn!.query('SELECT 1 FROM RDB$DATABASE', [], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return {
        connected:         true,
        latency:           Date.now() - start,
        databaseVersion:   FirebirdDriver.VERSION,
        activeConnections: 1,
        poolUsage:         0,
        status:            'healthy',
      };
    } catch {
      return { connected: false, latency: 0, databaseVersion: '', activeConnections: 0, poolUsage: 0, status: 'unhealthy' };
    }
  }

  async schema(): Promise<DatabaseSchema> {
    if (!this._conn) throw new ConnectionFailedError('Not connected to Firebird');
    const client = connectionToDbClient(this._conn);
    const reader = this._schemaReaderFactory
      ? this._schemaReaderFactory(client)
      : new FirebirdSchemaReader(client);
    return reader.readSchema();
  }

  async readSchema():            Promise<DatabaseSchema> { return this.schema(); }
  async listTables():            Promise<string[]>        { return (await this.schema()).tables.map((t) => t.name); }
  async readTable(name: string): Promise<Table | null> {
    return (await this.schema()).tables.find((t) => t.name === name) ?? null;
  }
}
