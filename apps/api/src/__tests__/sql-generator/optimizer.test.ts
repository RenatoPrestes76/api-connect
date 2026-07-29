import { describe, it, expect } from 'vitest';
import { optimizePlan } from '../../modules/sql-generator/optimizer.js';
import type { QueryPlanRecord } from '../../modules/query-planner/types.js';

function buildPlan(overrides: Partial<QueryPlanRecord>): QueryPlanRecord {
  return {
    id: 'plan-1',
    organizationId: 'org-1',
    canonicalModelId: 'model-1',
    canonicalVersion: '1.0.0',
    rootEntity: 'PRODUCT',
    joins: [],
    projections: [],
    filters: [],
    sorting: [],
    pagination: null,
    createdAt: new Date().toISOString(),
    createdBy: 'test@atlasconnect.com.br',
    ...overrides,
  };
}

describe('optimizePlan', () => {
  it('removes structurally-duplicate filters and records why', () => {
    const plan = buildPlan({
      filters: [
        { field: 'salePrice', operator: 'GT', value: { kind: 'literal', value: 100 } },
        { field: 'salePrice', operator: 'GT', value: { kind: 'literal', value: 100 } },
      ],
    });
    const result = optimizePlan(plan);
    expect(result.filters).toHaveLength(1);
    expect(result.notes.some((n) => n.includes('redundant duplicate filter'))).toBe(true);
  });

  it('orders predicates cheapest-first (EQ before LIKE)', () => {
    const plan = buildPlan({
      filters: [
        { field: 'description', operator: 'LIKE', value: { kind: 'literal', value: '%rice%' } },
        { field: 'code', operator: 'EQ', value: { kind: 'literal', value: 'ABC' } },
      ],
    });
    const result = optimizePlan(plan);
    const first = result.filters[0];
    expect(first && !('logic' in first) ? first.operator : null).toBe('EQ');
  });

  it('deduplicates identical projections', () => {
    const plan = buildPlan({ projections: [{ field: 'name' }, { field: 'name' }] });
    const result = optimizePlan(plan);
    expect(result.projections).toHaveLength(1);
    expect(result.notes.some((n) => n.includes('duplicate projection'))).toBe(true);
  });

  it('drops joins that nothing references', () => {
    const plan = buildPlan({
      rootEntity: 'INVENTORY',
      joins: [
        { alias: 'product', entity: 'PRODUCT', viaRootField: 'product' },
        { alias: 'store', entity: 'BRANCH', viaRootField: 'store' },
      ],
      projections: [{ field: 'product.name' }],
    });
    const result = optimizePlan(plan);
    expect(result.joins.map((j) => j.alias)).toEqual(['product']);
    expect(result.notes.some((n) => n.includes('Removed unused join: store'))).toBe(true);
  });

  it('keeps a join referenced only by a filter value that points at another field', () => {
    const plan = buildPlan({
      rootEntity: 'INVENTORY',
      joins: [{ alias: 'product', entity: 'PRODUCT', viaRootField: 'product' }],
      filters: [
        {
          field: 'quantity',
          operator: 'LT',
          value: { kind: 'field', field: 'product.minimumQuantity' },
        },
      ],
    });
    const result = optimizePlan(plan);
    expect(result.joins.map((j) => j.alias)).toEqual(['product']);
  });
});
