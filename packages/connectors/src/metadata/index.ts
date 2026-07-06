/**
 * @seltriva/connectors/metadata
 * Metadata Engine — rich schema and structure information from any connector
 */

// ─── Metadata Engine ─────────────────────────────────────────────────────────

/**
 * The primary interface for retrieving metadata from a connected source
 */
export interface MetadataEngine {
  /**
   * Retrieve full source metadata (databases, schemas, entities)
   */
  getMetadata(options?: MetadataOptions): Promise<SourceMetadata>;

  /**
   * Retrieve metadata for a specific entity
   */
  getEntityMetadata(entityPath: EntityPath): Promise<EntityMetadata>;

  /**
   * Retrieve relationships for an entity
   */
  getRelationships(entityPath: EntityPath): Promise<RelationshipMetadata[]>;

  /**
   * Check if a metadata path exists in the source
   */
  exists(path: EntityPath): Promise<boolean>;

  /**
   * Refresh cached metadata from the source
   */
  refresh(options?: MetadataOptions): Promise<SourceMetadata>;

  /**
   * Compare two versions of metadata and return the diff
   */
  diff(previous: SourceMetadata, current: SourceMetadata): MetadataDiff;
}

export interface MetadataOptions {
  readonly includeSystemObjects?: boolean;
  readonly includeDependencies?: boolean;
  readonly schemas?: string[];
  readonly entities?: string[];
  readonly depth?: 'shallow' | 'standard' | 'deep';
}

export interface EntityPath {
  readonly catalog?: string;
  readonly schema?: string;
  readonly entity: string;
}

// ─── Source Metadata ─────────────────────────────────────────────────────────

/**
 * Top-level metadata snapshot for the entire connected source
 */
export interface SourceMetadata {
  readonly connectorId: string;
  readonly sourceType: string;
  readonly sourceName: string;
  readonly serverVersion?: string;
  readonly databases?: DatabaseMetadata[];
  readonly schemas?: SchemaMetadata[];
  readonly entities?: EntityMetadata[];
  readonly apiEndpoints?: ApiEndpointMetadata[];
  readonly fileStructures?: FileStructureMetadata[];
  readonly retrievedAt: Date;
  readonly checksum?: string;
}

// ─── Database Metadata ────────────────────────────────────────────────────────

export interface DatabaseMetadata {
  readonly name: string;
  readonly charset?: string;
  readonly collation?: string;
  readonly owner?: string;
  readonly size?: number;
  readonly schemas: SchemaMetadata[];
  readonly options?: Record<string, unknown>;
}

// ─── Schema Metadata ──────────────────────────────────────────────────────────

export interface SchemaMetadata {
  readonly name: string;
  readonly owner?: string;
  readonly tables: TableMetadata[];
  readonly views: ViewMetadata[];
  readonly procedures: ProcedureMetadata[];
  readonly triggers: TriggerMetadata[];
  readonly functions?: FunctionMetadata[];
  readonly sequences?: SequenceMetadata[];
}

// ─── Table Metadata ───────────────────────────────────────────────────────────

export interface TableMetadata {
  readonly name: string;
  readonly schema?: string;
  readonly catalog?: string;
  readonly type: 'table' | 'view' | 'materialized-view' | 'temporary' | 'external';
  readonly columns: ColumnMetadata[];
  readonly indexes: IndexMetadata[];
  readonly constraints: ConstraintMetadata[];
  readonly foreignKeys: ForeignKeyMetadata[];
  readonly estimatedRows?: number;
  readonly sizeBytes?: number;
  readonly comment?: string;
  readonly options?: Record<string, unknown>;
}

// ─── Column Metadata ──────────────────────────────────────────────────────────

export interface ColumnMetadata {
  readonly name: string;
  readonly position: number;
  readonly dataType: string;
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly isAutoIncrement: boolean;
  readonly isGenerated: boolean;
  readonly defaultValue?: unknown;
  readonly maxLength?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly charset?: string;
  readonly collation?: string;
  readonly comment?: string;
  readonly enumValues?: string[];
  readonly options?: Record<string, unknown>;
}

// ─── Index Metadata ───────────────────────────────────────────────────────────

export interface IndexMetadata {
  readonly name: string;
  readonly table: string;
  readonly columns: IndexColumnMetadata[];
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'fulltext' | 'spatial' | string;
  readonly isPartial?: boolean;
  readonly predicate?: string;
  readonly comment?: string;
}

export interface IndexColumnMetadata {
  readonly name: string;
  readonly position: number;
  readonly direction: 'asc' | 'desc';
  readonly nullsFirst?: boolean;
}

// ─── Constraint Metadata ──────────────────────────────────────────────────────

export interface ConstraintMetadata {
  readonly name: string;
  readonly type: 'primary-key' | 'unique' | 'check' | 'not-null' | 'default' | 'exclusion';
  readonly columns: string[];
  readonly expression?: string;
  readonly deferrable?: boolean;
  readonly deferred?: boolean;
}

// ─── Foreign Key Metadata ─────────────────────────────────────────────────────

export interface ForeignKeyMetadata {
  readonly name: string;
  readonly columns: string[];
  readonly referencedTable: string;
  readonly referencedSchema?: string;
  readonly referencedColumns: string[];
  readonly onDelete: 'cascade' | 'restrict' | 'set-null' | 'set-default' | 'no-action';
  readonly onUpdate: 'cascade' | 'restrict' | 'set-null' | 'set-default' | 'no-action';
  readonly deferrable?: boolean;
}

// ─── Relationship Metadata ────────────────────────────────────────────────────

