/**
 * @seltriva/semantic-engine/rules
 * Business Rules Engine — constraints on valid semantic mappings
 *
 * Rules enforce that the USME produces semantically coherent mappings.
 * They are evaluated before a suggestion is finalized and after a mapping
 * is confirmed, catching logical contradictions before they enter the registry.
 *
 * Examples:
 * - An entity cannot be mapped to ENTITY_PRODUCT and ENTITY_INVOICE simultaneously
 * - FIELD_COST_PRICE and FIELD_SALE_PRICE must appear in the same entity
 * - FIELD_EXPIRATION_DATE only makes sense in entities related to products/inventory
 * - A field mapped to FIELD_TAX_ID should have a string or varchar type
 */

import type { CBLEntityTerm, CBLFieldTerm, CBLEntityKind, CBLFieldKind, CBLDomainKind, SemanticResult } from '../business-language/index';
import type { ConfidenceValue } from '../confidence-engine/index';
import type { CBMEntity, CBMField } from '../canonical-model/index';
import type { CanonicalBusinessModel } from '../canonical-model/index';

// ─── Business Rule Engine ─────────────────────────────────────────────────

export interface BusinessRuleEngine {
  /**
   * Evaluate all applicable rules against a proposed entity mapping
   */
  evaluateEntityMapping(
    entity: CBMEntity,
    model: CanonicalBusinessModel
  ): SemanticResult<RuleEvaluationResult>;

  /**
   * Evaluate all applicable rules against a proposed field mapping
   */
  evaluateFieldMapping(
    field: CBMField,
    entity: CBMEntity,
    model: CanonicalBusinessModel
  ): SemanticResult<RuleEvaluationResult>;

  /**
   * Evaluate all rules against a complete model snapshot
   */
  evaluateModel(model: CanonicalBusinessModel): SemanticResult<ModelRuleReport>;

  /**
   * Register a custom rule
   */
  register(rule: BusinessRule): void;

  /**
   * Remove a rule
   */
  unregister(ruleId: string): void;

  /**
   * Get all active rules
   */
  getRules(): BusinessRule[];

  /**
   * Get rules applicable to a specific entity kind
   */
  getRulesForEntity(entityKind: CBLEntityKind): BusinessRule[];

  /**
   * Get rules applicable to a specific field kind
   */
  getRulesForField(fieldKind: CBLFieldKind): BusinessRule[];
}

// ─── Business Rule ────────────────────────────────────────────────────────

export interface BusinessRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: RuleSeverity;
  readonly scope: RuleScope;
  readonly appliesTo: RuleApplicability;

  /**
   * Evaluate the rule against the given context.
   * Returns violations (empty array = rule passed).
   */
  evaluate(context: RuleEvaluationContext): RuleViolation[];
}

export type RuleSeverity = 'blocking' | 'warning' | 'info';

export type RuleScope = 'entity' | 'field' | 'relationship' | 'model' | 'cross-entity';

export interface RuleApplicability {
  readonly entityKinds?: CBLEntityKind[];
  readonly fieldKinds?: CBLFieldKind[];
  readonly domains?: CBLDomainKind[];
}

// ─── Rule Evaluation Context ──────────────────────────────────────────────

export interface RuleEvaluationContext {
  readonly entity?: CBMEntity;
  readonly field?: CBMField;
  readonly model: CanonicalBusinessModel;
  readonly proposedEntityTerm?: CBLEntityTerm;
  readonly proposedFieldTerm?: CBLFieldTerm;
}

// ─── Rule Violation ───────────────────────────────────────────────────────

export interface RuleViolation {
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  readonly entityName?: string;
  readonly fieldName?: string;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;
}

// ─── Evaluation Results ───────────────────────────────────────────────────

export interface RuleEvaluationResult {
  readonly passed: boolean;
  readonly violations: RuleViolation[];
  readonly blockingCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly evaluatedRules: number;
}

export interface ModelRuleReport {
  readonly modelId: string;
  readonly overallPassed: boolean;
  readonly entityResults: Array<{ entityName: string; result: RuleEvaluationResult }>;
  readonly fieldResults: Array<{ entityName: string; fieldName: string; result: RuleEvaluationResult }>;
  readonly modelLevelViolations: RuleViolation[];
  readonly totalViolations: number;
  readonly blockingViolations: number;
  readonly evaluatedAt: Date;
}

// ─── Built-in Rule IDs ────────────────────────────────────────────────────

export const MAPPING_RULE_IDS = {
  // Entity rules
  NO_DUAL_ENTITY_MAPPING:       'rule-no-dual-entity-mapping',
  ENTITY_REQUIRES_PRIMARY_KEY:  'rule-entity-requires-pk',
  PRODUCT_REQUIRES_CODE:        'rule-product-requires-code',
  PRODUCT_REQUIRES_NAME:        'rule-product-requires-name',
  INVOICE_REQUIRES_NUMBER:      'rule-invoice-requires-number',
  ORDER_REQUIRES_CUSTOMER:      'rule-order-requires-customer',
  INVENTORY_REQUIRES_PRODUCT:   'rule-inventory-requires-product',

  // Field rules
  PRICE_FIELD_TYPE_NUMERIC:     'rule-price-numeric',
  DATE_FIELD_TYPE_TEMPORAL:     'rule-date-temporal',
  BOOLEAN_FLAG_TYPE_BOOL:       'rule-boolean-type',
  TAX_ID_TYPE_STRING:           'rule-tax-id-string',
  QUANTITY_TYPE_NUMERIC:        'rule-quantity-numeric',
  EMAIL_FORMAT:                 'rule-email-format',
  CODE_FIELD_UNIQUENESS:        'rule-code-uniqueness',

  // Cross-entity rules
  COST_PRICE_WITH_SALE_PRICE:   'rule-cost-sale-price-coexist',
  EXPIRATION_IN_PRODUCT_CONTEXT:'rule-expiration-product-context',
  FK_TARGET_TYPE_MATCH:         'rule-fk-target-type',
  AUDIT_FIELDS_CONSISTENCY:     'rule-audit-fields',
} as const;

export type MappingRuleId = (typeof MAPPING_RULE_IDS)[keyof typeof MAPPING_RULE_IDS];

// ─── Mapping Constraint ───────────────────────────────────────────────────

/**
 * A declarative constraint that can be defined without implementing the full
 * BusinessRule interface. The engine converts these into rules automatically.
 */
export interface MappingConstraint {
  readonly id: string;
  readonly kind: MappingConstraintKind;
  readonly description: string;
  readonly severity: RuleSeverity;
  readonly parameters: Record<string, unknown>;
}

export type MappingConstraintKind =
  | 'requires-field'
  | 'excludes-field'
  | 'requires-entity'
  | 'excludes-entity'
  | 'type-must-be'
  | 'field-must-coexist'
  | 'context-restricted'
  | 'uniqueness-required';

// ─── Rule Registry ────────────────────────────────────────────────────────

export interface BusinessRuleRegistry {
  register(rule: BusinessRule): void;
  unregister(ruleId: string): void;
  get(ruleId: string): BusinessRule | null;
  getAll(): BusinessRule[];
  getByScope(scope: RuleScope): BusinessRule[];
  getBySeverity(severity: RuleSeverity): BusinessRule[];
  has(ruleId: string): boolean;
}
