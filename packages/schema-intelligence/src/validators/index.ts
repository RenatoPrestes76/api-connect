/**
 * @seltriva/schema-intelligence/validators
 * Schema Validators — structural integrity checks on CanonicalSchema
 *
 * Validators check that a schema is internally consistent and conforms to
 * structural expectations. They do NOT validate business rules or data values.
 *
 * Examples:
 * - All referenced foreign key targets exist in the schema
 * - Every entity has at least one field
 * - No two entities share the same name in the same namespace
 * - All enum fields reference declared enumerations
 */

import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity, CanonicalField, CanonicalRelationship } from '../canonical/index';

// ─── Schema Validator ─────────────────────────────────────────────────────

/**
 * Primary validator — runs all active rules against a complete schema.
 */
export interface SchemaValidator {
  /**
   * Validate the entire schema
   */
  validate(schema: CanonicalSchema, options?: ValidationOptions): SIEResult<SchemaValidationResult>;

  /**
   * Validate a single entity in isolation
   */
  validateEntity(entity: CanonicalEntity, options?: ValidationOptions): SIEResult<EntityValidationResult>;

  /**
   * Validate a single field
   */
  validateField(field: CanonicalField, entity: CanonicalEntity, options?: ValidationOptions): SIEResult<FieldValidationResult>;

  /**
   * Validate relationships across all entities
   */
  validateRelationships(schema: CanonicalSchema): SIEResult<RelationshipValidationResult[]>;

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void;

  /**
   * Remove a rule by id
   */
  removeRule(ruleId: string): void;

  /**
   * Get all active rules
   */
  getRules(): ValidationRule[];
}

// ─── Validation Options ───────────────────────────────────────────────────

export interface ValidationOptions {
  readonly stopOnFirstError?: boolean;
  readonly includeSeverities?: ValidationSeverity[];
  readonly excludeRuleIds?: string[];
  readonly strict?: boolean;
}

// ─── Validation Results ───────────────────────────────────────────────────

export interface SchemaValidationResult {
  readonly schemaId: string;
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly entityResults: EntityValidationResult[];
  readonly relationshipResults: RelationshipValidationResult[];
  readonly validatedAt: Date;
  readonly durationMs: number;
}

export interface EntityValidationResult {
  readonly entityName: string;
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly fieldResults: FieldValidationResult[];
}

export interface FieldValidationResult {
  readonly fieldName: string;
  readonly entityName: string;
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
}

export interface RelationshipValidationResult {
  readonly relationshipId: string;
  readonly sourceEntity: string;
  readonly targetEntity: string;
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
}

// ─── Validation Issue ─────────────────────────────────────────────────────

export interface ValidationIssue {
  readonly code: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly entityName?: string;
  readonly fieldName?: string;
  readonly ruleId: string;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

// ─── Validation Rules ─────────────────────────────────────────────────────

/**
 * A single, independently executable validation rule.
 */
export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: ValidationSeverity;
  readonly scope: ValidationRuleScope;
  readonly code: string;

  /**
   * Execute the rule and return any issues found
   */
  evaluate(schema: CanonicalSchema): ValidationIssue[];
}

export type ValidationRuleScope =
  | 'schema'
  | 'entity'
  | 'field'
  | 'relationship'
  | 'constraint'
  | 'index'
  | 'cross-entity';

// ─── Built-in Rule Ids ────────────────────────────────────────────────────

/**
 * Identifiers for the built-in validation rules.
 * Implementations reference these when registering default rules.
 */
