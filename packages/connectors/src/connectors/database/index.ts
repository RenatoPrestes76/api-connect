/**
 * @seltriva/connectors/connectors/database
 * Database Connector interfaces — Relational and Document databases
 */

import type { Connector, ConnectorConfig, ConnectorResult } from '../../core/index';

// ─── Base Database Connector ──────────────────────────────────────────────

/**
 * Extended base for all database connectors
 */
export interface DatabaseConnector extends Connector {
  readonly type: 'database';

  /** Execute a raw query and return typed rows */
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<ConnectorResult<QueryResult<TRow>>>;

  /** Execute a statement that does not return rows (INSERT/UPDATE/DELETE/DDL) */
  execute(sql: string, params?: unknown[]): Promise<ConnectorResult<ExecuteResult>>;

  /** Begin a transaction */
  beginTransaction(): Promise<ConnectorResult<Transaction>>;

  /** Get the database-native type system */
  getTypeMap(): TypeMap;
}

export interface QueryResult<TRow = Record<string, unknown>> {
  readonly rows: TRow[];
  readonly rowCount: number;
  readonly fields: QueryField[];
  readonly durationMs: number;
  readonly command: string;
}

export interface QueryField {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: boolean;
}

export interface ExecuteResult {
  readonly rowsAffected: number;
  readonly lastInsertId?: string | number;
  readonly durationMs: number;
  readonly command: string;
}

export interface Transaction {
  readonly id: string;
  commit(): Promise<ConnectorResult<void>>;
  rollback(): Promise<ConnectorResult<void>>;
  savepoint(name: string): Promise<ConnectorResult<void>>;
  rollbackTo(savepoint: string): Promise<ConnectorResult<void>>;
  isActive(): boolean;
}

export interface TypeMap {
  readonly nativeToUniversal: Record<string, string>;
  readonly universalToNative: Record<string, string>;
}

// ─── Relational Base ──────────────────────────────────────────────────────

/**
 * Shared interface for all SQL/relational database connectors
 */
export interface RelationalConnector extends DatabaseConnector {
  /** Prepare a parameterized statement for reuse */
  prepare(sql: string): Promise<ConnectorResult<PreparedStatement>>;

  /** Execute multiple statements in a batch */
  batch(statements: BatchStatement[]): Promise<ConnectorResult<ExecuteResult[]>>;

  /** Copy data in bulk (COPY for PG, BULK INSERT for SQL Server, etc.) */
  bulkInsert(
    table: string,
    columns: string[],
    rows: unknown[][]
  ): Promise<ConnectorResult<ExecuteResult>>;
}

export interface PreparedStatement {
  readonly sql: string;
  execute<TRow = Record<string, unknown>>(params?: unknown[]): Promise<ConnectorResult<QueryResult<TRow>>>;
  close(): Promise<void>;
}

export interface BatchStatement {
  readonly sql: string;
  readonly params?: unknown[];
}

// ─── Relational Config ────────────────────────────────────────────────────

export interface RelationalConnectorConfig extends ConnectorConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly schema?: string;
  readonly ssl?: SslDatabaseConfig;
  readonly pool?: DatabasePoolConfig;
}

export interface SslDatabaseConfig {
  readonly enabled: boolean;
  readonly rejectUnauthorized?: boolean;
  readonly ca?: string;
  readonly cert?: string;
  readonly key?: string;
}

export interface DatabasePoolConfig {
  readonly min: number;
  readonly max: number;
  readonly idleTimeoutMs?: number;
  readonly acquireTimeoutMs?: number;
  readonly statementTimeout?: number;
  readonly queryTimeout?: number;
}

// ─── PostgreSQL ────────────────────────────────────────────────────────────

export interface PostgreSQLConnector extends RelationalConnector {
  readonly subtype: 'postgresql';

  /** NOTIFY/LISTEN support */
  listen(channel: string, handler: (payload: string) => void): Promise<ConnectorResult<void>>;
  notify(channel: string, payload?: string): Promise<ConnectorResult<void>>;
  unlisten(channel: string): Promise<ConnectorResult<void>>;

  /** COPY FROM/TO for high-performance data movement */
  copyFrom(source: PostgreSQLCopySource): Promise<ConnectorResult<ExecuteResult>>;
  copyTo(target: PostgreSQLCopyTarget): Promise<ConnectorResult<ReadableStreamLike>>;

  /** Large object support */
  createLargeObject(size?: number): Promise<ConnectorResult<LargeObject>>;
}

export interface PostgreSQLConnectorConfig extends RelationalConnectorConfig {
  readonly applicationName?: string;
  readonly searchPath?: string[];
  readonly timezone?: string;
  readonly sslMode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
}

export interface PostgreSQLCopySource {
  readonly table?: string;
  readonly query?: string;
  readonly format: 'csv' | 'binary' | 'text';
  readonly delimiter?: string;
  readonly header?: boolean;
}

