/**
 * PostgreSQL Connector — types, interfaces, branded types, error classes.
 *
 * All identifiers use the Branded pattern to prevent accidental mixing
 * of schema names with table names, column names with index names, etc.
 */
import type { ConnectorConfig } from '../core/index.js';

// ─── Branded Types ────────────────────────────────────────────────────────────

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type SchemaName      = Brand<string, 'SchemaName'>;
export type TableName       = Brand<string, 'TableName'>;
export type ColumnName      = Brand<string, 'ColumnName'>;
export type IndexName       = Brand<string, 'IndexName'>;
export type ConstraintName  = Brand<string, 'ConstraintName'>;
export type SequenceName    = Brand<string, 'SequenceName'>;
export type ViewName        = Brand<string, 'ViewName'>;

export const asSchemaName     = (s: string): SchemaName     => s as SchemaName;
export const asTableName      = (s: string): TableName      => s as TableName;
export const asColumnName     = (s: string): ColumnName     => s as ColumnName;
export const asIndexName      = (s: string): IndexName      => s as IndexName;
export const asConstraintName = (s: string): ConstraintName => s as ConstraintName;
export const asSequenceName   = (s: string): SequenceName   => s as SequenceName;
export const asViewName       = (s: string): ViewName       => s as ViewName;

// ─── SSL Configuration ────────────────────────────────────────────────────────

export interface SSLConfig {
  readonly rejectUnauthorized?: boolean;
  readonly ca?: string;
  readonly cert?: string;
  readonly key?: string;
}

// ─── Discovery Filters ────────────────────────────────────────────────────────

export interface DiscoveryFilter {
  /**
   * Only discover these schemas (glob patterns supported: 'public', 'vendas*').
   * If empty, all non-system schemas are included.
   */
  readonly includeSchemas?: string[];
  /**
   * Always exclude these schemas, even if included above.
   */
  readonly excludeSchemas?: string[];
  /**
   * Only include tables matching these patterns (glob: '*produto*').
   * If empty, all tables are included.
   */
  readonly includeTables?: string[];
  /**
   * Always exclude these tables.
   */
  readonly excludeTables?: string[];
  /**
   * Number of rows to sample during data profiling. Default: 100.
   */
  readonly sampleSize?: number;
  /**
   * Whether to run data profiling at all. Default: true.
   */
  readonly enableProfiling?: boolean;
}

// ─── Connector Config ─────────────────────────────────────────────────────────

export interface PostgreSQLConnectorConfig extends ConnectorConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl?: boolean | SSLConfig;
  readonly applicationName?: string;
  readonly statementTimeoutMs?: number;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
  readonly maxPoolSize?: number;
  readonly keepAlive?: boolean;
  readonly keepAliveInitialDelayMs?: number;
  readonly discovery?: DiscoveryFilter;
}

// ─── Column Metadata ──────────────────────────────────────────────────────────

export interface ColumnMetadata {
  readonly name: ColumnName;
  readonly ordinalPosition: number;
  readonly dataType: string;
  readonly userDefinedType: string | null;
  readonly isNullable: boolean;
  readonly defaultValue: string | null;
  readonly characterMaxLength: number | null;
  readonly numericPrecision: number | null;
  readonly numericScale: number | null;
  readonly datetimePrecision: number | null;
  readonly isIdentity: boolean;
  readonly identityGeneration: 'ALWAYS' | 'BY DEFAULT' | null;
  readonly isGenerated: boolean;
  readonly generationExpression: string | null;
  readonly comment: string | null;
}

// ─── Constraint Metadata ──────────────────────────────────────────────────────

export interface PrimaryKeyMetadata {
  readonly constraintName: ConstraintName;
  readonly columns: ColumnName[];
}

export interface ForeignKeyMetadata {
  readonly constraintName: ConstraintName;
  readonly columns: ColumnName[];
  readonly referencedSchema: SchemaName;
  readonly referencedTable: TableName;
  readonly referencedColumns: ColumnName[];
  readonly updateRule: string;
  readonly deleteRule: string;
}

// ─── Index Metadata ───────────────────────────────────────────────────────────

export interface IndexMetadata {
  readonly name: IndexName;
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly indexType: string;
  readonly columns: string[];
  readonly definition: string;
}

// ─── Table Metadata ───────────────────────────────────────────────────────────

export interface TableMetadata {
  readonly schema: SchemaName;
  readonly name: TableName;
  readonly comment: string | null;
  readonly columns: ColumnMetadata[];
  readonly primaryKey: PrimaryKeyMetadata | null;
  readonly foreignKeys: ForeignKeyMetadata[];
  readonly indexes: IndexMetadata[];
  readonly isPartitioned: boolean;
}

// ─── View / Materialized View ─────────────────────────────────────────────────

