import type {
  DiscoveredRelationship,
  EntityClassification,
  EntityType,
} from '@seltriva/database-intelligence';
import type {
  BusinessEntityCandidate,
  BusinessEntityType,
  MappingConflict,
  MappingReason,
} from './types.js';

/** Bumped whenever the refinement rules below change meaning — persisted on every suggestion/history entry so re-analyses can be told apart from a genuine model upgrade. */
export const SEMANTIC_MODEL_VERSION = 2;

// ─── ATHENA structural entity → business entity (base mapping) ────────────
const ATHENA_TO_BUSINESS: Readonly<Record<EntityType, BusinessEntityType>> = {
  PRODUCT: 'PRODUTO',
  SUPPLIER: 'FORNECEDOR',
  CATEGORY: 'CATEGORIA',
  PRICE: 'PRECO',
  INVENTORY: 'ESTOQUE',
  MOVEMENT: 'MOVIMENTACAO_ESTOQUE',
  SALE: 'VENDA',
  PURCHASE: 'COMPRA',
  CUSTOMER: 'CLIENTE',
  USER: 'USUARIO',
  BRANCH: 'FILIAL',
  EXPIRY: 'NAO_MAPEADO',
  // ATHENA already recognizes lot/batch tables structurally — reuse that
  // signal instead of discarding it (InventoryLot is one of the 18 minimum
  // business entities this engine must recognize).
  LOT: 'LOTE',
  PROMOTION: 'PROMOCAO',
  FISCAL: 'NAO_MAPEADO',
  LOG: 'NAO_MAPEADO',
  AUDIT: 'NAO_MAPEADO',
  PERMISSION: 'NAO_MAPEADO',
  CONFIGURATION: 'NAO_MAPEADO',
  LOOKUP: 'NAO_MAPEADO',
  UNKNOWN: 'NAO_MAPEADO',
};

