import { describe, it, expect } from 'vitest';
import type { CBLEntityKind } from '@seltriva/semantic-engine';
import { CBL_ENTITY_DOMAINS } from '@seltriva/semantic-engine';
import {
  BUSINESS_TO_CBL_ENTITY,
  cblDomainForEntity,
} from '../../modules/canonical-model/cbl-translation.js';
import { ALL_BUSINESS_ENTITY_TYPES } from '../../modules/semantic-mapping/types.js';
import type { BusinessEntityType } from '../../modules/semantic-mapping/types.js';

// ─── Full BusinessEntityType -> CBLEntityKind matrix (Sprint 46.11) ────────

const EXPECTED_MATRIX: ReadonlyArray<[BusinessEntityType, CBLEntityKind]> = [
  // Pre-existing (Sprint 46.10 original 18) — must remain identical.
  ['PRODUTO', 'PRODUCT'],
  ['CATEGORIA', 'CATEGORY'],
  ['MARCA', 'BRAND'],
  ['ESTOQUE', 'INVENTORY'],
  ['MOVIMENTACAO_ESTOQUE', 'INVENTORY_MOVEMENT'],
  ['FILIAL', 'BRANCH'],
  ['FORNECEDOR', 'SUPPLIER'],
  ['CLIENTE', 'CUSTOMER'],
  ['COMPRA', 'PURCHASE_ORDER'],
  ['ITEM_COMPRA', 'PURCHASE_ORDER_LINE'],
  ['VENDA', 'ORDER'],
  ['ITEM_VENDA', 'ORDER_LINE'],
  ['PRECO', 'PRICE_LIST_ITEM'],
  ['USUARIO', 'EMPLOYEE'],
  ['OPERADOR', 'EMPLOYEE'],
  ['PROMOCAO', 'PROMOTION'],
  ['UNIDADE', 'UNIT_OF_MEASURE'],
  ['INVENTARIO', 'INVENTORY_COUNT'],
  // New in Sprint 46.11 — the ATLAS 46.10 reservation.
  ['VARIANTE_PRODUTO', 'PRODUCT_VARIANT'],
  ['DEPOSITO', 'WAREHOUSE'],
  ['PAGAMENTO', 'PAYMENT'],
  ['FUNCIONARIO', 'EMPLOYEE'],
  ['LOTE', 'INVENTORY_LOT'],
];

describe('BUSINESS_TO_CBL_ENTITY — full matrix', () => {
  for (const [businessEntity, cblEntity] of EXPECTED_MATRIX) {
    it(`translates ${businessEntity} -> ${cblEntity}`, () => {
      expect(BUSINESS_TO_CBL_ENTITY[businessEntity]).toBe(cblEntity);
    });
  }

  it('covers every BusinessEntityType except NAO_MAPEADO', () => {
    const covered = ALL_BUSINESS_ENTITY_TYPES.filter((e) => e !== 'NAO_MAPEADO');
    expect(EXPECTED_MATRIX.map(([b]) => b).sort()).toEqual([...covered].sort());
  });

  it('NAO_MAPEADO has no CBL counterpart (never silently falls back to an existing entity)', () => {
    expect(BUSINESS_TO_CBL_ENTITY.NAO_MAPEADO).toBeUndefined();
  });

  it('is deterministic — repeated lookups of the same key always return the same value', () => {
    for (const [businessEntity, cblEntity] of EXPECTED_MATRIX) {
      for (let i = 0; i < 5; i++) {
        expect(BUSINESS_TO_CBL_ENTITY[businessEntity]).toBe(cblEntity);
      }
    }
  });
});

// ─── FUNCIONARIO / USUARIO / OPERADOR convergence on EMPLOYEE ──────────────

