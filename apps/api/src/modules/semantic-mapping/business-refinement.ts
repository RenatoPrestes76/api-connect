import type {
  DiscoveredRelationship,
  EntityClassification,
  EntityType,
} from '@seltriva/database-intelligence';
import type { BusinessEntityCandidate, BusinessEntityType, MappingReason } from './types.js';

/** Bumped whenever the refinement rules below change meaning — persisted on every suggestion/history entry so re-analyses can be told apart from a genuine model upgrade. */
export const SEMANTIC_MODEL_VERSION = 1;

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
  LOT: 'NAO_MAPEADO',
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
} {
  const { tableName, entity, confidence, isJunctionTable } = classification;
  const baseEntity = ATHENA_TO_BUSINESS[entity];
  const reasons: MappingReason[] = [
    {
      signal: 'athena_classification',
      weight: confidence,
      detail: `ATHENA classified this table structurally as ${entity} (confidence ${confidence})`,
    },
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

  return { suggestedEntity: resultEntity, confidence: resultConfidence, reasons, alternatives };
}
