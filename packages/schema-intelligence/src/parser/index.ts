/**
 * @seltriva/schema-intelligence/parser
 * Schema Parsers — convert raw format strings into RawSchema (pre-normalization)
 *
 * One parser per source format. All parsers produce the same RawSchema output.
 * The normalizer then converts RawSchema → CanonicalSchema.
 */

import type { SchemaSourceType, SqlDialect, OpenApiVersion, GraphQLVersion } from '../models/index';
import type { SchemaSource, ParseContext, RawSchema, SIEResult } from '../core/index';

// ─── Base Parser ──────────────────────────────────────────────────────────

/**
 * Generic parser interface. Every format-specific parser implements this.
 */
export interface SchemaParser<TOptions = Record<string, unknown>> {
  /** The source format this parser handles */
  readonly sourceType: SchemaSourceType;

  /** Human-readable parser name */
  readonly name: string;

  /** Parser version — used to track regressions */
  readonly version: string;

  /**
   * Parse raw input into an intermediate RawSchema.
   * Must not throw — all errors returned in SIEResult.
   */
  parse(
    source: SchemaSource,
    context: ParseContext,
    options?: TOptions
  ): Promise<SIEResult<RawSchema>>;

  /**
   * Perform a quick syntax check without full parsing.
   * Faster than parse() when full normalization is not needed.
   */
  validate(raw: string | Record<string, unknown>): SIEResult<ParserValidationResult>;

  /**
   * Detect whether this parser can handle the given input.
   * Returns confidence 0–1.
   */
  detect(raw: string | Record<string, unknown>): DetectionResult;
}

export interface ParserValidationResult {
  readonly isValid: boolean;
  readonly errors: ParserValidationError[];
  readonly warnings: ParserValidationWarning[];
}

export interface ParserValidationError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly code?: string;
}

export interface ParserValidationWarning {
  readonly message: string;
  readonly line?: number;
  readonly code?: string;
}

export interface DetectionResult {
  readonly canHandle: boolean;
  readonly confidence: number;
  readonly evidence: string[];
}

// ─── SQL DDL Parser ───────────────────────────────────────────────────────

export interface SqlDdlParser extends SchemaParser<SqlParserOptions> {
  readonly sourceType: 'sql-ddl';

  /**
   * Parse a single CREATE TABLE statement into a single raw entity
   */
  parseStatement(sql: string, dialect: SqlDialect): SIEResult<SqlStatementResult>;

  /**
   * Extract the dialect from a DDL file (best-effort heuristic)
   */
  detectDialect(sql: string): SqlDialect;
}

export interface SqlParserOptions {
  readonly dialect?: SqlDialect;
  readonly schema?: string;
  readonly parseViews?: boolean;
  readonly parseProcedures?: boolean;
  readonly parseTriggers?: boolean;
  readonly parseIndexes?: boolean;
  readonly includeSystemTables?: boolean;
}

export interface SqlStatementResult {
  readonly statementType: 'CREATE TABLE' | 'CREATE VIEW' | 'CREATE INDEX' | 'ALTER TABLE' | 'OTHER';
  readonly entityName?: string;
  readonly fields: SqlFieldDescriptor[];
  readonly constraints: SqlConstraintDescriptor[];
}

export interface SqlFieldDescriptor {
  readonly name: string;
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly defaultValue?: string;
  readonly isPrimaryKey: boolean;
  readonly isAutoIncrement: boolean;
  readonly isUnique: boolean;
  readonly references?: SqlReferenceDescriptor;
  readonly comment?: string;
}

export interface SqlConstraintDescriptor {
  readonly type: 'PRIMARY KEY' | 'UNIQUE' | 'FOREIGN KEY' | 'CHECK' | 'INDEX';
  readonly name?: string;
  readonly fields: string[];
  readonly references?: SqlReferenceDescriptor;
  readonly expression?: string;
}

export interface SqlReferenceDescriptor {
  readonly table: string;
  readonly schema?: string;
  readonly fields: string[];
  readonly onDelete?: string;
  readonly onUpdate?: string;
}

// ─── OpenAPI Parser ───────────────────────────────────────────────────────

export interface OpenApiParser extends SchemaParser<OpenApiParserOptions> {
  readonly sourceType: 'openapi';

