import { describe, it, expect } from 'vitest';
import type {
  DiscoveredRelationship,
  EntityClassification,
  EntityType,
  DatabaseIntelligenceReport,
} from '@seltriva/database-intelligence';
import {
  refineClassification,
  SEMANTIC_MODEL_VERSION,
} from '../../modules/semantic-mapping/business-refinement.js';
import { analyzeReport } from '../../modules/semantic-mapping/semantic-mapping-engine.js';
import { ALL_BUSINESS_ENTITY_TYPES } from '../../modules/semantic-mapping/types.js';

// ─── Test fixtures ──────────────────────────────────────────────────────────

function classification(overrides: Partial<EntityClassification> = {}): EntityClassification {
  return {
    tableSchema: 'public',
    tableName: 'some_table',
    entity: 'UNKNOWN',
    confidence: 0,
    reasons: [{ signal: 'name_match', weight: 10, detail: 'stub reason for test fixture' }],
    alternatives: [],
    fieldRoles: new Map(),
    isAuxiliary: false,
    isJunctionTable: false,
    estimatedRows: 100,
    ...overrides,
  };
}

function relationship(overrides: Partial<DiscoveredRelationship> = {}): DiscoveredRelationship {
  return {
    fromSchema: 'public',
    fromTable: 'from_table',
    fromColumn: 'ref_id',
    toSchema: 'public',
    toTable: 'to_table',
    toColumn: 'id',
    kind: 'ONE_TO_MANY',
    cardinality: 'N:1',
    constraintName: 'fk_stub',
    confidence: 90,
    reasons: [],
    ...overrides,
  };
}

const NO_RELATIONSHIPS: readonly DiscoveredRelationship[] = [];
const EMPTY_ENTITY_MAP: ReadonlyMap<string, EntityType> = new Map();

// ─── 1. Direct ATHENA → business mapping (no refinement override) ─────────

describe('refineClassification — direct ATHENA structural entity mapping', () => {
  const directMappings: Array<[EntityType, string]> = [
    ['PRODUCT', 'PRODUTO'],
    ['SUPPLIER', 'FORNECEDOR'],
    ['CATEGORY', 'CATEGORIA'],
    ['PRICE', 'PRECO'],
    ['INVENTORY', 'ESTOQUE'],
    ['MOVEMENT', 'MOVIMENTACAO_ESTOQUE'],
    ['CUSTOMER', 'CLIENTE'],
    ['BRANCH', 'FILIAL'],
    ['PROMOTION', 'PROMOCAO'],
    ['LOT', 'LOTE'],
  ];

  for (const [athenaEntity, businessEntity] of directMappings) {
    it(`maps ATHENA ${athenaEntity} to business entity ${businessEntity}`, () => {
      const result = refineClassification(
        classification({ tableName: 'generic_table', entity: athenaEntity, confidence: 80 }),
        NO_RELATIONSHIPS,
        EMPTY_ENTITY_MAP
      );
      expect(result.suggestedEntity).toBe(businessEntity);
    });
  }

  it('maps unrecognized ATHENA structural types to NAO_MAPEADO', () => {
    for (const athenaEntity of [
      'FISCAL',
      'LOG',
      'AUDIT',
      'PERMISSION',
      'CONFIGURATION',
      'LOOKUP',
      'UNKNOWN',
      'EXPIRY',
    ] as const) {
      const result = refineClassification(
        classification({ tableName: 'aux_table_xyz', entity: athenaEntity, confidence: 50 }),
        NO_RELATIONSHIPS,
        EMPTY_ENTITY_MAP
      );
      expect(result.suggestedEntity).toBe('NAO_MAPEADO');
    }
  });
});

// ─── 2. Name-pattern refinement rules (one signal each) ────────────────────

