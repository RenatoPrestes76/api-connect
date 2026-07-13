import { SqlAdapter } from '../adapters/sql-adapter.js';
import type { DriverConfig } from '../connection/connection-options.js';
import type { DatabaseHealth } from '../health/database-health.js';
import type { DatabaseSchema, SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import type { Query } from '../query/query-types.js';
import { ConnectionFailedError, QueryError } from '../errors/database-errors.js';
import { OracleSchemaReader } from '../schema/readers/oracle.reader.js';
import type { DbQueryClient, DbRow } from '../schema/readers/db-client.js';

export interface OracleConnection {
  execute(sql: string, params?: unknown[]): Promise<{ rows: DbRow[] }>;
  close(): Promise<void>;
}

export interface OraclePool {
  getConnection(): Promise<OracleConnection>;
  close(): Promise<void>;
  connectionsOpen: number;
  connectionsInUse: number;
}

export type OraclePoolFactory = (config: {
  user: string;
  password: string;
  connectString: string;
  poolMax?: number;
}) => Promise<OraclePool>;

async function defaultOracleFactory(cfg: {
  user: string;
  password: string;
  connectString: string;
  poolMax?: number;
}): Promise<OraclePool> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — oracledb bundles its own types but dynamic import confuses tsc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oracledb = (await import('oracledb' as any)).default;
  return oracledb.createPool(cfg) as unknown as OraclePool;
}

function poolToDbClient(pool: OraclePool): DbQueryClient {
  return {
    async query(sql, params = []) {
      const conn = await pool.getConnection();
      try {
        const result = await conn.execute(sql, params);
        return { rows: result.rows };
      } finally {
        await conn.close();
      }
    },
  };
}

export class OracleDriver extends SqlAdapter implements SchemaReader {
  static readonly VERSION = 'Oracle Database 21c';

  private _pool: OraclePool | null = null;

  constructor(
    config: DriverConfig,
    private readonly _poolFactory: OraclePoolFactory = defaultOracleFactory,
    private readonly _schemaReaderFactory?: (client: DbQueryClient, owner: string) => SchemaReader
  ) {
    super(config, 'oracle');
  }

  async connect(): Promise<void> {
    const connectString = `${this._config.host}:${this._config.port}/${this._config.database}`;
    this._pool = await this._poolFactory({
      user: this._config.username,
      password: this._config.password,
      connectString,
      poolMax: 10,
    });
    // Verify by getting and releasing a connection
    const conn = await this._pool.getConnection();
    await conn.close();
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this._pool?.close();
    this._pool = null;
    this._isConnected = false;
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to Oracle');
    try {
      const { sql, params } = this._renderer.render(query);
      const conn = await this._pool.getConnection();
      try {
        const result = await conn.execute(sql, params);
        return result.rows as T[];
      } finally {
        await conn.close();
      }
    } catch (err) {
      if (err instanceof ConnectionFailedError) throw err;
      throw new QueryError(
        err instanceof Error ? err.message : String(err),
        err instanceof Error ? err : undefined
      );
    }
  }

  async health(): Promise<DatabaseHealth> {
    if (!this._pool) {
      return {
        connected: false,
        latency: 0,
        databaseVersion: '',
        activeConnections: 0,
        poolUsage: 0,
        status: 'unhealthy',
      };
    }
    try {
      const start = Date.now();
      const conn = await this._pool.getConnection();
      const result = await conn.execute('SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1');
      await conn.close();
      const latency = Date.now() - start;
      const open = this._pool.connectionsOpen;
      const inUse = this._pool.connectionsInUse;
      return {
        connected: true,
        latency,
        databaseVersion: String((result.rows[0] as { BANNER?: string })?.BANNER ?? ''),
        activeConnections: inUse,
        poolUsage: open > 0 ? inUse / open : 0,
        status: 'healthy',
      };
    } catch {
      return {
        connected: false,
        latency: 0,
        databaseVersion: '',
        activeConnections: 0,
        poolUsage: 0,
        status: 'unhealthy',
      };
    }
  }

  async schema(): Promise<DatabaseSchema> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to Oracle');
    const owner = this._config.username.toUpperCase();
    const client = poolToDbClient(this._pool);
    const reader = this._schemaReaderFactory
      ? this._schemaReaderFactory(client, owner)
      : new OracleSchemaReader(client, owner);
    return reader.readSchema();
  }

  async readSchema(): Promise<DatabaseSchema> {
    return this.schema();
  }
  async listTables(): Promise<string[]> {
    return (await this.schema()).tables.map((t) => t.name);
  }
  async readTable(name: string): Promise<Table | null> {
    return (await this.schema()).tables.find((t) => t.name === name) ?? null;
  }
}