export interface RelationshipMetadata {
  readonly name: string;
  readonly type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  readonly sourceEntity: string;
  readonly sourceColumns: string[];
  readonly targetEntity: string;
  readonly targetColumns: string[];
  readonly joinTable?: string;
  readonly bidirectional: boolean;
  readonly eager?: boolean;
}

// ─── Entity Metadata ──────────────────────────────────────────────────────────

/**
 * Generic entity descriptor — used by both relational and document stores
 */
export interface EntityMetadata {
  readonly name: string;
  readonly path: string;
  readonly type: 'table' | 'collection' | 'document' | 'endpoint' | 'file' | 'queue' | 'topic';
  readonly fields: FieldMetadata[];
  readonly relationships?: RelationshipMetadata[];
  readonly indexes?: IndexMetadata[];
  readonly constraints?: ConstraintMetadata[];
  readonly estimatedCount?: number;
  readonly comment?: string;
  readonly options?: Record<string, unknown>;
}

// ─── Field Metadata ───────────────────────────────────────────────────────────

/**
 * Generic field descriptor — covers columns, document fields, API params, file columns
 */
export interface FieldMetadata {
  readonly name: string;
  readonly path?: string;
  readonly dataType: string;
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly required: boolean;
  readonly isPrimaryKey?: boolean;
  readonly isIndexed?: boolean;
  readonly defaultValue?: unknown;
  readonly maxLength?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly nested?: FieldMetadata[];
  readonly enumValues?: string[];
  readonly format?: string;
  readonly example?: unknown;
  readonly comment?: string;
}

// ─── View Metadata ────────────────────────────────────────────────────────────

export interface ViewMetadata {
  readonly name: string;
  readonly schema?: string;
  readonly definition: string;
  readonly columns: ColumnMetadata[];
  readonly isMaterialized: boolean;
  readonly comment?: string;
}

// ─── Procedure / Function / Trigger ──────────────────────────────────────────

export interface ProcedureMetadata {
  readonly name: string;
  readonly schema?: string;
  readonly parameters: ParameterMetadata[];
  readonly returnType?: string;
  readonly language: string;
  readonly definition?: string;
  readonly comment?: string;
}

export interface FunctionMetadata extends ProcedureMetadata {
  readonly isAggregate: boolean;
  readonly isWindow: boolean;
  readonly isStrict: boolean;
}

export interface TriggerMetadata {
  readonly name: string;
  readonly table: string;
  readonly schema?: string;
  readonly event: ('insert' | 'update' | 'delete' | 'truncate')[];
  readonly timing: 'before' | 'after' | 'instead-of';
  readonly orientation: 'row' | 'statement';
  readonly condition?: string;
  readonly procedure: string;
  readonly enabled: boolean;
}

export interface SequenceMetadata {
  readonly name: string;
  readonly schema?: string;
  readonly startValue: number;
  readonly increment: number;
  readonly minValue: number;
  readonly maxValue: number;
  readonly isCyclic: boolean;
  readonly currentValue?: number;
}

export interface ParameterMetadata {
  readonly name: string;
  readonly position: number;
  readonly direction: 'in' | 'out' | 'inout';
  readonly dataType: string;
  readonly defaultValue?: unknown;
  readonly nullable: boolean;
}

// ─── API Endpoint Metadata ────────────────────────────────────────────────────

export interface ApiEndpointMetadata {
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  readonly operationId?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly tags?: string[];
  readonly parameters: ApiParameterMetadata[];
  readonly requestBody?: ApiBodyMetadata;
  readonly responses: ApiResponseMetadata[];
  readonly security?: ApiSecurityMetadata[];
  readonly deprecated?: boolean;
}

export interface ApiParameterMetadata {
  readonly name: string;
  readonly in: 'path' | 'query' | 'header' | 'cookie';
  readonly required: boolean;
  readonly dataType: string;
  readonly description?: string;
  readonly example?: unknown;
  readonly schema?: Record<string, unknown>;
}

export interface ApiBodyMetadata {
  readonly contentType: string;
  readonly required: boolean;
  readonly schema?: Record<string, unknown>;
  readonly fields?: FieldMetadata[];
}

export interface ApiResponseMetadata {
  readonly statusCode: number;
  readonly description: string;
  readonly contentType?: string;
  readonly schema?: Record<string, unknown>;
}

export interface ApiSecurityMetadata {
  readonly scheme: string;
  readonly scopes?: string[];
}

// ─── File Structure Metadata ──────────────────────────────────────────────────

export interface FileStructureMetadata {
  readonly path: string;
  readonly format: 'csv' | 'excel' | 'xml' | 'json' | 'txt' | 'ods' | string;
  readonly encoding?: string;
  readonly delimiter?: string;
  readonly hasHeader?: boolean;
  readonly fields: FieldMetadata[];
  readonly sampleRows?: number;
  readonly totalRows?: number;
  readonly sizeBytes?: number;
}

// ─── Metadata Diff ────────────────────────────────────────────────────────────

export interface MetadataDiff {
  readonly addedEntities: string[];
  readonly removedEntities: string[];
  readonly modifiedEntities: EntityDiff[];
  readonly hasChanges: boolean;
  readonly generatedAt: Date;
}

export interface EntityDiff {
  readonly entity: string;
  readonly addedFields: string[];
  readonly removedFields: string[];
  readonly modifiedFields: FieldDiff[];
  readonly addedIndexes: string[];
  readonly removedIndexes: string[];
}

export interface FieldDiff {
  readonly field: string;
  readonly changes: Record<string, { before: unknown; after: unknown }>;
}
