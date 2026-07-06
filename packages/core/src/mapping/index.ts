/**
 * @seltriva/core/mapping
 * Data mapping and transformation interfaces
 */

// ─── Object Mapper ─────────────────────────────────────────────────────────

/**
 * Maps objects between types using registered mapping definitions
 */
export interface Mapper {
  map<TSource, TTarget>(source: TSource, targetType: new () => TTarget): TTarget;
  mapArray<TSource, TTarget>(sources: TSource[], targetType: new () => TTarget): TTarget[];
  registerMapping<TSource, TTarget>(
    sourceType: new () => TSource,
    targetType: new () => TTarget,
    mappingDefinition: MappingDefinition<TSource, TTarget>
  ): void;
  registerObjectMapping<
    TSource extends Record<string, unknown>,
    TTarget extends Record<string, unknown>
  >(
    sourceName: string,
    targetName: string,
    mappingDefinition: MappingDefinition<TSource, TTarget>
  ): void;
  hasMapping(sourceName: string, targetName: string): boolean;
  getMapping(sourceName: string, targetName: string): MappingDefinition<unknown, unknown> | null;
}

/**
 * Full mapping specification between two types
 */
export interface MappingDefinition<TSource, TTarget> {
  readonly mappings: PropertyMapping<TSource, TTarget>[];
  readonly transform?: (source: TSource, target: TTarget) => TTarget;
  readonly condition?: (source: TSource) => boolean;
  readonly type: 'field' | 'object' | 'array' | 'custom';
}

/**
 * Maps a single property from source to target (with optional transformation)
 */
export interface PropertyMapping<TSource, TTarget> {
  readonly sourceProperty: keyof TSource;
  readonly targetProperty: keyof TTarget;
  readonly transformer?: (value: unknown) => unknown;
  readonly optional?: boolean;
  readonly condition?: (value: unknown) => boolean;
}

// ─── Schema Mapper ─────────────────────────────────────────────────────────

/**
 * Maps arbitrary data against a named schema definition (ERP field mapping)
 */
export interface SchemaMapper {
  map(source: unknown, schema: SchemaDefinition): unknown;
  getSchema(typeName: string): SchemaDefinition | null;
  registerSchema(typeName: string, schema: SchemaDefinition): void;
  validate(source: unknown, schema: SchemaDefinition): MappingValidationResult;
}

export interface SchemaDefinition {
  readonly name: string;
  readonly version: string;
  readonly fields: FieldDefinition[];
  readonly transforms?: FieldTransform[];
  readonly validations?: FieldValidation[];
}

export interface FieldDefinition {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly default?: unknown;
  readonly nested?: SchemaDefinition;
}

export interface FieldTransform {
  readonly field: string;
  readonly transformer: (value: unknown) => unknown;
  readonly condition?: (value: unknown) => boolean;
}

export interface FieldValidation {
  readonly field: string;
  readonly validator: (value: unknown) => boolean;
  readonly message: string;
}

export interface MappingValidationResult {
  readonly isValid: boolean;
  readonly errors?: Record<string, string[]>;
}

// ─── Transformation Pipeline ────────────────────────────────────────────────

/**
 * Composable pipeline of sequential transformation steps
 */
export interface TransformationPipeline {
  addStep(step: TransformationStep): TransformationPipeline;
  execute(data: unknown): Promise<unknown>;
  getSteps(): TransformationStep[];
  clear(): void;
}

export interface TransformationStep {
  readonly name: string;
  execute(data: unknown): Promise<unknown>;
  reverse?(data: unknown): Promise<unknown>;
  readonly priority?: number;
}

// ─── Field Mapping Registry ────────────────────────────────────────────────

/**
 * Stores canonical field mappings between ERP entities and platform entities
 */
export interface FieldMappingRegistry {
  register(sourceEntity: string, targetEntity: string, mappings: FieldMapping[]): void;
  get(sourceEntity: string, targetEntity: string): FieldMapping[] | null;
  getAll(): FieldMappingTable;
  has(sourceEntity: string, targetEntity: string): boolean;
}

export interface FieldMapping {
  readonly sourceField: string;
  readonly targetField: string;
  readonly transformer?: (value: unknown) => unknown;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

export type FieldMappingTable = Record<string, Record<string, FieldMapping[]>>;