export interface ViewMetadata {
  readonly schema: SchemaName;
  readonly name: ViewName;
  readonly definition: string;
  readonly comment: string | null;
  readonly columns: ColumnMetadata[];
}

export interface MaterializedViewMetadata {
  readonly schema: SchemaName;
  readonly name: ViewName;
  readonly definition: string;
  readonly hasData: boolean;
  readonly comment: string | null;
  readonly columns: ColumnMetadata[];
}

// ─── Sequence Metadata ────────────────────────────────────────────────────────

export interface SequenceMetadata {
  readonly schema: SchemaName;
  readonly name: SequenceName;
  readonly dataType: string;
  readonly start: string;
  readonly increment: string;
  readonly minimum: string;
  readonly maximum: string;
  readonly cycle: boolean;
}

// ─── Enum Metadata ────────────────────────────────────────────────────────────

export interface EnumMetadata {
  readonly schema: SchemaName;
  readonly name: string;
  readonly values: string[];
}

// ─── Extension Metadata ───────────────────────────────────────────────────────

export interface ExtensionMetadata {
  readonly name: string;
  readonly version: string;
}

// ─── Schema Metadata ──────────────────────────────────────────────────────────

export interface SchemaMetadata {
  readonly name: SchemaName;
  readonly owner: string;
  readonly tables: TableMetadata[];
  readonly views: ViewMetadata[];
  readonly materializedViews: MaterializedViewMetadata[];
  readonly sequences: SequenceMetadata[];
  readonly enums: EnumMetadata[];
}

// ─── Table Statistics ─────────────────────────────────────────────────────────

export interface TableStatistics {
  readonly schema: SchemaName;
  readonly table: TableName;
  readonly estimatedRows: number;
  readonly liveTuples: number;
  readonly deadTuples: number;
  readonly tableSizeBytes: number;
  readonly indexesSizeBytes: number;
  readonly totalSizeBytes: number;
  readonly tableSizeHuman: string;
  readonly totalSizeHuman: string;
  readonly lastVacuum: Date | null;
  readonly lastAutoVacuum: Date | null;
  readonly lastAnalyze: Date | null;
  readonly lastAutoAnalyze: Date | null;
}

// ─── Column Profile (data profiling) ─────────────────────────────────────────

export interface ColumnProfile {
  readonly columnName: ColumnName;
  readonly totalRows: number;
  readonly nonNullCount: number;
  readonly nullPercent: number;
  readonly distinctCount: number;
  readonly distinctPercent: number;
  readonly avgLength: number | null;
  readonly sampleValues: string[];
}

export interface TableProfile {
  readonly schema: SchemaName;
  readonly table: TableName;
  readonly sampleSize: number;
  readonly actualRowsSampled: number;
  readonly columns: ColumnProfile[];
}

// ─── Introspection Report ─────────────────────────────────────────────────────

export interface PostgreSQLIntrospectionReport {
  readonly connectedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly serverVersion: string;
  readonly encoding: string;
  readonly collation: string;
  readonly timezone: string;
  readonly extensions: ExtensionMetadata[];
  readonly schemasDiscovered: number;
  readonly tablesDiscovered: number;
  readonly viewsDiscovered: number;
  readonly totalEstimatedRows: number;
  readonly schemas: SchemaMetadata[];
  readonly statistics: Record<string, TableStatistics>;
  readonly profiles: Record<string, TableProfile>;
  readonly warnings: string[];
}

// ─── Query Runner Options ─────────────────────────────────────────────────────

export interface QueryRunnerOptions {
  readonly statementTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly circuitBreaker: CircuitBreakerOptions;
}

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly openDurationMs: number;
  readonly successThreshold: number;
}

// ─── Error Classes ────────────────────────────────────────────────────────────

export class ReadOnlyViolationError extends Error {
  constructor(statement: string) {
    super(
      `Read-only violation: statement attempts to modify data — "${statement.trim().slice(0, 80)}…" ` +
      'The PostgreSQL connector operates exclusively in READ ONLY mode.',
    );
    this.name = 'ReadOnlyViolationError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class QueryTimeoutError extends Error {
  constructor(public readonly sql: string, public readonly timeoutMs: number) {
    super(`Query timed out after ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly openSince: Date) {
    super(`Circuit breaker is OPEN since ${openSince.toISOString()} — requests are failing fast`);
    this.name = 'CircuitOpenError';
  }
}

export class DiscoveryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

// ─── Identifier Quoting ───────────────────────────────────────────────────────

/**
 * Safely double-quote a PostgreSQL identifier.
 * Prevents SQL injection from schema/table/column names.
 */
export function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

/**
 * Qualify a schema.table identifier, both safely quoted.
 */
export function qualifiedName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}