describe('EMPLOYEE convergence — FUNCIONARIO joins USUARIO/OPERADOR without displacing them', () => {
  it('all three distinct BusinessEntityTypes map to the same CBLEntityKind', () => {
    expect(BUSINESS_TO_CBL_ENTITY.USUARIO).toBe('EMPLOYEE');
    expect(BUSINESS_TO_CBL_ENTITY.OPERADOR).toBe('EMPLOYEE');
    expect(BUSINESS_TO_CBL_ENTITY.FUNCIONARIO).toBe('EMPLOYEE');
  });

  it('USUARIO and OPERADOR were not changed by adding FUNCIONARIO', () => {
    // Regression guard: this sprint must not touch pre-existing mappings.
    expect(BUSINESS_TO_CBL_ENTITY.USUARIO).toBe('EMPLOYEE');
    expect(BUSINESS_TO_CBL_ENTITY.OPERADOR).toBe('EMPLOYEE');
  });
});

// ─── New entities preserve their own distinct identity ─────────────────────

describe('new entities are not collapsed into a related-but-different entity', () => {
  it('DEPOSITO (Warehouse) stays distinct from FILIAL (Branch) and ESTOQUE (Stock)', () => {
    expect(BUSINESS_TO_CBL_ENTITY.DEPOSITO).toBe('WAREHOUSE');
    expect(BUSINESS_TO_CBL_ENTITY.DEPOSITO).not.toBe(BUSINESS_TO_CBL_ENTITY.FILIAL);
    expect(BUSINESS_TO_CBL_ENTITY.DEPOSITO).not.toBe(BUSINESS_TO_CBL_ENTITY.ESTOQUE);
  });

  it('PAGAMENTO (Payment) stays distinct from VENDA (Sale)', () => {
    expect(BUSINESS_TO_CBL_ENTITY.PAGAMENTO).toBe('PAYMENT');
    expect(BUSINESS_TO_CBL_ENTITY.PAGAMENTO).not.toBe(BUSINESS_TO_CBL_ENTITY.VENDA);
  });

  it('LOTE (InventoryLot) stays distinct from ESTOQUE (Stock) and PRODUTO (Product)', () => {
    expect(BUSINESS_TO_CBL_ENTITY.LOTE).toBe('INVENTORY_LOT');
    expect(BUSINESS_TO_CBL_ENTITY.LOTE).not.toBe(BUSINESS_TO_CBL_ENTITY.ESTOQUE);
    expect(BUSINESS_TO_CBL_ENTITY.LOTE).not.toBe(BUSINESS_TO_CBL_ENTITY.PRODUTO);
  });

  it('VARIANTE_PRODUTO (ProductVariant) stays distinct from PRODUTO (Product)', () => {
    expect(BUSINESS_TO_CBL_ENTITY.VARIANTE_PRODUTO).toBe('PRODUCT_VARIANT');
    expect(BUSINESS_TO_CBL_ENTITY.VARIANTE_PRODUTO).not.toBe(BUSINESS_TO_CBL_ENTITY.PRODUTO);
  });
});

// ─── Domain classification for the new/reused CBL kinds ────────────────────

describe('cblDomainForEntity — domain classification', () => {
  it('resolves a domain for every CBLEntityKind this sprint touches', () => {
    expect(cblDomainForEntity('PRODUCT_VARIANT')).toBe('catalog');
    expect(cblDomainForEntity('WAREHOUSE')).toBe('inventory');
    expect(cblDomainForEntity('PAYMENT')).toBe('finance');
    expect(cblDomainForEntity('EMPLOYEE')).toBe('hr');
    expect(cblDomainForEntity('INVENTORY_LOT')).toBe('inventory');
  });

  it('CBL_ENTITY_DOMAINS remains an exhaustive map (INVENTORY_LOT was added, nothing dropped)', () => {
    expect(CBL_ENTITY_DOMAINS.INVENTORY_LOT).toBe('inventory');
    expect(CBL_ENTITY_DOMAINS.PRODUCT_VARIANT).toBe('catalog');
    expect(CBL_ENTITY_DOMAINS.WAREHOUSE).toBe('inventory');
    expect(CBL_ENTITY_DOMAINS.PAYMENT).toBe('finance');
    expect(CBL_ENTITY_DOMAINS.EMPLOYEE).toBe('hr');
  });
});
