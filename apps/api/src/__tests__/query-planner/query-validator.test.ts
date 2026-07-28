import { describe, it, expect } from 'vitest';
import { validateIntent } from '../../modules/query-planner/query-validator.js';
import { buildTestCanonicalModel } from './model-fixture.js';
import type { QueryIntentInput } from '../../modules/query-planner/types.js';

const ORG = 'org-uqp-test';
const model = buildTestCanonicalModel(ORG);

describe('criação de planos simples', () => {
  it('resolves a simple single-entity plan (products expiring in 30 days)', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'expirationDate', operator: 'LTE', value: { relativeDays: 30 } }],
        projections: ['name', 'barcode', 'expirationDate', 'quantity'],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.rootEntity).toBe('PRODUCT');
    expect(result.resolved.filters).toHaveLength(1);
    expect(result.resolved.projections.map((p) => p.field)).toEqual([
      'name',
      'barcode',
      'expirationDate',
      'quantity',
    ]);
    expect(result.resolved.joins).toHaveLength(0);
  });
});

describe('consultas envolvendo múltiplas entidades (joins)', () => {
  it('resolves a cross-entity filter/projection via a canonical relationship (Inventory -> Product/Branch)', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Inventory',
        filters: [{ field: 'quantity', operator: 'LT', value: { field: 'minimumQuantity' } }],
        projections: ['product.name', 'store.name', 'quantity', 'minimumQuantity'],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.rootEntity).toBe('INVENTORY');
    expect(result.resolved.joins.map((j) => j.alias).sort()).toEqual(['product', 'store']);
    expect(result.resolved.joins.find((j) => j.alias === 'store')?.entity).toBe('BRANCH');
    expect(result.resolved.filters[0]).toMatchObject({
      field: 'quantity',
      operator: 'LT',
      value: { kind: 'field', field: 'minimumQuantity' },
    });
  });

  it('resolves a bare relationship alias projection as a shorthand for its NAME field', () => {
    const result = validateIntent(
      { organizationId: ORG, entity: 'Product', projections: ['name', 'category'] },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.joins).toHaveLength(1);
    expect(result.resolved.joins[0]).toMatchObject({ alias: 'category', entity: 'CATEGORY' });
  });

  it('rejects a relationship alias that does not exist from the root entity', () => {
    const result = validateIntent(
      { organizationId: ORG, entity: 'Product', projections: ['customer.name'] },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'INVALID_RELATIONSHIP')).toBe(true);
  });
});

describe('filtros compostos', () => {
  it('resolves a nested AND/OR filter group', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [
          {
            logic: 'OR',
            filters: [
              { field: 'salePrice', operator: 'GT', value: 100 },
              {
                logic: 'AND',
                filters: [
                  { field: 'quantity', operator: 'GT', value: 0 },
                  { field: 'name', operator: 'LIKE', value: '%arroz%' },
                ],
              },
            ],
          },
        ],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.filters).toHaveLength(1);
    const group = result.resolved.filters[0];
    expect(group && 'logic' in group ? group.logic : null).toBe('OR');
  });

  it('rejects an empty filter group', () => {
    const result = validateIntent(
      { organizationId: ORG, entity: 'Product', filters: [{ logic: 'AND', filters: [] }] },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
  });
});

describe('ordenação', () => {
  it('resolves sorting and defaults direction to ASC', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        sorting: [{ field: 'expirationDate' }, { field: 'name', direction: 'DESC' }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.sorting).toEqual([
      { field: 'expirationDate', direction: 'ASC' },
      { field: 'name', direction: 'DESC' },
    ]);
  });
});

describe('paginação', () => {
  it('accepts valid pagination', () => {
    const result = validateIntent(
      { organizationId: ORG, entity: 'Product', pagination: { limit: 25, offset: 50 } },
      model,
      ORG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolved.pagination).toEqual({ limit: 25, offset: 50 });
  });

  it('rejects an out-of-range limit and a negative offset', () => {
    const result = validateIntent(
      { organizationId: ORG, entity: 'Product', pagination: { limit: 5000, offset: -1 } },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.filter((e) => e.code === 'INVALID_PAGINATION')).toHaveLength(2);
  });
});

describe('validação de tipos', () => {
  it('rejects LIKE on a numeric field', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'salePrice', operator: 'LIKE', value: '%10%' }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('OPERATOR_TYPE_MISMATCH');
  });

  it('rejects GT on a text field', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'name', operator: 'GT', value: 'A' }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
  });

  it('rejects BETWEEN without exactly two values', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'salePrice', operator: 'BETWEEN', value: [10] }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
  });

  it('rejects IS_NULL when a value is supplied', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'name', operator: 'IS_NULL', value: 'x' }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
  });

  it('accepts a relative-date value only on date fields', () => {
    const badResult = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'salePrice', operator: 'LTE', value: { relativeDays: 7 } }],
      },
      model,
      ORG
    );
    expect(badResult.ok).toBe(false);

    const goodResult = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'expirationDate', operator: 'LTE', value: { relativeDays: 7 } }],
      },
      model,
      ORG
    );
    expect(goodResult.ok).toBe(true);
  });
});

describe('campos inexistentes', () => {
  it('rejects an unknown entity', () => {
    const result = validateIntent({ organizationId: ORG, entity: 'Spaceship' }, model, ORG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('ENTITY_NOT_FOUND');
  });

  it('rejects an unknown field on a valid entity', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [{ field: 'shoeSize', operator: 'EQ', value: 42 }],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('FIELD_NOT_FOUND');
  });

  it('collects every error at once rather than stopping at the first', () => {
    const result = validateIntent(
      {
        organizationId: ORG,
        entity: 'Product',
        filters: [
          { field: 'shoeSize', operator: 'EQ', value: 1 },
          { field: 'name', operator: 'GT', value: 'A' },
        ],
      },
      model,
      ORG
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('missing model / organization mismatch', () => {
  it('rejects when the organization has no canonical model at all', () => {
    const result = validateIntent({ organizationId: ORG, entity: 'Product' }, null, ORG);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('NO_CANONICAL_MODEL');
  });

  it('rejects when the resolved model belongs to a different organization', () => {
    const input: QueryIntentInput = { organizationId: 'org-other', entity: 'Product' };
    const result = validateIntent(input, model, 'org-other');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('MODEL_ORGANIZATION_MISMATCH');
  });
});
