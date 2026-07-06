/**
 * @seltriva/schema-intelligence/adapters
 * Connector Adapters — bridge from @seltriva/connectors metadata to SIE SchemaSource
 *
 * These adapters translate the connector world (SourceMetadata, ApiEndpointMetadata, etc.)
 * into the SIE world (SchemaSource → RawSchema → CanonicalSchema).
 *
 * No connector library is imported here — adapters operate on plain data shapes
 * to avoid a circular package dependency. Callers pass the metadata in.
 */

import type { SchemaSourceType, SchemaCategory, SqlDialect } from '../models/index';
import type { SchemaSource, RawSchema, ParseContext, SIEResult } from '../core/index';

// ─── Base Adapter ─────────────────────────────────────────────────────────

/**
 * Generic adapter interface — converts connector-provided metadata to a SchemaSource
 */
export interface ConnectorSchemaAdapter<TMetadata = unknown> {
  readonly sourceType: SchemaSourceType;
  readonly category: SchemaCategory;

  /**
   * Convert connector metadata to a SchemaSource ready for the SIE pipeline
   */
  adapt(metadata: TMetadata, adapterContext: AdapterContext): SIEResult<SchemaSource>;

  /**
   * Convert connector metadata directly to a RawSchema (bypasses SchemaSource step)
   */
  toRawSchema(metadata: TMetadata, adapterContext: AdapterContext): SIEResult<RawSchema>;

  /**
   * Build the ParseContext appropriate for this connector type
   */
  buildParseContext(adapterContext: AdapterContext): ParseContext;

  /**
   * Check if this adapter can handle the given metadata shape
   */
  canAdapt(metadata: unknown): boolean;
}

export interface AdapterContext {
  readonly connectorId: string;
  readonly connectorSubtype: string;
  readonly dialect?: string;
  readonly version?: string;
  readonly options?: Record<string, unknown>;
}

// ─── Database Schema Adapter ──────────────────────────────────────────────

/**
 * Converts relational database metadata (tables, columns, indexes, FKs)
 * into SchemaSource and RawSchema.
 */
export interface DatabaseSchemaAdapter extends ConnectorSchemaAdapter<DatabaseMetadataInput> {
  readonly sourceType: 'connector-metadata';
  readonly category: 'relational';

  /** Adapt a single table to a RawEntity */
  adaptTable(table: TableMetadataInput, dialect: SqlDialect): SIEResult<import('../core/index').RawEntity>;

  /** Adapt a column to a RawField */
  adaptColumn(column: ColumnMetadataInput): SIEResult<import('../core/index').RawField>;
}

export interface DatabaseMetadataInput {
  readonly connectorId: string;
  readonly databaseName: string;
  readonly schemas?: SchemaMetadataInput[];
  readonly serverVersion?: string;
  readonly dialect: SqlDialect;
}

export interface SchemaMetadataInput {
  readonly name: string;
  readonly tables: TableMetadataInput[];
}

export interface TableMetadataInput {
  readonly name: string;
  readonly schema?: string;
  readonly type: string;
  readonly columns: ColumnMetadataInput[];
  readonly primaryKey?: string[];
  readonly foreignKeys?: ForeignKeyMetadataInput[];
  readonly indexes?: IndexMetadataInput[];
  readonly comment?: string;
  readonly estimatedRows?: number;
}

export interface ColumnMetadataInput {
  readonly name: string;
  readonly position: number;
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly defaultValue?: unknown;
  readonly isPrimaryKey?: boolean;
  readonly isAutoIncrement?: boolean;
  readonly isUnique?: boolean;
  readonly comment?: string;
}

export interface ForeignKeyMetadataInput {
  readonly name?: string;
  readonly columns: string[];
  readonly referencedTable: string;
  readonly referencedSchema?: string;
  readonly referencedColumns: string[];
  readonly onDelete?: string;
  readonly onUpdate?: string;
}

export interface IndexMetadataInput {
  readonly name: string;
  readonly columns: string[];
  readonly isUnique: boolean;
  readonly isPrimary?: boolean;
  readonly type?: string;
}

// ─── API Schema Adapter ───────────────────────────────────────────────────