  /**
   * Detect OpenAPI/Swagger version from document
   */
  detectVersion(document: Record<string, unknown>): OpenApiVersion;

  /**
   * Extract only the schema definitions (components/schemas) without endpoints
   */
  parseSchemas(document: Record<string, unknown>): SIEResult<OpenApiSchemaMap>;

  /**
   * Resolve all $ref references in the document
   */
  dereferenceDocument(
    document: Record<string, unknown>
  ): Promise<SIEResult<Record<string, unknown>>>;
}

export interface OpenApiParserOptions {
  readonly version?: OpenApiVersion;
  readonly parseEndpoints?: boolean;
  readonly parseSchemas?: boolean;
  readonly resolveRefs?: boolean;
  readonly excludePaths?: string[];
  readonly includeTags?: string[];
}

export interface OpenApiSchemaMap {
  readonly schemas: Record<string, OpenApiSchemaDefinition>;
  readonly count: number;
}

export interface OpenApiSchemaDefinition {
  readonly name: string;
  readonly type: string;
  readonly properties?: Record<string, unknown>;
  readonly required?: string[];
  readonly description?: string;
  readonly allOf?: unknown[];
  readonly oneOf?: unknown[];
  readonly anyOf?: unknown[];
}

// ─── GraphQL Schema Parser ────────────────────────────────────────────────

export interface GraphQLSchemaParser extends SchemaParser<GraphQLParserOptions> {
  readonly sourceType: 'graphql-sdl';

  /**
   * Parse only type definitions (no queries/mutations/subscriptions)
   */
  parseTypes(sdl: string): SIEResult<GraphQLTypeMap>;

  /**
   * Extract relationships from directives and naming conventions
   */
  inferRelationships(typeMap: GraphQLTypeMap): GraphQLInferredRelationship[];

  /**
   * Detect the SDL version / supported features
   */
  detectVersion(sdl: string): GraphQLVersion;
}

export interface GraphQLParserOptions {
  readonly parseQueries?: boolean;
  readonly parseMutations?: boolean;
  readonly parseSubscriptions?: boolean;
  readonly parseInterfaces?: boolean;
  readonly parseInputTypes?: boolean;
  readonly parseEnums?: boolean;
  readonly parseUnions?: boolean;
  readonly relationshipDirective?: string;
}

export interface GraphQLTypeMap {
  readonly types: GraphQLTypeDef[];
  readonly interfaces: GraphQLTypeDef[];
  readonly inputs: GraphQLTypeDef[];
  readonly enums: GraphQLEnumDef[];
  readonly unions: GraphQLUnionDef[];
  readonly scalars: string[];
}

export interface GraphQLTypeDef {
  readonly name: string;
  readonly fields: GraphQLFieldDef[];
  readonly implements?: string[];
  readonly description?: string;
  readonly directives?: GraphQLDirectiveDef[];
}

export interface GraphQLFieldDef {
  readonly name: string;
  readonly type: string;
  readonly isRequired: boolean;
  readonly isList: boolean;
  readonly isListItemRequired: boolean;
  readonly args?: GraphQLArgDef[];
  readonly description?: string;
  readonly directives?: GraphQLDirectiveDef[];
}

export interface GraphQLArgDef {
  readonly name: string;
  readonly type: string;
  readonly defaultValue?: unknown;
  readonly description?: string;
}

export interface GraphQLEnumDef {
  readonly name: string;
  readonly values: Array<{ name: string; description?: string; isDeprecated?: boolean }>;
  readonly description?: string;
}

export interface GraphQLUnionDef {
  readonly name: string;
  readonly types: string[];
  readonly description?: string;
}

export interface GraphQLDirectiveDef {
  readonly name: string;
  readonly args?: Record<string, unknown>;
}

export interface GraphQLInferredRelationship {
  readonly fromType: string;
  readonly fromField: string;
  readonly toType: string;
  readonly confidence: number;
  readonly basis: 'field-name' | 'directive' | 'type-name' | 'convention';
}

// ─── CSV Parser ───────────────────────────────────────────────────────────

export interface CsvSchemaParser extends SchemaParser<CsvParserOptions> {
  readonly sourceType: 'csv-header';

  /**
   * Parse only the header row without loading the full file
   */
  parseHeader(headerLine: string, options?: CsvParserOptions): SIEResult<CsvHeaderResult>;

