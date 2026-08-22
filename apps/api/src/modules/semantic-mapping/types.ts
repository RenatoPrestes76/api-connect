import type { EntityType, ConfidenceScore } from '@seltriva/database-intelligence';

// ─── Business Entity Vocabulary ────────────────────────────────────────────
//
// ATHENA (packages/database-intelligence) classifies tables into a
// *structural* EntityType taxonomy (PRODUCT, SALE, USER, ...). This module
// refines that structural classification into the fuller *business*
// vocabulary the ERP integration team actually reasons in, without
// re-consulting the customer's database and without adding a dependency on
// any live DB driver — it only reads the DatabaseIntelligenceReport already
// produced and cached by the erp-metadata module (Sprint 46.9).

export type BusinessEntityType =
  | 'PRODUTO'
  | 'CATEGORIA'
  | 'MARCA'
  | 'VARIANTE_PRODUTO'
  | 'ESTOQUE'
  | 'MOVIMENTACAO_ESTOQUE'
  | 'DEPOSITO'
  | 'FILIAL'
  | 'FORNECEDOR'
  | 'CLIENTE'
  | 'COMPRA'
  | 'ITEM_COMPRA'
  | 'VENDA'
  | 'ITEM_VENDA'
  | 'PRECO'
  | 'PAGAMENTO'
  | 'FUNCIONARIO'
  | 'LOTE'
  | 'USUARIO'
  | 'OPERADOR'
  | 'PROMOCAO'
  | 'UNIDADE'
  | 'INVENTARIO'
  | 'NAO_MAPEADO';

/**
 * The 18 minimum ERP business entities this engine must recognize
 * (Product, ProductCategory, ProductBrand, ProductVariant, Stock,
 * StockMovement, Warehouse, Branch, Supplier, Customer, Purchase,
 * PurchaseItem, Sale, SaleItem, Price, Payment, Employee, InventoryLot),
 * plus additional categories (USUARIO/OPERADOR/PROMOCAO/UNIDADE/INVENTARIO)
 * this engine already recognized beyond that minimum, plus the NAO_MAPEADO
 * catch-all.
 */
export const ALL_BUSINESS_ENTITY_TYPES: readonly BusinessEntityType[] = [
  'PRODUTO',
  'CATEGORIA',
  'MARCA',
  'VARIANTE_PRODUTO',
  'ESTOQUE',
  'MOVIMENTACAO_ESTOQUE',
  'DEPOSITO',
  'FILIAL',
  'FORNECEDOR',
  'CLIENTE',
  'COMPRA',
  'ITEM_COMPRA',
  'VENDA',
  'ITEM_VENDA',
  'PRECO',
  'PAGAMENTO',
  'FUNCIONARIO',
  'LOTE',
  'USUARIO',
  'OPERADOR',
  'PROMOCAO',
  'UNIDADE',
  'INVENTARIO',
  'NAO_MAPEADO',
];

/** A single piece of evidence that contributed to a business-entity suggestion. */
export interface MappingReason {
  readonly signal: string;
  readonly weight: number;
  readonly detail: string;
}

/** One ranked candidate for a table's business entity — powers conflict resolution in the review UI. */
export interface BusinessEntityCandidate {
  readonly entity: BusinessEntityType;
  readonly confidence: ConfidenceScore;
}

/**
 * A detected disagreement between evidence sources (e.g. table name suggests
 * one entity while relational structure suggests another). Conflicts never
 * hide a classification — they are surfaced alongside it so a human reviewer
 * can see exactly where the signals disagreed.
 */
export interface MappingConflict {
  readonly entityA: BusinessEntityType;
  readonly entityB: BusinessEntityType;
  readonly detail: string;
}

/** The engine's output for a single table, before any persistence/review state is applied. */
export interface MappingSuggestion {
  readonly schema: string;
  readonly table: string;
  readonly athenaEntity: EntityType;
  readonly suggestedEntity: BusinessEntityType;
  readonly confidence: ConfidenceScore;
  readonly reasons: readonly MappingReason[];
  readonly alternatives: readonly BusinessEntityCandidate[];
  readonly conflicts: readonly MappingConflict[];
  /** One-line human-readable synthesis of `reasons` (+ `conflicts`, when present). */
  readonly reasoning: string;
}

export type MappingStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MappingHistoryAction =
  | 'SUGGESTED'
  | 'RESUGGESTED'
  | 'APPROVED'
  | 'OVERRIDDEN'
  | 'REJECTED'
  | 'PRESERVED_ON_REANALYSIS';

export interface MappingHistoryEntry {
  readonly action: MappingHistoryAction;
  readonly entity: BusinessEntityType;
  readonly confidence: ConfidenceScore | null;
  readonly modelVersion: number;
  readonly actorEmail: string | null;
  readonly createdAt: string;
}

/** Persisted mapping state for one (profileId, schema, table). */
export interface MappingRecord {
  readonly profileId: string;
  readonly schema: string;
  readonly table: string;
  status: MappingStatus;
  athenaEntity: EntityType;
  suggestedEntity: BusinessEntityType;
  suggestedConfidence: ConfidenceScore;
  reasons: readonly MappingReason[];
  alternatives: readonly BusinessEntityCandidate[];
  conflicts: readonly MappingConflict[];
  reasoning: string;
  approvedEntity: BusinessEntityType | null;
  approvedBy: string | null;
  approvedAt: string | null;
  modelVersion: number;
  createdAt: string;
  updatedAt: string;
  history: MappingHistoryEntry[];
}

export interface MappingRecordDTO {
  profileId: string;
  schema: string;
  table: string;
  status: MappingStatus;
  athenaEntity: EntityType;
  suggestedEntity: BusinessEntityType;
  suggestedConfidence: ConfidenceScore;
  reasons: readonly MappingReason[];
  alternatives: readonly BusinessEntityCandidate[];
  conflicts: readonly MappingConflict[];
  reasoning: string;
  approvedEntity: BusinessEntityType | null;
  approvedBy: string | null;
  approvedAt: string | null;
  modelVersion: number;
  createdAt: string;
  updatedAt: string;
  history: readonly MappingHistoryEntry[];
}

export interface AnalyzeSummary {
  readonly profileId: string;
  readonly modelVersion: number;
  readonly analyzedAt: string;
  readonly tablesAnalyzed: number;
  readonly suggested: number;
  readonly resuggested: number;
  readonly preserved: number;
  readonly pending: number;
  readonly approved: number;
}

export type AnalyzeError = 'NOT_DISCOVERED';

export type ApproveDecision = 'APPROVE' | 'REJECT';

export interface ApproveInput {
  readonly profileId: string;
  readonly schema: string;
  readonly table: string;
  readonly decision: ApproveDecision;
  /** Overrides the suggested entity — e.g. picking a runner-up from `alternatives`. Ignored on REJECT. */
  readonly entity?: BusinessEntityType;
  readonly actorEmail: string;
}

export type ApproveError = 'NOT_ANALYZED' | 'INVALID_ENTITY';
