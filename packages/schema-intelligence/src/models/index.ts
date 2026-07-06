/**
 * @seltriva/schema-intelligence/models
 * Shared vocabulary — branded IDs, enumerations, primitive types used across all SIE modules
 */

// ─── Branded IDs ──────────────────────────────────────────────────────────

export type SchemaId        = string & { readonly __brand: 'SchemaId' };
export type EntityId        = string & { readonly __brand: 'EntityId' };
export type FieldId         = string & { readonly __brand: 'FieldId' };
export type RelationshipId  = string & { readonly __brand: 'RelationshipId' };
export type VersionId       = string & { readonly __brand: 'VersionId' };
export type FingerprintId   = string & { readonly __brand: 'FingerprintId' };
export type PatternId       = string & { readonly __brand: 'PatternId' };

// ─── Schema Source Type ───────────────────────────────────────────────────

/**
 * The format/protocol the schema was read from
 */
export type SchemaSourceType =
  | 'sql-ddl'
  | 'openapi'
  | 'graphql-sdl'
  | 'json-schema'
  | 'xml-xsd'
  | 'csv-header'
  | 'mongodb-sample'
  | 'avro'
  | 'protobuf'
  | 'connector-metadata'
  | 'unknown';

// ─── Schema Category ──────────────────────────────────────────────────────

/**
 * High-level category of a schema
 */
export type SchemaCategory =
  | 'relational'
  | 'document'
  | 'graph'
  | 'key-value'
  | 'columnar'
  | 'api'
  | 'file'
  | 'event'
  | 'unknown';

// ─── Canonical Data Types ─────────────────────────────────────────────────

/**
 * Universal type vocabulary — every native type maps to one of these
 */
export type CanonicalDataKind =
  | 'string'
  | 'text'
  | 'char'
  | 'integer'
  | 'bigint'
  | 'smallint'
  | 'decimal'
  | 'float'
  | 'double'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'timestamp'
  | 'timestamp-tz'
  | 'interval'
  | 'binary'
  | 'blob'
  | 'json'
  | 'jsonb'
  | 'xml'
  | 'array'
  | 'object'
  | 'uuid'
  | 'enum'
  | 'null'
  | 'unknown';

// ─── Naming Conventions ───────────────────────────────────────────────────

export type NamingConvention =
  | 'snake_case'
  | 'camelCase'
  | 'PascalCase'
  | 'SCREAMING_SNAKE_CASE'
  | 'kebab-case'
  | 'mixed'
  | 'unknown';

// ─── Field Roles ──────────────────────────────────────────────────────────

/**
 * Inferred semantic role of a field — derived from name, type, and constraints
 */
export type FieldRole =
  | 'primary-key'
  | 'foreign-key'
  | 'surrogate-key'
  | 'natural-key'
  | 'created-at'
  | 'updated-at'
  | 'deleted-at'
  | 'tenant-id'
  | 'version'
  | 'status'
  | 'name'
  | 'code'
  | 'description'
  | 'amount'
  | 'quantity'
  | 'boolean-flag'
  | 'audit'
  | 'sort-order'
  | 'metadata'
  | 'unknown';

// ─── Entity Kind ──────────────────────────────────────────────────────────

export type EntityKind =
  | 'table'
  | 'view'
  | 'materialized-view'
  | 'collection'
  | 'resource'
  | 'structure'
  | 'topic'
  | 'type'
  | 'interface'
  | 'input-type'
  | 'enum-type'
  | 'unknown';

// ─── Relationship Kind ────────────────────────────────────────────────────

export type RelationshipKind =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many'
  | 'self-referential'
  | 'polymorphic'
  | 'composition'
  | 'aggregation'
  | 'unknown';

// ─── Constraint Kind ──────────────────────────────────────────────────────

export type ConstraintKind =
  | 'primary-key'
  | 'unique'
  | 'foreign-key'
  | 'check'
  | 'not-null'
  | 'default'
  | 'index'
  | 'exclusion'
  | 'unknown';

// ─── Cardinality ──────────────────────────────────────────────────────────

export type Cardinality = '0..1' | '1' | '0..*' | '1..*';

// ─── Change Severity ──────────────────────────────────────────────────────

export type ChangeSeverity = 'breaking' | 'non-breaking' | 'informational';

// ─── Confidence ───────────────────────────────────────────────────────────

/** A confidence score from 0.0 (no confidence) to 1.0 (certain) */
export type ConfidenceScore = number;

// ─── Similarity Score ─────────────────────────────────────────────────────

/** A similarity score from 0.0 (completely different) to 1.0 (identical) */
export type SimilarityScore = number;

// ─── SQL Dialect ──────────────────────────────────────────────────────────

export type SqlDialect =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'sqlserver'
  | 'oracle'
  | 'sqlite'
  | 'firebird'
  | 'ansi'
  | 'unknown';

// ─── API Spec Version ─────────────────────────────────────────────────────

export type OpenApiVersion = '2.0' | '3.0' | '3.1';
export type GraphQLVersion = 'june2018' | 'october2021' | 'unknown';