/**
 * Converts REST / GraphQL / gRPC API metadata into SchemaSource.
 */
export interface ApiSchemaAdapter extends ConnectorSchemaAdapter<ApiMetadataInput> {
  readonly sourceType: 'openapi' | 'graphql-sdl' | 'connector-metadata';
  readonly category: 'api';

  /** Adapt a single endpoint to a RawEntity */
  adaptEndpoint(endpoint: EndpointMetadataInput): SIEResult<import('../core/index').RawEntity>;
}

export interface ApiMetadataInput {
  readonly connectorId: string;
  readonly apiName: string;
  readonly apiVersion?: string;
  readonly baseUrl?: string;
  readonly format: 'rest' | 'graphql' | 'grpc' | 'soap';
  readonly endpoints?: EndpointMetadataInput[];
  readonly schemas?: Record<string, SchemaDefinitionInput>;
  readonly spec?: string | Record<string, unknown>;
}

export interface EndpointMetadataInput {
  readonly path: string;
  readonly method?: string;
  readonly operationId?: string;
  readonly parameters?: ParameterMetadataInput[];
  readonly requestSchema?: SchemaDefinitionInput;
  readonly responseSchema?: SchemaDefinitionInput;
  readonly description?: string;
  readonly tags?: string[];
}

export interface ParameterMetadataInput {
  readonly name: string;
  readonly location?: string;
  readonly type: string;
  readonly required: boolean;
  readonly description?: string;
}

export interface SchemaDefinitionInput {
  readonly name?: string;
  readonly type: string;
  readonly properties?: Record<string, SchemaDefinitionInput>;
  readonly required?: string[];
  readonly items?: SchemaDefinitionInput;
  readonly ref?: string;
  readonly description?: string;
}

// ─── File Schema Adapter ──────────────────────────────────────────────────

/**
 * Converts file structure metadata (CSV headers, XML XSD, etc.) into SchemaSource.
 */
export interface FileSchemaAdapter extends ConnectorSchemaAdapter<FileMetadataInput> {
  readonly sourceType: 'csv-header' | 'xml-xsd' | 'json-schema' | 'connector-metadata';
  readonly category: 'file';
}

export interface FileMetadataInput {
  readonly connectorId: string;
  readonly filePath: string;
  readonly format: 'csv' | 'excel' | 'xml' | 'json' | 'txt' | 'ods';
  readonly encoding?: string;
  readonly columns?: FileColumnInput[];
  readonly sampleRows?: number;
  readonly totalRows?: number;
}

export interface FileColumnInput {
  readonly name: string;
  readonly index: number;
  readonly inferredType?: string;
  readonly nullable?: boolean;
  readonly maxLength?: number;
}

// ─── Cloud Storage Schema Adapter ─────────────────────────────────────────

/**
 * Converts cloud storage bucket/object metadata into SchemaSource.
 * Useful for understanding what data structures live in a storage container.
 */
export interface CloudSchemaAdapter extends ConnectorSchemaAdapter<CloudMetadataInput> {
  readonly sourceType: 'connector-metadata';
  readonly category: 'file';
}

export interface CloudMetadataInput {
  readonly connectorId: string;
  readonly provider: 's3' | 'azure-blob' | 'gcs' | 'supabase-storage';
  readonly bucket: string;
  readonly prefix?: string;
  readonly objects?: CloudObjectMetadataInput[];
  readonly detectedFormats?: string[];
}

export interface CloudObjectMetadataInput {
  readonly key: string;
  readonly size: number;
  readonly contentType?: string;
  readonly format?: string;
}

// ─── Adapter Registry ─────────────────────────────────────────────────────

/**
 * Map-based registry for all connector adapters.
 */
export interface ConnectorAdapterRegistry {
  register(connectorSubtype: string, adapter: ConnectorSchemaAdapter): void;
  get(connectorSubtype: string): ConnectorSchemaAdapter | null;
  has(connectorSubtype: string): boolean;
  getAll(): ConnectorSchemaAdapter[];
  getSupportedSubtypes(): string[];

  /**
   * Auto-detect the best adapter for a given metadata object
   */
  detect(metadata: unknown): ConnectorSchemaAdapter | null;
}