  /**
   * Infer field types from a sample of data rows
   */
  inferTypes(
    headers: string[],
    sampleRows: string[][],
    options?: CsvTypeInferenceOptions
  ): SIEResult<CsvTypeInferenceResult>;
}

export interface CsvParserOptions {
  readonly delimiter?: string;
  readonly quoteChar?: string;
  readonly hasHeader?: boolean;
  readonly sampleRows?: number;
  readonly encoding?: string;
  readonly dateFormats?: string[];
}

export interface CsvHeaderResult {
  readonly columns: CsvColumnDescriptor[];
  readonly delimiter: string;
  readonly quoteChar: string;
}

export interface CsvColumnDescriptor {
  readonly name: string;
  readonly originalName: string;
  readonly index: number;
}

export interface CsvTypeInferenceOptions {
  readonly dateFormats?: string[];
  readonly nullValues?: string[];
  readonly minConfidence?: number;
  readonly sampleSize?: number;
}

export interface CsvTypeInferenceResult {
  readonly columns: CsvInferredColumn[];
  readonly sampleRowCount: number;
}

export interface CsvInferredColumn {
  readonly name: string;
  readonly inferredType: string;
  readonly confidence: number;
  readonly nullable: boolean;
  readonly maxLength?: number;
  readonly samples: string[];
}

// ─── JSON Schema Parser ───────────────────────────────────────────────────

export interface JsonSchemaParser extends SchemaParser<JsonParserOptions> {
  readonly sourceType: 'json-schema';

  /**
   * Infer a JSON Schema from a concrete JSON document (sample data)
   */
  inferFromDocument(doc: Record<string, unknown>): SIEResult<RawSchema>;

  /**
   * Detect JSON Schema draft version
   */
  detectDraft(schema: Record<string, unknown>): JsonSchemaDraft;

  /**
   * Flatten all $defs / $ref into inline definitions
   */
  flatten(schema: Record<string, unknown>): SIEResult<Record<string, unknown>>;
}

export interface JsonParserOptions {
  readonly resolveRefs?: boolean;
  readonly draft?: JsonSchemaDraft;
  readonly rootEntity?: string;
  readonly maxDepth?: number;
}

export type JsonSchemaDraft =
  | 'draft-04'
  | 'draft-06'
  | 'draft-07'
  | 'draft-2019-09'
  | 'draft-2020-12'
  | 'unknown';

// ─── XML / XSD Parser ─────────────────────────────────────────────────────

export interface XmlSchemaParser extends SchemaParser<XmlParserOptions> {
  readonly sourceType: 'xml-xsd';

  /**
   * Parse an XSD schema definition
   */
  parseXsd(xsd: string): Promise<SIEResult<RawSchema>>;

  /**
   * Infer structure from a concrete XML document (sample data)
   */
  inferFromDocument(xml: string): Promise<SIEResult<RawSchema>>;

  /**
   * Resolve xs:import and xs:include references
   */
  resolveImports(xsd: string, resolver: XsdImportResolver): Promise<SIEResult<string>>;
}

export interface XmlParserOptions {
  readonly namespace?: string;
  readonly targetNamespace?: string;
  readonly resolveImports?: boolean;
  readonly includeComplexTypes?: boolean;
  readonly includeSimpleTypes?: boolean;
  readonly maxDepth?: number;
}

export interface XsdImportResolver {
  resolve(schemaLocation: string, namespace?: string): Promise<string>;
}

// ─── Parser Registry ──────────────────────────────────────────────────────

/**
 * Dynamic Map-based parser registry — no switch, no if chains.
 */
export interface SchemaParserRegistry {
  register(parser: SchemaParser): void;
  unregister(sourceType: SchemaSourceType): void;
  get(sourceType: SchemaSourceType): SchemaParser | null;
  getAll(): SchemaParser[];
  has(sourceType: SchemaSourceType): boolean;

  /**
   * Auto-detect the best parser for the given input
   */
  detect(raw: string | Record<string, unknown>): SchemaParser | null;

  /**
   * Return detection results from all registered parsers (for diagnostics)
   */
  detectAll(raw: string | Record<string, unknown>): ParserDetectionRanking[];
}

export interface ParserDetectionRanking {
  readonly sourceType: SchemaSourceType;
  readonly confidence: number;
  readonly evidence: string[];
}