export interface PostgreSQLCopyTarget {
  readonly table: string;
  readonly format: 'csv' | 'binary' | 'text';
  readonly delimiter?: string;
}

export interface LargeObject {
  readonly oid: number;
  read(length: number): Promise<Buffer>;
  write(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export interface ReadableStreamLike {
  on(event: 'data', handler: (chunk: Buffer) => void): this;
  on(event: 'end', handler: () => void): this;
  on(event: 'error', handler: (err: Error) => void): this;
}

// ─── SQL Server ────────────────────────────────────────────────────────────

export interface SQLServerConnector extends RelationalConnector {
  readonly subtype: 'sqlserver';

  /** Execute a stored procedure */
  executeStoredProcedure(
    procedure: string,
    params?: SQLServerParam[]
  ): Promise<ConnectorResult<StoredProcedureResult>>;

  /** Linked server query */
  queryLinkedServer(server: string, sql: string): Promise<ConnectorResult<QueryResult>>;

  /** Bulk copy (BCP) */
  bulkCopy(
    table: string,
    data: Record<string, unknown>[]
  ): Promise<ConnectorResult<ExecuteResult>>;
}

export interface SQLServerConnectorConfig extends RelationalConnectorConfig {
  readonly instanceName?: string;
  readonly domain?: string;
  readonly encrypt?: boolean;
  readonly trustServerCertificate?: boolean;
  readonly enableArithAbort?: boolean;
}

export interface SQLServerParam {
  readonly name: string;
  readonly type: string;
  readonly value: unknown;
  readonly direction?: 'input' | 'output' | 'inputOutput';
}

export interface StoredProcedureResult {
  readonly recordsets: QueryResult[];
  readonly output: Record<string, unknown>;
  readonly returnValue: number;
}

// ─── Oracle ────────────────────────────────────────────────────────────────

export interface OracleConnector extends RelationalConnector {
  readonly subtype: 'oracle';

  /** Execute PL/SQL block */
  executePLSQL(plsql: string, binds?: Record<string, unknown>): Promise<ConnectorResult<OraclePLSQLResult>>;

  /** Oracle-specific LOB handling */
  createClob(content: string): Promise<ConnectorResult<unknown>>;
  createBlob(content: Buffer): Promise<ConnectorResult<unknown>>;
}

export interface OracleConnectorConfig extends RelationalConnectorConfig {
  readonly serviceName?: string;
  readonly sid?: string;
  readonly tns?: string;
  readonly connectString?: string;
  readonly edition?: string;
  readonly stmtCacheSize?: number;
}

export interface OraclePLSQLResult {
  readonly outBinds: Record<string, unknown>;
  readonly implicitResults?: QueryResult[];
  readonly rowsAffected?: number;
}

// ─── Firebird ────────────────────────────────────────────────────────────

export interface FirebirdConnector extends RelationalConnector {
  readonly subtype: 'firebird';

  /** Firebird-specific EXECUTE BLOCK */
  executeBlock(block: string, params?: unknown[]): Promise<ConnectorResult<QueryResult>>;

  /** Generator (sequence) value */
  nextGeneratorValue(generator: string): Promise<ConnectorResult<number>>;
}

export interface FirebirdConnectorConfig extends RelationalConnectorConfig {
  readonly role?: string;
  readonly charSet?: string;
  readonly pageSize?: number;
}

// ─── MySQL ────────────────────────────────────────────────────────────────

export interface MySQLConnector extends RelationalConnector {
  readonly subtype: 'mysql';

  /** Multi-statement execution */
  multiQuery(sql: string): Promise<ConnectorResult<QueryResult[]>>;

  /** MySQL-specific LOAD DATA INFILE */
  loadDataInFile(
    file: string,
    table: string,
    options?: MySQLLoadDataOptions
  ): Promise<ConnectorResult<ExecuteResult>>;
}

export interface MySQLConnectorConfig extends RelationalConnectorConfig {
  readonly multipleStatements?: boolean;
  readonly charset?: string;
  readonly timezone?: string;
  readonly flags?: string[];
  readonly authPlugins?: Record<string, unknown>;
}

export interface MySQLLoadDataOptions {
  readonly delimiter?: string;
  readonly enclosedBy?: string;
  readonly lineTerminator?: string;
  readonly ignoreLines?: number;
  readonly columns?: string[];
  readonly setClause?: string;
}

// ─── MariaDB ──────────────────────────────────────────────────────────────

/**
 * MariaDB shares the MySQL interface but has distinct capabilities
 * (Columnstore, Galera Cluster, JSON functions, etc.)
 */
export interface MariaDBConnector extends MySQLConnector {
  readonly subtype: 'mariadb';

  /** Galera Cluster: check if wsrep is ready */
  isGaleraReady(): Promise<ConnectorResult<boolean>>;

  /** Spider storage engine cross-server queries */
  spiderQuery(node: string, sql: string): Promise<ConnectorResult<QueryResult>>;
}

export interface MariaDBConnectorConfig extends MySQLConnectorConfig {
  readonly collation?: string;
  readonly connectTimeout?: number;
  readonly socketPath?: string;
}

// ─── SQLite ───────────────────────────────────────────────────────────────

export interface SQLiteConnector extends RelationalConnector {
  readonly subtype: 'sqlite';

  /** SQLite-specific WAL checkpoint */
  walCheckpoint(mode?: 'passive' | 'full' | 'restart' | 'truncate'): Promise<ConnectorResult<SQLiteCheckpointResult>>;

  /** Vacuum (defragment) the database file */
  vacuum(): Promise<ConnectorResult<void>>;

  /** Run in-memory mode status */
  isInMemory(): boolean;
}

export interface SQLiteConnectorConfig extends ConnectorConfig {
  readonly filePath: string;
  readonly readonly?: boolean;
  readonly fileMustExist?: boolean;
  readonly timeout?: number;
  readonly verbose?: boolean;
  readonly pragmas?: Record<string, unknown>;
}

export interface SQLiteCheckpointResult {
  readonly pagesWritten: number;
  readonly pagesMoved: number;
  readonly logSize: number;
  readonly framesCheckpointed: number;
}

// ─── MongoDB ──────────────────────────────────────────────────────────────

/**
 * Document connector — NOT relational; uses collection/document model
 */
export interface MongoDBConnector extends DatabaseConnector {
  readonly subtype: 'mongodb';

  /** Find documents in a collection */
  find(
    collection: string,
    filter?: MongoFilter,
    options?: MongoFindOptions
  ): Promise<ConnectorResult<MongoCursor>>;

  /** Insert one document */
  insertOne(collection: string, document: Record<string, unknown>): Promise<ConnectorResult<MongoInsertResult>>;

  /** Insert many documents */
  insertMany(collection: string, documents: Record<string, unknown>[]): Promise<ConnectorResult<MongoInsertManyResult>>;

  /** Update documents matching filter */
  updateMany(
    collection: string,
    filter: MongoFilter,
    update: MongoUpdate
  ): Promise<ConnectorResult<MongoUpdateResult>>;

  /** Delete documents matching filter */
  deleteMany(
    collection: string,
    filter: MongoFilter
  ): Promise<ConnectorResult<MongoDeleteResult>>;

  /** Run an aggregation pipeline */
  aggregate(
    collection: string,
    pipeline: MongoAggregationStage[]
  ): Promise<ConnectorResult<MongoCursor>>;

  /** Create a change stream (realtime CDC) */
  watch(
    collection: string,
    pipeline?: MongoAggregationStage[],
    options?: MongoWatchOptions
  ): Promise<ConnectorResult<MongoChangeStream>>;
}

export interface MongoDBConnectorConfig extends ConnectorConfig {
  readonly uri: string;
  readonly database: string;
  readonly authSource?: string;
  readonly replicaSet?: string;
  readonly readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  readonly writeConcern?: MongoWriteConcern;
  readonly tls?: boolean;
  readonly tlsCAFile?: string;
}

export type MongoFilter = Record<string, unknown>;
export type MongoUpdate = Record<string, unknown>;
export type MongoAggregationStage = Record<string, unknown>;

export interface MongoFindOptions {
  readonly projection?: Record<string, 0 | 1>;
  readonly sort?: Record<string, 1 | -1>;
  readonly limit?: number;
  readonly skip?: number;
  readonly hint?: string | Record<string, unknown>;
}

export interface MongoCursor {
  readonly documents: Record<string, unknown>[];
  readonly count: number;
  hasNext(): boolean;
  next(): Record<string, unknown> | null;
  toArray(): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

export interface MongoInsertResult {
  readonly insertedId: string;
  readonly acknowledged: boolean;
}

export interface MongoInsertManyResult {
  readonly insertedIds: string[];
  readonly insertedCount: number;
  readonly acknowledged: boolean;
}

export interface MongoUpdateResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly upsertedId?: string;
  readonly acknowledged: boolean;
}

export interface MongoDeleteResult {
  readonly deletedCount: number;
  readonly acknowledged: boolean;
}

export interface MongoChangeStream {
  on(event: 'change', handler: (change: MongoChangeEvent) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  close(): Promise<void>;
}

export interface MongoChangeEvent {
  readonly operationType: 'insert' | 'update' | 'replace' | 'delete' | 'drop' | 'rename';
  readonly fullDocument?: Record<string, unknown>;
  readonly documentKey: { _id: unknown };
  readonly updateDescription?: {
    readonly updatedFields: Record<string, unknown>;
    readonly removedFields: string[];
  };
  readonly ns: { db: string; coll: string };
}

export interface MongoWatchOptions {
  readonly fullDocument?: 'default' | 'updateLookup';
  readonly batchSize?: number;
  readonly resumeAfter?: unknown;
  readonly startAtOperationTime?: Date;
}

export interface MongoWriteConcern {
  readonly w: number | 'majority';
  readonly j?: boolean;
  readonly wtimeout?: number;
}
