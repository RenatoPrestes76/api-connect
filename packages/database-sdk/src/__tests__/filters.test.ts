import { describe, it, expect } from 'vitest';
import {
  equals, notEquals,
  greaterThan, greaterThanOrEqual,
  lessThan, lessThanOrEqual,
  between, like, inList, isNull, isNotNull,
  and, or,
} from '../query/filters.js';

describe('Filter constructors — simple', () => {
  it('equals builds correct filter', () => {
    const f = equals('age', 30);
    expect(f).toEqual({ field: 'age', operator: 'eq', value: 30 });
  });

  it('notEquals builds correct filter', () => {
    const f = notEquals('status', 'inactive');
    expect(f).toEqual({ field: 'status', operator: 'neq', value: 'inactive' });
  });

  it('greaterThan builds correct filter', () => {
    const f = greaterThan('price', 100);
    expect(f).toEqual({ field: 'price', operator: 'gt', value: 100 });
  });

  it('greaterThanOrEqual builds correct filter', () => {
    const f = greaterThanOrEqual('score', 75);
    expect(f).toEqual({ field: 'score', operator: 'gte', value: 75 });
  });

  it('lessThan builds correct filter', () => {
    const f = lessThan('weight', 50);
    expect(f).toEqual({ field: 'weight', operator: 'lt', value: 50 });
  });

  it('lessThanOrEqual builds correct filter', () => {
    const f = lessThanOrEqual('level', 10);
    expect(f).toEqual({ field: 'level', operator: 'lte', value: 10 });
  });

  it('between packs min/max as array', () => {
    const f = between('amount', 10, 99);
    expect(f).toEqual({ field: 'amount', operator: 'between', value: [10, 99] });
  });

  it('like builds correct filter', () => {
    const f = like('name', '%silva%');
    expect(f).toEqual({ field: 'name', operator: 'like', value: '%silva%' });
  });

  it('inList stores values array', () => {
    const f = inList('country', ['BR', 'US', 'DE']);
    expect(f).toEqual({ field: 'country', operator: 'in', value: ['BR', 'US', 'DE'] });
  });

  it('isNull has no value', () => {
    const f = isNull('deleted_at');
    expect(f.operator).toBe('isNull');
    expect(f.value).toBeUndefined();
  });

  it('isNotNull has no value', () => {
    const f = isNotNull('confirmed_at');
    expect(f.operator).toBe('isNotNull');
    expect(f.value).toBeUndefined();
  });
});

describe('Filter constructors — compound', () => {
  it('and builds compound filter with correct operator', () => {
    const f = and(equals('a', 1), equals('b', 2));
    expect(f.operator).toBe('and');
    expect(f.filters).toHaveLength(2);
  });

  it('and stores all sub-filters', () => {
    const f1 = equals('x', 1);
    const f2 = greaterThan('y', 10);
    const f3 = isNull('z');
    const f = and(f1, f2, f3);
    expect(f.filters).toEqual([f1, f2, f3]);
  });

  it('or builds compound filter with correct operator', () => {
    const f = or(equals('status', 'active'), equals('status', 'pending'));
    expect(f.operator).toBe('or');
    expect(f.filters).toHaveLength(2);
  });

  it('and/or can be nested', () => {
    const f = and(
      or(equals('role', 'admin'), equals('role', 'moderator')),
      equals('active', true),
    );
    expect(f.operator).toBe('and');
    expect(f.filters[0]!.operator).toBe('or');
  });
});
