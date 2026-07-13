/**
 * @seltriva/schema-intelligence/canonical
 * Canonical Schema Model — the universal internal representation of any schema
 *
 * Every parser produces this. Every comparator, fingerprinter, and similarity
 * engine consumes this. The canonical model is the lingua franca of the SIE.
 */

import type {
  SchemaId,
  EntityId,
  FieldId,
  RelationshipId,
  CanonicalDataKind,
  EntityKind,
  FieldRole,
  RelationshipKind,
  ConstraintKind,
  Cardinality,
  NamingConvention,
  SchemaCategory,
} from '../models/index';
import type { SchemaSource } from '../core/index';

// ─── Canonical Schema (root) ──────────────────────────────────────────────

/**
 * The top-level normalized schema.
 * Source-independent — a PostgreSQL schema and an OpenAPI spec produce the
 * same CanonicalSchema shape, differing only in EntityKind and FieldRole.
 */
export interface CanonicalSchema {
  readonly id: SchemaId;
  readonly name: string;
  readonly category: SchemaCategory;
  readonly source: SchemaSource;
  readonly entities: CanonicalEntity[];
  readonly relationships: CanonicalRelationship[];
  readonly namespaces: string[];
  readonly namingConvention: NamingConvention;
  readonly enumerations: CanonicalEnumeration[];
  readonly statistics: SchemaStatistics;
  readonly checksum: string;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface SchemaStatistics {
  readonly entityCount: number;
  readonly fieldCount: number;
  readonly relationshipCount: number;
  readonly enumerationCount: number;
  readonly totalConstraints: number;
  readonly totalIndexes: number;
  readonly nullableFieldRatio: number;
  readonly averageFieldsPerEntity: number;
}

// ─── Canonical Entity ─────────────────────────────────────────────────────

/**
 * Represents a table, collection, resource endpoint, file structure, or topic.
 * The `kind` discriminates the source origin.
 */
export interface CanonicalEntity {
  readonly id: EntityId;
  readonly schemaId: SchemaId;
  readonly name: string;
  readonly originalName: string;
  readonly kind: EntityKind;
  readonly namespace?: string;
  readonly fields: CanonicalField[];
  readonly primaryKey?: PrimaryKeyDescriptor;
  readonly constraints: CanonicalConstraint[];
  readonly indexes: CanonicalIndex[];
  readonly description?: string;
  readonly isDeprecated?: boolean;
  readonly estimatedRowCount?: number;
  readonly sizeBytes?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface PrimaryKeyDescriptor {
  readonly fields: string[];
  readonly name?: string;
  readonly isComposite: boolean;
  readonly isSurrogate: boolean;
}

// ─── Canonical Field ──────────────────────────────────────────────────────

/**
 * Represents a column, document property, API parameter, or file column.
 */
export interface CanonicalField {
  readonly id: FieldId;
  readonly entityId: EntityId;
  readonly name: string;
  readonly originalName: string;
  readonly type: CanonicalType;
  readonly role: FieldRole;
  readonly nullable: boolean;
  readonly required: boolean;
  readonly position: number;
  readonly defaultValue?: CanonicalValue;
  readonly description?: string;
  readonly isDeprecated?: boolean;
  readonly isGenerated?: boolean;
  readonly isVirtual?: boolean;
  readonly examples?: CanonicalValue[];
  readonly metadata?: Record<string, unknown>;
}

// ─── Canonical Type ───────────────────────────────────────────────────────

/**
 * Universal type representation.
 * Every native type from every source maps to this.
 */
export interface CanonicalType {
  readonly kind: CanonicalDataKind;
  readonly nullable: boolean;
  readonly isArray: boolean;
  readonly arrayDimensions?: number;
  readonly length?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly enumValues?: string[];
  readonly itemType?: CanonicalType;
  readonly properties?: Record<string, CanonicalType>;
  readonly nativeType: string;
  readonly nativeSource?: string;
  readonly format?: string;
}

// ─── Canonical Constraint ─────────────────────────────────────────────────

export interface CanonicalConstraint {
  readonly name?: string;
  readonly kind: ConstraintKind;
  readonly fields: string[];
  readonly referencedEntity?: string;
  readonly referencedSchema?: string;
  readonly referencedFields?: string[];
  readonly expression?: string;
  readonly deferrable?: boolean;
  readonly deferred?: boolean;
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
}

export type ReferentialAction = 'cascade' | 'restrict' | 'set-null' | 'set-default' | 'no-action';

// ─── Canonical Index ──────────────────────────────────────────────────────

export interface CanonicalIndex {
  readonly name: string;
  readonly fields: CanonicalIndexField[];
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly type?: string;
  readonly predicate?: string;
  readonly comment?: string;
}

export interface CanonicalIndexField {
  readonly name: string;
  readonly direction: 'asc' | 'desc';
  readonly nullsFirst?: boolean;
}

// ─── Canonical Relationship ───────────────────────────────────────────────

/**
 * Represents an FK, nested object reference, OpenAPI $ref, or GraphQL link.
 * `isInferred` = true when discovered by name-pattern heuristics rather than DDL.
 */
export interface CanonicalRelationship {
  readonly id: RelationshipId;
  readonly name?: string;
  readonly kind: RelationshipKind;
  readonly sourceEntity: EntityId;
  readonly sourceFields: string[];
  readonly targetEntity: EntityId;
  readonly targetFields: string[];
  readonly sourceCardinality: Cardinality;
  readonly targetCardinality: Cardinality;
  readonly isBidirectional: boolean;
  readonly isInferred: boolean;
  readonly confidence?: number;
  readonly joinEntity?: EntityId;
}

// ─── Canonical Enumeration ────────────────────────────────────────────────

export interface CanonicalEnumeration {
  readonly name: string;
  readonly namespace?: string;
  readonly values: CanonicalEnumValue[];
  readonly description?: string;
}

export interface CanonicalEnumValue {
  readonly name: string;
  readonly value?: string | number;
  readonly description?: string;
  readonly isDeprecated?: boolean;
}

// ─── Canonical Value ──────────────────────────────────────────────────────

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

// ─── Schema Patch ─────────────────────────────────────────────────────────

/**
 * A minimal, serializable description of a change to apply to a schema.
 * Used by the versioning system to reconstruct any version from a base + patches.
 */
export interface SchemaPatch {
  readonly schemaId: SchemaId;
  readonly operations: PatchOperation[];
  readonly generatedAt: Date;
}

export type PatchOperation =
  | AddEntityOperation
  | RemoveEntityOperation
  | AddFieldOperation
  | RemoveFieldOperation
  | ModifyFieldOperation
  | AddRelationshipOperation
  | RemoveRelationshipOperation;

export interface AddEntityOperation {
  readonly op: 'add-entity';
  readonly entity: CanonicalEntity;
}
export interface RemoveEntityOperation {
  readonly op: 'remove-entity';
  readonly entityId: EntityId;
}
export interface AddFieldOperation {
  readonly op: 'add-field';
  readonly entityId: EntityId;
  readonly field: CanonicalField;
}
export interface RemoveFieldOperation {
  readonly op: 'remove-field';
  readonly entityId: EntityId;
  readonly fieldId: FieldId;
}
export interface AddRelationshipOperation {
  readonly op: 'add-relationship';
  readonly relationship: CanonicalRelationship;
}
export interface RemoveRelationshipOperation {
  readonly op: 'remove-relationship';
  readonly relationshipId: RelationshipId;
}

export interface ModifyFieldOperation {
  readonly op: 'modify-field';
  readonly entityId: EntityId;
  readonly fieldId: FieldId;
  readonly changes: Partial<CanonicalField>;
}