export const BUILT_IN_RULE_IDS = {
  // Schema-level
  SCHEMA_HAS_ENTITIES: 'sie-schema-has-entities',
  SCHEMA_UNIQUE_ENTITY_NAMES: 'sie-schema-unique-entity-names',
  SCHEMA_CONSISTENT_NAMING: 'sie-schema-consistent-naming',
  SCHEMA_CHECKSUM_VALID: 'sie-schema-checksum-valid',

  // Entity-level
  ENTITY_HAS_FIELDS: 'sie-entity-has-fields',
  ENTITY_HAS_PRIMARY_KEY: 'sie-entity-has-primary-key',
  ENTITY_UNIQUE_FIELD_NAMES: 'sie-entity-unique-field-names',
  ENTITY_UNIQUE_CONSTRAINT_NAMES: 'sie-entity-unique-constraint-names',
  ENTITY_UNIQUE_INDEX_NAMES: 'sie-entity-unique-index-names',
  ENTITY_PRIMARY_KEY_NOT_NULLABLE: 'sie-entity-pk-not-nullable',

  // Field-level
  FIELD_HAS_VALID_TYPE: 'sie-field-valid-type',
  FIELD_ENUM_REFERENCES_DEFINED: 'sie-field-enum-defined',
  FIELD_ARRAY_HAS_ITEM_TYPE: 'sie-field-array-item-type',
  FIELD_OBJECT_HAS_PROPERTIES: 'sie-field-object-properties',
  FIELD_DEFAULT_TYPE_MATCH: 'sie-field-default-type',
  FIELD_NO_DUPLICATE_ROLES: 'sie-field-no-duplicate-pk',

  // Relationship-level
  RELATIONSHIP_SOURCE_EXISTS: 'sie-rel-source-exists',
  RELATIONSHIP_TARGET_EXISTS: 'sie-rel-target-exists',
  RELATIONSHIP_SOURCE_FIELDS_EXIST: 'sie-rel-source-fields-exist',
  RELATIONSHIP_TARGET_FIELDS_EXIST: 'sie-rel-target-fields-exist',
  RELATIONSHIP_NO_CIRCULAR_REQUIRED: 'sie-rel-no-circular-required',

  // Cross-entity
  FK_TARGET_HAS_PK: 'sie-fk-target-has-pk',
  FK_TYPE_MATCHES_PK: 'sie-fk-type-matches-pk',
  ENUM_VALUES_USED: 'sie-enum-values-used',
} as const;

export type BuiltInRuleId = (typeof BUILT_IN_RULE_IDS)[keyof typeof BUILT_IN_RULE_IDS];

// ─── Field Validator ──────────────────────────────────────────────────────

/**
 * Focused validator for a single field's structural integrity.
 */
export interface FieldValidator {
  validateType(field: CanonicalField): ValidationIssue[];
  validateDefault(field: CanonicalField): ValidationIssue[];
  validateNullability(field: CanonicalField): ValidationIssue[];
}

// ─── Relationship Validator ───────────────────────────────────────────────

/**
 * Validates cross-entity references and constraint consistency.
 */
export interface RelationshipValidator {
  validate(relationship: CanonicalRelationship, schema: CanonicalSchema): ValidationIssue[];
  validateAllRelationships(schema: CanonicalSchema): ValidationIssue[];
  detectCircularRequired(schema: CanonicalSchema): ValidationIssue[];
}

// ─── Constraint Validator ─────────────────────────────────────────────────

export interface ConstraintValidator {
  validatePrimaryKey(entity: CanonicalEntity): ValidationIssue[];
  validateUniqueConstraints(entity: CanonicalEntity): ValidationIssue[];
  validateForeignKeys(entity: CanonicalEntity, schema: CanonicalSchema): ValidationIssue[];
  validateCheckConstraints(entity: CanonicalEntity): ValidationIssue[];
}

// ─── Rule Registry ────────────────────────────────────────────────────────

/**
 * Dynamic registry of all validation rules.
 */
export interface ValidationRuleRegistry {
  register(rule: ValidationRule): void;
  unregister(ruleId: string): void;
  get(ruleId: string): ValidationRule | null;
  getAll(): ValidationRule[];
  getByScope(scope: ValidationRuleScope): ValidationRule[];
  getBySeverity(severity: ValidationSeverity): ValidationRule[];
  has(ruleId: string): boolean;
}
