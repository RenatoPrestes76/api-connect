/**
 * @seltriva/semantic-engine/business-language
 * Canonical Business Language (CBL) — the universal business vocabulary
 *
 * CBL is the lingua franca of the USME. Every semantic suggestion, mapping,
 * and learned pattern is expressed in CBL terms, regardless of the source
 * ERP, database engine, or connector.
 *
 * Design:
 * - `CBLTerm` is a branded string — extensible beyond the built-in vocabulary
 * - `CBLEntityKind` and `CBLFieldKind` are the built-in string unions
 * - `CBL_ENTITIES` and `CBL_FIELDS` are runtime constants for iteration
 */

// ─── Result Wrapper ───────────────────────────────────────────────────────

/** Every USME operation returns this — never throws */
export interface SemanticResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: SemanticError;
  readonly durationMs?: number;
  readonly timestamp: Date;
}

export interface SemanticError {
  readonly code: SemanticErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type SemanticErrorCode =
  | 'ANALYSIS_FAILED'
  | 'MAPPING_FAILED'
  | 'VALIDATION_FAILED'
  | 'LEARNING_FAILED'
  | 'REGISTRY_ERROR'
  | 'UNKNOWN_TERM'
  | 'GRAPH_ERROR'
  | 'PROFILE_ERROR'
  | 'DICTIONARY_ERROR'
  | 'RULE_VIOLATION'
  | 'UNKNOWN';

// ─── CBL Term (branded) ───────────────────────────────────────────────────

/** A canonical business language term — branded for nominal typing */
export type CBLTerm = string & { readonly __brand: 'CBLTerm' };

/** A CBL term scoped to an entity concept */
export type CBLEntityTerm = string & { readonly __brand: 'CBLEntityTerm' };

/** A CBL term scoped to a field concept */
export type CBLFieldTerm = string & { readonly __brand: 'CBLFieldTerm' };

/** A CBL term scoped to a relationship concept */
export type CBLRelationshipTerm = string & { readonly __brand: 'CBLRelationshipTerm' };

/** A CBL domain identifier */
export type CBLDomain = string & { readonly __brand: 'CBLDomain' };

// ─── CBL Entity Kinds ─────────────────────────────────────────────────────

/**
 * Canonical business entity concepts.
 * Naming: SCREAMING_SNAKE_CASE, noun-based.
 */
export type CBLEntityKind =
  // Product catalog
  | 'PRODUCT'
  | 'PRODUCT_VARIANT'
  | 'PRODUCT_KIT'
  | 'PRODUCT_BUNDLE'
  | 'PRODUCT_SERVICE'
  // Procurement
  | 'SUPPLIER'
  | 'SUPPLIER_CONTACT'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_ORDER_LINE'
  | 'RECEIPT'
  | 'RECEIPT_LINE'
  // Sales
  | 'CUSTOMER'
  | 'CUSTOMER_CONTACT'
  | 'CUSTOMER_ADDRESS'
  | 'ORDER'
  | 'ORDER_LINE'
  | 'ORDER_RETURN'
  | 'QUOTE'
  | 'QUOTE_LINE'
  // Inventory
  | 'INVENTORY'
  | 'INVENTORY_MOVEMENT'
  | 'INVENTORY_COUNT'
  | 'WAREHOUSE'
  | 'WAREHOUSE_LOCATION'
  | 'STOCK_TRANSFER'
  // Finance
  | 'INVOICE'
  | 'INVOICE_LINE'
  | 'INVOICE_TAX'
  | 'PAYMENT'
  | 'PAYMENT_METHOD'
  | 'PAYMENT_INSTALLMENT'
  | 'BANK_ACCOUNT'
  | 'BANK_TRANSACTION'
  | 'ACCOUNT'
  | 'ACCOUNT_ENTRY'
  | 'COST_CENTER'
  | 'PROFIT_CENTER'
  | 'BUDGET'
  // Catalog / classification
  | 'CATEGORY'
  | 'SUBCATEGORY'
  | 'BRAND'
  | 'ATTRIBUTE'
  | 'ATTRIBUTE_VALUE'
  | 'UNIT_OF_MEASURE'
  | 'PRICE_LIST'
  | 'PRICE_LIST_ITEM'
  | 'DISCOUNT'
  | 'PROMOTION'
  // Organization
  | 'COMPANY'
  | 'BRANCH'
  | 'DEPARTMENT'
  | 'EMPLOYEE'
  | 'EMPLOYEE_ROLE'
  // Logistics
  | 'ADDRESS'
  | 'CARRIER'
  | 'DELIVERY'
  | 'SHIPMENT'
  // Fiscal / tax
  | 'TAX_CODE'
  | 'FISCAL_CLASSIFICATION'
  | 'CURRENCY'
  | 'EXCHANGE_RATE'
  // Shared
  | 'CONTACT'
  | 'NOTE'
  | 'ATTACHMENT'
  | 'AUDIT_LOG';

// ─── CBL Field Kinds ──────────────────────────────────────────────────────

/**
 * Canonical business field concepts.
 * Cross-entity fields (status, created_at) are entity-agnostic.
 * Entity-specific fields carry the entity prefix (PRODUCT_CODE, CUSTOMER_CODE).
 */
export type CBLFieldKind =
  // Identity / keys
  | 'ID'
  | 'CODE'
  | 'EXTERNAL_CODE'
  | 'INTERNAL_CODE'
  | 'PRODUCT_CODE'
  | 'CUSTOMER_CODE'
  | 'SUPPLIER_CODE'
  | 'ORDER_NUMBER'
  | 'INVOICE_NUMBER'
  | 'DOCUMENT_NUMBER'
  | 'SERIES'
  | 'SEQUENCE'
  // Name / description
  | 'NAME'
  | 'SHORT_NAME'
  | 'DESCRIPTION'
  | 'NOTES'
  | 'PRODUCT_NAME'
  // Barcode / classification
  | 'BARCODE'
  | 'GTIN'
  | 'SKU'
  | 'EAN'
  | 'ISBN'
  | 'NCM'
  | 'CEST'
  | 'CFOP'
  // Pricing
  | 'COST_PRICE'
  | 'SALE_PRICE'
  | 'MINIMUM_PRICE'
  | 'MAXIMUM_PRICE'
  | 'AVERAGE_PRICE'
  | 'REFERENCE_PRICE'
  | 'LIST_PRICE'
  | 'MARGIN'
  | 'MARKUP'
  | 'DISCOUNT_RATE'
  | 'DISCOUNT_AMOUNT'
  // Quantity / inventory
  | 'QUANTITY'
  | 'MINIMUM_QUANTITY'
  | 'MAXIMUM_QUANTITY'
  | 'REORDER_POINT'
  | 'STOCK_BALANCE'
  | 'RESERVED_QUANTITY'
  | 'AVAILABLE_QUANTITY'
  // Dimensions / physical
  | 'UNIT_OF_MEASURE'
  | 'WEIGHT'
  | 'LENGTH'
  | 'WIDTH'
  | 'HEIGHT'
  | 'VOLUME'
  // Dates / time
  | 'CREATED_AT'
  | 'UPDATED_AT'
  | 'DELETED_AT'
  | 'EXPIRATION_DATE'
  | 'MANUFACTURE_DATE'
  | 'ISSUE_DATE'
  | 'DUE_DATE'
  | 'DELIVERY_DATE'
  | 'ENTRY_DATE'
  | 'EXIT_DATE'
  | 'PAYMENT_DATE'
  | 'DATE'
  // Audit
  | 'CREATED_BY'
  | 'UPDATED_BY'
  | 'DELETED_BY'
  // Status / flags
  | 'STATUS'
  | 'STATE'
  | 'PHASE'
  | 'IS_ACTIVE'
  | 'IS_DELETED'
  | 'IS_ARCHIVED'
  | 'IS_DIGITAL'
  | 'IS_SERVICE'
  | 'IS_TAXABLE'
  // References (FK semantics)
  | 'SUPPLIER'
  | 'CUSTOMER'
  | 'CATEGORY'
  | 'SUBCATEGORY'
  | 'BRAND'
  | 'PRODUCT'
  | 'ORDER'
  | 'INVOICE'
  | 'EMPLOYEE'
  | 'DEPARTMENT'
  | 'BRANCH'
  | 'WAREHOUSE'
  | 'PAYMENT_METHOD'
  | 'CURRENCY'
  | 'PRICE_LIST'
  | 'CARRIER'
  // Address
  | 'ADDRESS_STREET'
  | 'ADDRESS_NUMBER'
  | 'ADDRESS_COMPLEMENT'
  | 'ADDRESS_NEIGHBORHOOD'
  | 'ADDRESS_CITY'
  | 'ADDRESS_STATE'
  | 'ADDRESS_POSTAL_CODE'
  | 'ADDRESS_COUNTRY'
  | 'LATITUDE'
  | 'LONGITUDE'
  // Contact
  | 'PHONE'
  | 'MOBILE'
  | 'EMAIL'
  | 'WEBSITE'
  // Fiscal / tax
  | 'TAX_ID'
  | 'COMPANY_REGISTRATION'
  | 'STATE_REGISTRATION'
  | 'MUNICIPAL_REGISTRATION'
  | 'TAX_RATE'
  | 'TAX_CODE'
  | 'FISCAL_CLASS'
  | 'PAYMENT_CONDITION'
  | 'PAYMENT_TERM'
  // Finance
  | 'AMOUNT'
  | 'TOTAL_AMOUNT'
  | 'NET_AMOUNT'
  | 'TAX_AMOUNT'
  | 'FREIGHT_AMOUNT'
  | 'ACCOUNT_CODE'
  | 'COST_CENTER_CODE'
  // Sort / meta
  | 'SORT_ORDER'
  | 'VERSION'
  | 'METADATA';

// ─── CBL Relationship Kinds ───────────────────────────────────────────────

export type CBLRelationshipKind =
  | 'HAS_CATEGORY'
  | 'HAS_SUPPLIER'
  | 'HAS_CUSTOMER'
  | 'HAS_BRAND'
  | 'HAS_UNIT'
  | 'HAS_INVENTORY'
  | 'HAS_PRICE_LIST'
  | 'BELONGS_TO_ORDER'
  | 'BELONGS_TO_INVOICE'
  | 'BELONGS_TO_CATEGORY'
  | 'MADE_BY_SUPPLIER'
  | 'ORDERED_BY_CUSTOMER'
  | 'STORED_IN_WAREHOUSE'
  | 'ISSUED_BY_BRANCH'
  | 'MANAGED_BY_EMPLOYEE'
  | 'PAID_WITH_METHOD'
  | 'PRICED_BY_LIST';

// ─── CBL Domain Classification ────────────────────────────────────────────

export type CBLDomainKind =
  | 'commerce'
  | 'inventory'
  | 'procurement'
  | 'finance'
  | 'hr'
  | 'logistics'
  | 'crm'
  | 'catalog'
  | 'fiscal'
  | 'audit'
  | 'system';

// ─── Built-in CBL Constants ───────────────────────────────────────────────

/**
 * Runtime map of all built-in CBL entity kinds to their domain.
 * Used by implementations for iteration and introspection.
 */
export const CBL_ENTITY_DOMAINS: Readonly<Record<CBLEntityKind, CBLDomainKind>> = {
  PRODUCT: 'catalog',
  PRODUCT_VARIANT: 'catalog',
  PRODUCT_KIT: 'catalog',
  PRODUCT_BUNDLE: 'catalog',
  PRODUCT_SERVICE: 'catalog',
  SUPPLIER: 'procurement',
  SUPPLIER_CONTACT: 'procurement',
  PURCHASE_ORDER: 'procurement',
  PURCHASE_ORDER_LINE: 'procurement',
  RECEIPT: 'procurement',
  RECEIPT_LINE: 'procurement',
  CUSTOMER: 'crm',
  CUSTOMER_CONTACT: 'crm',
  CUSTOMER_ADDRESS: 'crm',
  ORDER: 'commerce',
  ORDER_LINE: 'commerce',
  ORDER_RETURN: 'commerce',
  QUOTE: 'commerce',
  QUOTE_LINE: 'commerce',
  INVENTORY: 'inventory',
  INVENTORY_MOVEMENT: 'inventory',
  INVENTORY_COUNT: 'inventory',
  WAREHOUSE: 'inventory',
  WAREHOUSE_LOCATION: 'inventory',
  STOCK_TRANSFER: 'inventory',
  INVOICE: 'finance',
  INVOICE_LINE: 'finance',
  INVOICE_TAX: 'fiscal',
  PAYMENT: 'finance',
  PAYMENT_METHOD: 'finance',
  PAYMENT_INSTALLMENT: 'finance',
  BANK_ACCOUNT: 'finance',
  BANK_TRANSACTION: 'finance',
  ACCOUNT: 'finance',
  ACCOUNT_ENTRY: 'finance',
  COST_CENTER: 'finance',
  PROFIT_CENTER: 'finance',
  BUDGET: 'finance',
  CATEGORY: 'catalog',
  SUBCATEGORY: 'catalog',
  BRAND: 'catalog',
  ATTRIBUTE: 'catalog',
  ATTRIBUTE_VALUE: 'catalog',
  UNIT_OF_MEASURE: 'catalog',
  PRICE_LIST: 'commerce',
  PRICE_LIST_ITEM: 'commerce',
  DISCOUNT: 'commerce',
  PROMOTION: 'commerce',
  COMPANY: 'system',
  BRANCH: 'system',
  DEPARTMENT: 'hr',
  EMPLOYEE: 'hr',
  EMPLOYEE_ROLE: 'hr',
  ADDRESS: 'logistics',
  CARRIER: 'logistics',
  DELIVERY: 'logistics',
  SHIPMENT: 'logistics',
  TAX_CODE: 'fiscal',
  FISCAL_CLASSIFICATION: 'fiscal',
  CURRENCY: 'finance',
  EXCHANGE_RATE: 'finance',
  CONTACT: 'crm',
  NOTE: 'system',
  ATTACHMENT: 'system',
  AUDIT_LOG: 'audit',
} as const;

// ─── CBL Term Construction Helpers ────────────────────────────────────────

/** Build a CBL entity term from a kind: 'PRODUCT' → 'ENTITY_PRODUCT' */
export function cblEntityTerm(kind: CBLEntityKind): CBLEntityTerm {
  return `ENTITY_${kind}` as CBLEntityTerm;
}

/** Build a CBL field term from a kind: 'COST_PRICE' → 'FIELD_COST_PRICE' */
export function cblFieldTerm(kind: CBLFieldKind): CBLFieldTerm {
  return `FIELD_${kind}` as CBLFieldTerm;
}

/** Build a CBL relationship term: 'HAS_SUPPLIER' → 'REL_HAS_SUPPLIER' */
export function cblRelTerm(kind: CBLRelationshipKind): CBLRelationshipTerm {
  return `REL_${kind}` as CBLRelationshipTerm;
}

/** Extract the kind from a full CBL entity term */
export function parseCBLEntityTerm(term: string): CBLEntityKind | null {
  if (!term.startsWith('ENTITY_')) return null;
  return term.slice(7) as CBLEntityKind;
}

/** Extract the kind from a full CBL field term */
export function parseCBLFieldTerm(term: string): CBLFieldKind | null {
  if (!term.startsWith('FIELD_')) return null;
  return term.slice(6) as CBLFieldKind;
}

// ─── CBL Concept ─────────────────────────────────────────────────────────

/**
 * A single business concept in the CBL vocabulary.
 * This is the runtime representation of an entry in the CBL.
 */
export interface CBLConcept {
  readonly term: CBLTerm;
  readonly kind: 'entity' | 'field' | 'relationship';
  readonly domain: CBLDomainKind;
  readonly aliases: string[];
  readonly description: string;
  readonly isBuiltIn: boolean;
  readonly addedAt?: Date;
}

// ─── CBL Registry ─────────────────────────────────────────────────────────

/**
 * Runtime registry of all CBL concepts.
 * Allows extending the CBL with custom terms.
 */
export interface CBLRegistry {
  register(concept: CBLConcept): void;
  get(term: string): CBLConcept | null;
  has(term: string): boolean;
  getAllEntities(): CBLConcept[];
  getAllFields(): CBLConcept[];
  getAllByDomain(domain: CBLDomainKind): CBLConcept[];
  getAliases(term: string): string[];
  findByAlias(alias: string): CBLConcept | null;
  count(): number;
}