describe('refineClassification — name-pattern refinement rules (individual signals)', () => {
  it('detects Brand (MARCA) from a name alias with no dedicated ATHENA type', () => {
    const result = refineClassification(
      classification({ tableName: 'marcas', entity: 'UNKNOWN', confidence: 20 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('MARCA');
    expect(result.reasons.some((r) => r.signal === 'brand_name_alias')).toBe(true);
  });

  it('detects Unit of measure (UNIDADE) from a name alias', () => {
    const result = refineClassification(
      classification({ tableName: 'unidades_medida', entity: 'UNKNOWN', confidence: 20 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('UNIDADE');
  });

  it('detects a physical inventory count/reconciliation table (INVENTARIO)', () => {
    const result = refineClassification(
      classification({ tableName: 'inventario_fisico', entity: 'AUDIT', confidence: 30 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('INVENTARIO');
  });

  it('detects Warehouse (DEPOSITO) from a name alias', () => {
    const result = refineClassification(
      classification({ tableName: 'depositos', entity: 'UNKNOWN', confidence: 20 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('DEPOSITO');
    expect(result.reasons.some((r) => r.signal === 'warehouse_name_alias')).toBe(true);
  });

  it('detects Payment (PAGAMENTO) from a name alias', () => {
    const result = refineClassification(
      classification({ tableName: 'pagamentos', entity: 'UNKNOWN', confidence: 20 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('PAGAMENTO');
    expect(result.reasons.some((r) => r.signal === 'payment_name_alias')).toBe(true);
  });

  it('detects Employee (FUNCIONARIO), distinct from a generic system User', () => {
    const result = refineClassification(
      classification({ tableName: 'funcionarios', entity: 'USER', confidence: 40 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('FUNCIONARIO');
    expect(result.reasons.some((r) => r.signal === 'employee_name_alias')).toBe(true);
  });

  it('detects a point-of-sale Operator (OPERADOR), distinct from a generic system User', () => {
    const result = refineClassification(
      classification({ tableName: 'operadores', entity: 'USER', confidence: 40 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('OPERADOR');
  });

  it('keeps a generic login table as USUARIO (does not misfire the operator alias)', () => {
    const result = refineClassification(
      classification({ tableName: 'usuarios', entity: 'USER', confidence: 70 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('USUARIO');
  });
});

// ─── 3. Multi-signal combination (name + relationship) ─────────────────────

describe('refineClassification — combining multiple signals (name + relationship)', () => {
  it('classifies a purchase line-item table (ITEM_COMPRA) from header + product relationships', () => {
    const entityByTable = new Map<string, EntityType>([
      ['compras', 'PURCHASE'],
      ['produtos', 'PRODUCT'],
    ]);
    const relationships = [
      relationship({ fromTable: 'compras_itens', toTable: 'compras' }),
      relationship({ fromTable: 'compras_itens', toTable: 'produtos' }),
    ];
    const result = refineClassification(
      classification({
        tableName: 'compras_itens',
        entity: 'PURCHASE',
        confidence: 35,
        isJunctionTable: true,
      }),
      relationships,
      entityByTable
    );
    expect(result.suggestedEntity).toBe('ITEM_COMPRA');
    expect(result.reasons.some((r) => r.signal === 'line_item_shape')).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(35);
  });

  it('classifies a sale line-item table (ITEM_VENDA) from header + product relationships', () => {
    const entityByTable = new Map<string, EntityType>([
      ['vendas', 'SALE'],
      ['produtos', 'PRODUCT'],
    ]);
    const relationships = [
      relationship({ fromTable: 'vendas_itens', toTable: 'vendas' }),
      relationship({ fromTable: 'vendas_itens', toTable: 'produtos' }),
    ];
    const result = refineClassification(
      classification({
        tableName: 'vendas_itens',
        entity: 'SALE',
        confidence: 35,
        isJunctionTable: true,
      }),
      relationships,
      entityByTable
    );
    expect(result.suggestedEntity).toBe('ITEM_VENDA');
  });

  it('reinforces a Product Variant (VARIANTE_PRODUTO) classification with a product-FK relationship', () => {
    const entityByTable = new Map<string, EntityType>([['produtos', 'PRODUCT']]);
    const relationships = [relationship({ fromTable: 'produto_variacoes', toTable: 'produtos' })];
    const withRelationship = refineClassification(
      classification({ tableName: 'produto_variacoes', entity: 'UNKNOWN', confidence: 20 }),
      relationships,
      entityByTable
    );
    const withoutRelationship = refineClassification(
      classification({ tableName: 'produto_variacoes', entity: 'UNKNOWN', confidence: 20 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(withRelationship.suggestedEntity).toBe('VARIANTE_PRODUTO');
    expect(withoutRelationship.suggestedEntity).toBe('VARIANTE_PRODUTO');
    expect(withRelationship.reasons.some((r) => r.signal === 'variant_product_relationship')).toBe(
      true
    );
    // Two independent signals (name + relationship) must outscore name alone.
    expect(withRelationship.confidence).toBeGreaterThan(withoutRelationship.confidence);
  });
});

// ─── 4. Confidence must be explainable ─────────────────────────────────────

describe('refineClassification — explainable confidence', () => {
  it('always returns at least one reason with a signal/weight/detail', () => {
    const result = refineClassification(
      classification({ tableName: 'produtos', entity: 'PRODUCT', confidence: 92 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(typeof reason.signal).toBe('string');
      expect(typeof reason.weight).toBe('number');
      expect(typeof reason.detail).toBe('string');
      expect(reason.detail.length).toBeGreaterThan(0);
    }
  });

  it("propagates ATHENA's own granular per-signal reasons (name/column/relationship/etc.), not just one collapsed reason", () => {
    const result = refineClassification(
      classification({
        tableName: 'produtos',
        entity: 'PRODUCT',
        confidence: 92,
        reasons: [
          { signal: 'strong_name_match', weight: 35, detail: 'Table name matches "produto*"' },
          { signal: 'sku_column', weight: 20, detail: 'Has a SKU-shaped identifier column' },
          { signal: 'price_relationship', weight: 15, detail: 'Related to a PRICE table' },
        ],
      }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.reasons.some((r) => r.signal === 'strong_name_match')).toBe(true);
    expect(result.reasons.some((r) => r.signal === 'sku_column')).toBe(true);
    expect(result.reasons.some((r) => r.signal === 'price_relationship')).toBe(true);
    expect(result.reasoning).toMatch(/structural signal/i);
  });
});

// ─── 5. Conflicts ───────────────────────────────────────────────────────────

describe('refineClassification — conflict detection', () => {
  it('flags a conflict and dampens confidence when the top alternative is close to the suggestion', () => {
    const result = refineClassification(
      classification({
        tableName: 'ambiguous_table',
        entity: 'PRODUCT',
        confidence: 55,
        alternatives: [{ entity: 'INVENTORY', confidence: 48 }],
      }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0]?.entityA).toBe('PRODUTO');
    expect(result.conflicts[0]?.entityB).toBe('ESTOQUE');
    expect(result.confidence).toBeLessThan(55);
    expect(result.reasoning).toMatch(/conflict/i);
  });

  it('does not flag a conflict when the top alternative is far behind the suggestion', () => {
    const result = refineClassification(
      classification({
        tableName: 'confident_table',
        entity: 'PRODUCT',
        confidence: 90,
        alternatives: [{ entity: 'INVENTORY', confidence: 20 }],
      }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.conflicts).toHaveLength(0);
    expect(result.confidence).toBe(90);
  });

  it('does not flag a confident dictionary-driven override (e.g. line-item detection) as a conflict', () => {
    const entityByTable = new Map<string, EntityType>([
      ['compras', 'PURCHASE'],
      ['produtos', 'PRODUCT'],
    ]);
    const relationships = [
      relationship({ fromTable: 'compras_itens', toTable: 'compras' }),
      relationship({ fromTable: 'compras_itens', toTable: 'produtos' }),
    ];
    const result = refineClassification(
      classification({
        tableName: 'compras_itens',
        entity: 'PURCHASE',
        confidence: 35,
        isJunctionTable: true,
      }),
      relationships,
      entityByTable
    );
    expect(result.conflicts).toHaveLength(0);
  });
});

// ─── 6. Insufficient signals / ambiguous classification ────────────────────

describe('refineClassification — insufficient signals', () => {
  it('reports a low-confidence, unmapped classification with an explanatory reasoning string', () => {
    const result = refineClassification(
      classification({ tableName: 'zz_random_stub', entity: 'UNKNOWN', confidence: 5 }),
      NO_RELATIONSHIPS,
      EMPTY_ENTITY_MAP
    );
    expect(result.suggestedEntity).toBe('NAO_MAPEADO');
    expect(result.reasoning).toMatch(/insufficient|inconclusive/i);
  });
});

// ─── 7. Versioning ──────────────────────────────────────────────────────────

describe('semantic model versioning', () => {
  it('exposes a numeric SEMANTIC_MODEL_VERSION', () => {
    expect(typeof SEMANTIC_MODEL_VERSION).toBe('number');
    expect(SEMANTIC_MODEL_VERSION).toBeGreaterThanOrEqual(1);
  });
});

// ─── 8. All 18 minimum ERP entities are members of the vocabulary ─────────

describe('ALL_BUSINESS_ENTITY_TYPES — 18 minimum ERP entities', () => {
  const REQUIRED_MINIMUM_ENTITIES: readonly string[] = [
    'PRODUTO', // Product
    'CATEGORIA', // ProductCategory
    'MARCA', // ProductBrand
    'VARIANTE_PRODUTO', // ProductVariant
    'ESTOQUE', // Stock
    'MOVIMENTACAO_ESTOQUE', // StockMovement
    'DEPOSITO', // Warehouse
    'FILIAL', // Branch
    'FORNECEDOR', // Supplier
    'CLIENTE', // Customer
    'COMPRA', // Purchase
    'ITEM_COMPRA', // PurchaseItem
    'VENDA', // Sale
    'ITEM_VENDA', // SaleItem
    'PRECO', // Price
    'PAGAMENTO', // Payment
    'FUNCIONARIO', // Employee
    'LOTE', // InventoryLot
  ];

  it('recognizes all 18 required categories', () => {
    for (const entity of REQUIRED_MINIMUM_ENTITIES) {
      expect(ALL_BUSINESS_ENTITY_TYPES).toContain(entity);
    }
    expect(REQUIRED_MINIMUM_ENTITIES).toHaveLength(18);
  });
});

// ─── 9. analyzeReport() — report-to-suggestions wiring ─────────────────────

describe('analyzeReport', () => {
  function buildReport(
    entities: Partial<Record<EntityType, EntityClassification[]>>,
    relationships: DiscoveredRelationship[] = []
  ): DatabaseIntelligenceReport {
    return {
      generatedAt: new Date().toISOString(),
      durationMs: 1,
      database: 'test_db',
      host: 'localhost',
      port: 5432,
      summary: {
        totalTables: Object.values(entities).flat().length,
        classifiedTables: Object.values(entities).flat().length,
        overallConfidence: 80,
        hasRisks: false,
      },
      entities,
      relationships,
      knowledgeGraph: { nodes: [], edges: [] },
      risks: [],
      suggestions: [],
      ui: { entityMap: [], relationshipMap: [], heatmap: [] },
    } as unknown as DatabaseIntelligenceReport;
  }

  it('turns a cached DatabaseIntelligenceReport into one suggestion per discovered table, without touching a database', () => {
    const report = buildReport({
      PRODUCT: [classification({ tableName: 'produtos', entity: 'PRODUCT', confidence: 90 })],
      SUPPLIER: [classification({ tableName: 'fornecedores', entity: 'SUPPLIER', confidence: 85 })],
    });

    const suggestions = analyzeReport(report);
    expect(suggestions).toHaveLength(2);
    const produtos = suggestions.find((s) => s.table === 'produtos');
    expect(produtos?.suggestedEntity).toBe('PRODUTO');
    expect(produtos?.athenaEntity).toBe('PRODUCT');
    expect(produtos?.schema).toBe('public');
    expect(produtos?.reasoning.length).toBeGreaterThan(0);
    expect(Array.isArray(produtos?.conflicts)).toBe(true);
  });

  it('returns an empty array for a report with no discovered entities', () => {
    expect(analyzeReport(buildReport({}))).toEqual([]);
  });
});