function normalize(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchesAny(name: string, patterns: readonly string[]): boolean {
  const n = normalize(name);
  return patterns.some((p) => n.includes(p));
}

const LINE_ITEM_PATTERNS = ['item', 'itens', 'linha', 'lines', 'detalhe', 'detail'];
const OPERATOR_PATTERNS = [
  'operador',
  'operadores',
  'vendedor',
  'vendedores',
  'caixa',
  'atendente',
];
const USER_CORE_PATTERNS = ['usuario', 'usuarios', 'login', 'user', 'users'];
const BRAND_PATTERNS = ['marca', 'marcas', 'brand', 'brands', 'fabricante', 'fabricantes'];
const UNIT_PATTERNS = [
  'unidade_medida',
  'unidademedida',
  'un_medida',
  'unidade',
  'unidades',
  'uom',
  'unit_of_measure',
  'unitofmeasure',
];
const INVENTORY_AUDIT_PATTERNS = ['inventario', 'contagem', 'balanco_estoque', 'balancoestoque'];
const WAREHOUSE_PATTERNS = [
  'deposito',
  'depositos',
  'armazem',
  'armazens',
  'almoxarifado',
  'warehouse',
  'warehouses',
];
const PAYMENT_PATTERNS = [
  'pagamento',
  'pagamentos',
  'recebimento',
  'recebimentos',
  'payment',
  'payments',
  'pagto',
];
const EMPLOYEE_PATTERNS = [
  'funcionario',
  'funcionarios',
  'colaborador',
  'colaboradores',
  'employee',
  'employees',
];
const PRODUCT_VARIANT_PATTERNS = [
  'variacao',
  'variacoes',
  'variante',
  'variantes',
  'variant',
  'variants',
];

/**
 * Refines one ATHENA classification into the fuller business vocabulary.
 * Pure and dictionary-driven — new business entities are added by extending
 * the pattern lists above, not by touching this function's logic.
 *
 * `entityByTable` is ATHENA's own per-table classification for every other
 * table in the schema — line-item detection relies on it because a line-item
 * table's *own* structural signals are frequently ambiguous (its columns are
 * mostly FKs + a quantity, which score weakly and inconsistently across
 * PURCHASE/SALE/INVENTORY/MOVEMENT), while what it points to is not: an FK to
 * a table ATHENA confidently called PURCHASE or SALE, plus an FK to a table
 * ATHENA called PRODUCT, is a far stronger signal than the line-item table's
 * own top-scored guess.
 */
export function refineClassification(
  classification: EntityClassification,
  allRelationships: readonly DiscoveredRelationship[],
  entityByTable: ReadonlyMap<string, EntityType>
): {
  suggestedEntity: BusinessEntityType;
  confidence: number;
  reasons: MappingReason[];
  alternatives: BusinessEntityCandidate[];
  conflicts: MappingConflict[];
  reasoning: string;
} {
  const { tableName, entity, confidence, isJunctionTable } = classification;
  const baseEntity = ATHENA_TO_BUSINESS[entity];
  // Summary line first, then every individual signal ATHENA's own scorers
  // (name/column/relationship/statistics/sampling) already computed — this is
  // what makes the "multiple independent structural signals" explanation
  // genuine rather than a single opaque pass-through score.
  const reasons: MappingReason[] = [
    {
      signal: 'athena_classification',
      weight: confidence,
      detail: `ATHENA classified this table structurally as ${entity} (confidence ${confidence})`,
    },
    ...classification.reasons,
  ];

  let resultEntity: BusinessEntityType = baseEntity;
  let resultConfidence = confidence;

  // ─── Purchase/Sale line-item detection ───────────────────────────────────
  const outgoing = allRelationships.filter((r) => r.fromTable === tableName);
  const headerTarget = outgoing.find((r) => {
    const targetEntity = entityByTable.get(r.toTable);
    return targetEntity === 'PURCHASE' || targetEntity === 'SALE';
  });
  const pointsToProduct = outgoing.some(
    (r) =>
      entityByTable.get(r.toTable) === 'PRODUCT' || matchesAny(r.toTable, ['produto', 'product'])
  );
  const namedLikeLineItem = matchesAny(tableName, LINE_ITEM_PATTERNS);

  if (
    headerTarget &&
    pointsToProduct &&
    (isJunctionTable || namedLikeLineItem || outgoing.length >= 2)
  ) {
    const headerEntity = entityByTable.get(headerTarget.toTable);
    resultEntity = headerEntity === 'PURCHASE' ? 'ITEM_COMPRA' : 'ITEM_VENDA';
    resultConfidence = Math.max(confidence, 70);
    reasons.push({
      signal: 'line_item_shape',
      weight: 30,
      detail: `Points to "${headerTarget.toTable}" (${headerEntity}) and a product table — classified as a line-item table rather than ATHENA's own top pick`,
    });
  } else if ((entity === 'PURCHASE' || entity === 'SALE') && baseEntity !== 'NAO_MAPEADO') {
    // No distinguishable header table (denormalized schema) — fall back to
    // the table's own name/junction shape.
    const looksLikeLineItem = isJunctionTable || namedLikeLineItem;
    if (looksLikeLineItem) {
      resultEntity = entity === 'PURCHASE' ? 'ITEM_COMPRA' : 'ITEM_VENDA';
      resultConfidence = Math.min(100, confidence + 5);
      reasons.push({
        signal: 'line_item_shape',
        weight: 5,
        detail: `Table name/junction shape indicate a line-item table for ${baseEntity}`,
      });
    }
  }

  // ─── Operator vs. generic User ────────────────────────────────────────────
  if (
    entity === 'USER' &&
    matchesAny(tableName, OPERATOR_PATTERNS) &&
    !matchesAny(tableName, USER_CORE_PATTERNS)
  ) {
    resultEntity = 'OPERADOR';
    reasons.push({
      signal: 'operator_name_alias',
      weight: 10,
      detail: 'Table name matches an operator/salesperson alias rather than a generic user alias',
    });
  }

  // ─── Brand (no dedicated ATHENA structural type) ─────────────────────────
  if (matchesAny(tableName, BRAND_PATTERNS)) {
    resultEntity = 'MARCA';
    resultConfidence = Math.max(resultConfidence, 60);
    reasons.push({
      signal: 'brand_name_alias',
      weight: 20,
      detail: 'Table name matches a brand/manufacturer alias',
    });
  }

  // ─── Unit of measure (no dedicated ATHENA structural type) ───────────────
  if (matchesAny(tableName, UNIT_PATTERNS)) {
    resultEntity = 'UNIDADE';
    resultConfidence = Math.max(resultConfidence, 60);
    reasons.push({
      signal: 'unit_name_alias',
      weight: 20,
      detail: 'Table name matches a unit-of-measure alias',
    });
  }

  // ─── Inventory audit/count vs. running stock levels ──────────────────────
  if ((entity === 'AUDIT' || entity === 'LOG') && matchesAny(tableName, INVENTORY_AUDIT_PATTERNS)) {
    resultEntity = 'INVENTARIO';
    resultConfidence = Math.max(resultConfidence, 55);
    reasons.push({
      signal: 'inventory_audit_name_alias',
      weight: 15,
      detail: 'Table name matches a physical inventory count/reconciliation alias',
    });
  }

  // ─── Warehouse (no dedicated ATHENA structural type) ─────────────────────
  if (matchesAny(tableName, WAREHOUSE_PATTERNS)) {
    resultEntity = 'DEPOSITO';
    resultConfidence = Math.max(resultConfidence, 60);
    reasons.push({
      signal: 'warehouse_name_alias',
      weight: 20,
      detail: 'Table name matches a warehouse/storage-location alias',
    });
  }

  // ─── Payment (no dedicated ATHENA structural type) ───────────────────────
  if (matchesAny(tableName, PAYMENT_PATTERNS)) {
    resultEntity = 'PAGAMENTO';
    resultConfidence = Math.max(resultConfidence, 60);
    reasons.push({
      signal: 'payment_name_alias',
      weight: 20,
      detail: 'Table name matches a payment/receipt alias',
    });
  }

  // ─── Employee (distinct from a system login User) ────────────────────────
  if (matchesAny(tableName, EMPLOYEE_PATTERNS)) {
    resultEntity = 'FUNCIONARIO';
    resultConfidence = Math.max(resultConfidence, 60);
    reasons.push({
      signal: 'employee_name_alias',
      weight: 20,
      detail: 'Table name matches an employee/staff alias, distinct from a system-login user',
    });
  }

  // ─── Product variant (name alias, reinforced by a relational FK to a
  // table ATHENA already classified as PRODUCT) ─────────────────────────────
  if (matchesAny(tableName, PRODUCT_VARIANT_PATTERNS)) {
    resultEntity = 'VARIANTE_PRODUTO';
    resultConfidence = Math.max(resultConfidence, 55);
    reasons.push({
      signal: 'product_variant_name_alias',
      weight: 15,
      detail: 'Table name matches a product-variation alias (color/size/SKU variant)',
    });
    const variantPointsToProduct = allRelationships.some(
      (r) =>
        r.fromTable === tableName &&
        (entityByTable.get(r.toTable) === 'PRODUCT' ||
          matchesAny(r.toTable, ['produto', 'product']))
    );
    if (variantPointsToProduct) {
      resultConfidence = Math.min(100, resultConfidence + 15);
      reasons.push({
        signal: 'variant_product_relationship',
        weight: 15,
        detail:
          'Foreign key points to a table classified as PRODUCT — reinforces the product-variant classification',
      });
    }
  }

  // ─── Alternatives (conflict resolution) ──────────────────────────────────
  // Base candidate (if the refinement rules moved away from it) plus every
  // ATHENA alternative mapped through the same base table, ranked and deduped.
  const candidateMap = new Map<BusinessEntityType, number>();
  if (resultEntity !== baseEntity && baseEntity !== 'NAO_MAPEADO') {
    candidateMap.set(baseEntity, confidence);
  }
  for (const alt of classification.alternatives) {
    const mapped = ATHENA_TO_BUSINESS[alt.entity];
    if (mapped === 'NAO_MAPEADO' || mapped === resultEntity) continue;
    const existing = candidateMap.get(mapped);
    if (existing === undefined || alt.confidence > existing) {
      candidateMap.set(mapped, alt.confidence);
    }
  }
  const alternatives = Array.from(candidateMap.entries())
    .map(([candidateEntity, candidateConfidence]) => ({
      entity: candidateEntity,
      confidence: candidateConfidence,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  // ─── Conflicts ────────────────────────────────────────────────────────────
  // A conflict is genuine evidence disagreement — the top candidate and the
  // runner-up are close enough in confidence that the signals do not clearly
  // agree on a single entity (e.g. name evidence points one way, relational
  // evidence points another, and neither dominates). This is deliberately
  // NOT raised for the dictionary-driven overrides above (line-item, brand,
  // unit, warehouse, payment, employee, variant, operator, inventory-audit):
  // those are confident domain-knowledge corrections of a known-weak base
  // signal, not unresolved disagreement, so they must not be flagged or have
  // their confidence penalized.
  const CONFLICT_GAP_THRESHOLD = 15;
  const conflicts: MappingConflict[] = [];
  const topAlternative = alternatives[0];
  if (topAlternative && resultConfidence - topAlternative.confidence <= CONFLICT_GAP_THRESHOLD) {
    conflicts.push({
      entityA: resultEntity,
      entityB: topAlternative.entity,
      detail: `Suggested entity "${resultEntity}" and runner-up "${topAlternative.entity}" are close in confidence (${resultConfidence} vs ${topAlternative.confidence}) — evidence does not clearly agree on a single entity`,
    });
    resultConfidence = Math.max(0, resultConfidence - 10);
  }

  // ─── Reasoning (human-readable synthesis) ────────────────────────────────
  let reasoning: string;
  if (resultEntity === 'NAO_MAPEADO' || resultConfidence < 30) {
    reasoning = `Insufficient or inconclusive structural signals to confidently classify this table (confidence ${resultConfidence}).`;
  } else if (conflicts.length > 0 && topAlternative) {
    reasoning = `${reasons.length} structural signal(s) were combined, but "${resultEntity}" and "${topAlternative.entity}" remain close in confidence — conflicting evidence detected, human review is recommended.`;
  } else {
    reasoning = `${reasons.length} structural signal(s) consistently indicate a ${resultEntity} entity.`;
  }

  return {
    suggestedEntity: resultEntity,
    confidence: resultConfidence,
    reasons,
    alternatives,
    conflicts,
    reasoning,
  };
}
