// ─── Adapter interfaces ────────────────────────────────────────────────────────
export type { DatabaseAdapter, DatabaseHealth, HealthStatus } from './adapters/database-adapter.js';
export { SqlAdapter } from './adapters/sql-adapter.js';

// ─── Health ────────────────────────────────────────────────────────────────────
export type { HealthStatus as DbHealthStatus, DatabaseHealth as DbHealth } from './health/database-health.js';

// ─── Query AST ────────────────────────────────────────────────────────────────
export type {
  Query, SelectQuery, InsertQuery, UpdateQuery, DeleteQuery, RawQuery,
  Filter, SimpleFilter, CompoundFilter,
  FilterOperator, SimpleFilterOperator,
  OrderBy, Join,
} from './query/query-types.js';

// ─── Individual query type files (spec-compliant exports) ─────────────────────
export type { SelectQuery as SelectQueryType } from './query/select-query.js';
export type { InsertQuery as InsertQueryType } from './query/insert-query.js';
export type { UpdateQuery as UpdateQueryType } from './query/update-query.js';
export type { DeleteQuery as DeleteQueryType } from './query/delete-query.js';
export type { RawQuery    as RawQueryType    } from './query/raw-query.js';

// ─── Filter operators & expressions ──────────────────────────────────────────
export type { FilterOperator as FilterOp, SimpleFilterOperator as SimpleFilterOp } from './filters/operators.js';
export {
  equals, notEquals,
  greaterThan, greaterThanOrEqual,
  lessThan, lessThanOrEqual,
  between, like, inList, isNull, isNotNull,
  and, or,
} from './filters/expressions.js';

// ─── Query Builder ────────────────────────────────────────────────────────────
export { QueryBuilder } from './query/query-builder.js';

// ─── SQL Renderer ─────────────────────────────────────────────────────────────
export type { RenderedQuery, DialectName } from './query/sql-renderer.js';
export { SqlRenderer } from './query/sql-renderer.js';

// ─── SQL Dialects ─────────────────────────────────────────────────────────────
export type { SqlDialect }                    from './dialects/dialect.js';
export { PostgresDialect, postgresDialect }   from './dialects/postgres.dialect.js';
export { MySQLDialect, mysqlDialect }         from './dialects/mysql.dialect.js';
export { SQLServerDialect, sqlServerDialect } from './dialects/sqlserver.dialect.js';
export { OracleDialect, oracleDialect }       from './dialects/oracle.dialect.js';
export { FirebirdDialect, firebirdDialect }   from './dialects/firebird.dialect.js';

// ─── Schema types ─────────────────────────────────────────────────────────────
export type { Column }                        from './schema/column.js';
export type { RelationType, Relation }        from './schema/relation.js';
export type { Table, PrimaryKey, ForeignKey, Index } from './schema/table.js';
export type { DatabaseSchema }               from './schema/metadata.js';
export type { SchemaReader }                 from './schema/schema-reader.js';

// ─── Schema readers ───────────────────────────────────────────────────────────
export type { DbRow, DbQueryClient }         from './schema/readers/db-client.js';
export { PostgresSchemaReader }              from './schema/readers/postgres.reader.js';
export { MySQLSchemaReader }                 from './schema/readers/mysql.reader.js';
export { SQLServerSchemaReader }             from './schema/readers/sqlserver.reader.js';
export { OracleSchemaReader }                from './schema/readers/oracle.reader.js';
export { FirebirdSchemaReader }              from './schema/readers/firebird.reader.js';

// ─── Metadata cache ───────────────────────────────────────────────────────────
export type { MetadataCacheOptions }         from './schema/metadata-cache.js';
export { MetadataCache }                     from './schema/metadata-cache.js';

// ─── Connection ───────────────────────────────────────────────────────────────
export type { DriverConfig, ConnectionOptions } from './connection/connection-options.js';
export type { RetryPolicy, BackoffStrategy }    from './connection/retry-policy.js';
export { DEFAULT_RETRY_POLICY, computeDelay }   from './connection/retry-policy.js';
export type { ConnectionManagerOptions }        from './connection/connection-manager.js';
export { ConnectionManager }                    from './connection/connection-manager.js';
export { ConnectionPool }                       from './connection/pool.js';

// ─── Drivers ──────────────────────────────────────────────────────────────────
export { PostgresDriver }  from './drivers/postgres.driver.js';
export { MySqlDriver }     from './drivers/mysql.driver.js';
export { SqlServerDriver } from './drivers/sqlserver.driver.js';
export { OracleDriver }    from './drivers/oracle.driver.js';
export { FirebirdDriver }  from './drivers/firebird.driver.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
  DatabaseError,
  ConnectionFailedError,
  AuthenticationError,
  TimeoutError,
  QueryError,
  TransactionError,
  SchemaError,
  DriverNotSupportedError,
} from './errors/database-errors.js';
