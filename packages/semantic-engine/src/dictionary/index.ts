/**
 * @seltriva/semantic-engine/dictionary
 * Business Dictionary — authoritative definitions of every CBL concept
 *
 * The dictionary is the human-facing documentation layer of the CBL.
 * Every entity and field has a rich definition with examples, relationships,
 * and business rules. This is what administrators read when reviewing
 * a mapping suggestion: "the engine thinks this column is FIELD_COST_PRICE —
 * here's what FIELD_COST_PRICE means."
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
} from '../business-language/index';

// ─── Business Dictionary ──────────────────────────────────────────────────

export interface BusinessDictionary {
  /**
   * Look up a complete definition for any CBL term
   */
  lookup(term: CBLTerm): DictionaryEntry | null;

  /**
   * Look up an entity definition
   */
  lookupEntity(term: CBLEntityTerm): EntityDefinition | null;

  /**
   * Look up a field definition
   */
  lookupField(term: CBLFieldTerm): FieldDefinition | null;

  /**
   * Find definitions containing the given keyword in name, description, or aliases
   */
  search(keyword: string): DictionaryEntry[];

  /**
   * Get all entries for a given domain
   */
  getByDomain(domain: CBLDomainKind): DictionaryEntry[];

  /**
   * Get all entity definitions
   */
  getAllEntities(): EntityDefinition[];

  /**
   * Get all field definitions
   */
  getAllFields(): FieldDefinition[];

  /**
   * Register a custom entry (extends the built-in dictionary)
   */
  register(entry: DictionaryEntry): void;

  /**
   * Check if a term is defined
   */
  has(term: CBLTerm): boolean;

  /**
   * Count all entries
   */
  count(): number;
}

// ─── Dictionary Entry ─────────────────────────────────────────────────────

export type DictionaryEntry = EntityDefinition | FieldDefinition;

// ─── Entity Definition ────────────────────────────────────────────────────

export interface EntityDefinition {
  readonly kind: 'entity';
  readonly term: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly domain: CBLDomainKind;

  /** Clear, one-paragraph business description */
  readonly name: string;
  readonly description: string;

  /** Common synonyms used across ERPs */
  readonly aliases: string[];

  /** Example table/collection names from real-world ERPs */
  readonly examples: EntityExample[];

  /** Which fields are considered essential for this entity */
  readonly essentialFields: CBLFieldKind[];

  /** Which fields are common (but not required) for this entity */
  readonly commonFields: CBLFieldKind[];

  /** Relationships this entity typically participates in */
  readonly typicalRelationships: RelationshipHint[];

  /** Domain-specific business rules this entity must respect */
  readonly businessRules: BusinessRuleReference[];

  /** Notes for disambiguation (when this might be confused with another entity) */
  readonly disambiguation?: string;

  readonly isExtended?: boolean;
  readonly extendedFrom?: CBLEntityKind;
}

export interface EntityExample {
  readonly erp?: string;
  readonly tableName: string;
  readonly notes?: string;
}

export interface RelationshipHint {
  readonly relatedEntityKind: CBLEntityKind;
  readonly nature: string;
  readonly cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';
  readonly isOptional: boolean;
}

// ─── Field Definition ─────────────────────────────────────────────────────

export interface FieldDefinition {
  readonly kind: 'field';
  readonly term: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;
  readonly domain: CBLDomainKind;

  readonly name: string;
  readonly description: string;

  /** Common synonyms across ERPs (column names mapped to this field) */
  readonly aliases: string[];

  /** Real-world examples of this field in common ERPs */
  readonly examples: FieldExample[];

  /** Canonical data types this field typically uses */
  readonly typicalTypes: string[];

  /** Whether the field is almost always required */
  readonly isTypicallyRequired: boolean;

  /** Whether the field is almost always unique within its entity */
  readonly isTypicallyUnique: boolean;

  /** Entities where this field is commonly found */
  readonly commonInEntities: CBLEntityKind[];

  /** Fields this field is related to (e.g., COST_PRICE → SALE_PRICE → MARGIN) */
  readonly relatedFields: CBLFieldKind[];

  /** Business rules that apply to this field */
  readonly businessRules: BusinessRuleReference[];

  /** Format constraints (regex, format string, range, etc.) */
  readonly formatConstraints?: FieldFormatConstraint[];

  /** Disambiguation notes */
  readonly disambiguation?: string;
}

export interface FieldExample {
  readonly erp?: string;
  readonly columnName: string;
  readonly sampleValues?: string[];
  readonly notes?: string;
}

export interface FieldFormatConstraint {
  readonly kind: 'regex' | 'min' | 'max' | 'length' | 'enum' | 'format';
  readonly constraint: string;
  readonly description: string;
}

// ─── Business Rule Reference ──────────────────────────────────────────────

/**
 * A reference to a business rule that applies to this CBL concept.
 */
export interface BusinessRuleReference {
  readonly ruleId: string;
  readonly description: string;
  readonly isMandatory: boolean;
}

// ─── Dictionary Builder ───────────────────────────────────────────────────

/**
 * Fluent builder for creating dictionary entries programmatically.
 */
export interface DictionaryBuilder {
  entity(kind: CBLEntityKind): EntityDefinitionBuilder;
  field(kind: CBLFieldKind): FieldDefinitionBuilder;
}

export interface EntityDefinitionBuilder {
  name(name: string): EntityDefinitionBuilder;
  description(desc: string): EntityDefinitionBuilder;
  aliases(...aliases: string[]): EntityDefinitionBuilder;
  example(erp: string, tableName: string, notes?: string): EntityDefinitionBuilder;
  essentialFields(...fields: CBLFieldKind[]): EntityDefinitionBuilder;
  commonFields(...fields: CBLFieldKind[]): EntityDefinitionBuilder;
  relationship(hint: RelationshipHint): EntityDefinitionBuilder;
  rule(ref: BusinessRuleReference): EntityDefinitionBuilder;
  disambiguation(note: string): EntityDefinitionBuilder;
  build(): EntityDefinition;
}

export interface FieldDefinitionBuilder {
  name(name: string): FieldDefinitionBuilder;
  description(desc: string): FieldDefinitionBuilder;
  aliases(...aliases: string[]): FieldDefinitionBuilder;
  example(erp: string, columnName: string, samples?: string[]): FieldDefinitionBuilder;
  typicalTypes(...types: string[]): FieldDefinitionBuilder;
  required(value?: boolean): FieldDefinitionBuilder;
  unique(value?: boolean): FieldDefinitionBuilder;
  commonInEntities(...entities: CBLEntityKind[]): FieldDefinitionBuilder;
  relatedFields(...fields: CBLFieldKind[]): FieldDefinitionBuilder;
  rule(ref: BusinessRuleReference): FieldDefinitionBuilder;
  format(constraint: FieldFormatConstraint): FieldDefinitionBuilder;
  disambiguation(note: string): FieldDefinitionBuilder;
  build(): FieldDefinition;
}

// ─── Dictionary Search Result ─────────────────────────────────────────────

export interface DictionarySearchResult {
  readonly entry: DictionaryEntry;
  readonly matchedOn: 'term' | 'alias' | 'description' | 'example';
  readonly relevanceScore: number;
}

// ─── Dictionary Export ────────────────────────────────────────────────────

export interface DictionaryExporter {
  exportToJson(dictionary: BusinessDictionary): Record<string, unknown>;
  exportToMarkdown(dictionary: BusinessDictionary): string;
  importFromJson(data: Record<string, unknown>): DictionaryEntry[];
}
