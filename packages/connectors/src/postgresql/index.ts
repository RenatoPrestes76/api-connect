/**
 * @seltriva/connectors/postgresql
 * PostgreSQL Enterprise Connector — public API
 */

// ─── Connector ────────────────────────────────────────────────────────────────
export {
  PostgreSQLConnector,
  createPostgreSQLConnector,
  POSTGRESQL_CONNECTOR_DESCRIPTOR,
} from './connector.js';

// ─── Components (for DI / testing) ───────────────────────────────────────────
export { PostgreSQLConnectionManager } from './connection.js';
export { QueryRunner, CircuitBreaker, DEFAULT_QUERY_RUNNER_OPTIONS } from './query-runner.js';
export { SchemaDiscovery } from './schema-discovery.js';
export { TableStatisticsEngine } from './statistics.js';
export { MetadataAggregator } from './metadata.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  PostgreSQLConnectorConfig,
  SSLConfig,
  DiscoveryFilter,
  ColumnMetadata,
  PrimaryKeyMetadata,
  ForeignKeyMetadata,
  IndexMetadata,
  TableMetadata,
  ViewMetadata,
  MaterializedViewMetadata,
  SequenceMetadata,
  EnumMetadata,
  ExtensionMetadata,
  SchemaMetadata,
  TableStatistics,
  ColumnProfile,
  TableProfile,
  PostgreSQLIntrospectionReport,
  QueryRunnerOptions,
  CircuitBreakerOptions,
} from './types.js';

export type {
  SchemaName,
  TableName,
  ColumnName,
  IndexName,
  ConstraintName,
  SequenceName,
  ViewName,
} from './types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
  ReadOnlyViolationError,
  ConnectionError,
  QueryTimeoutError,
  CircuitOpenError,
  DiscoveryError,
  quoteIdent,
  qualifiedName,
} from './types.js';
