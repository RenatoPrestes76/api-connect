import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../query/query-builder.js';
import { equals, greaterThan, isNull } from '../query/filters.js';
import { QueryError } from '../errors/database-errors.js';

describe('QueryBuilder — SELECT', () => {
  it('builds minimal SELECT *', () => {
    const q = new QueryBuilder().from('products').build();
    expect(q.type).toBe('SELECT');
    expect(q.table).toBe('products');
    expect(q.columns).toEqual(['*']);
  });

  it('builds SELECT with column list', () => {
    const q = new QueryBuilder().select(['id', 'name']).from('products').build();
    expect(q.columns).toEqual(['id', 'name']);
  });

  it('builds SELECT with string overload', () => {
    const q = new QueryBuilder().select('id').select('name').from('products').build();
    expect(q.columns).toEqual(['id', 'name']);
  });

  it('builds WHERE from filter object', () => {
    const q = new QueryBuilder().from('t').where(equals('id', 1)).build();
    expect(q.where).toHaveLength(1);
    expect(q.where![0]!.operator).toBe('eq');
  });

  it('builds WHERE from field+value shorthand', () => {
    const q = new QueryBuilder().from('t').where('status', 'active').build();
    const f = q.where![0]! as { operator: string; field: string; value: unknown };
    expect(f.field).toBe('status');
    expect(f.value).toBe('active');
  });

  it('chains multiple WHERE conditions', () => {
    const q = new QueryBuilder()
      .from('t')
      .where(equals('a', 1))
      .where(greaterThan('b', 2))
      .build();
    expect(q.where).toHaveLength(2);
  });

  it('builds ORDER BY with default ASC', () => {
    const q = new QueryBuilder().from('t').orderBy('name').build();
    expect(q.orderBy).toEqual([{ column: 'name', direction: 'ASC' }]);
  });

  it('builds ORDER BY DESC', () => {
    const q = new QueryBuilder().from('t').orderBy('created_at', 'DESC').build();
    expect(q.orderBy![0]!.direction).toBe('DESC');
  });

  it('sets LIMIT and OFFSET', () => {
    const q = new QueryBuilder().from('t').limit(10).offset(20).build();
    expect(q.limit).toBe(10);
    expect(q.offset).toBe(20);
  });

  it('builds JOIN', () => {
    const q = new QueryBuilder()
      .from('orders')
      .join('LEFT', 'users', 'orders.user_id = users.id')
      .build();
    expect(q.joins).toHaveLength(1);
    expect(q.joins![0]!.type).toBe('LEFT');
  });

  it('throws when table not set', () => {
    expect(() => new QueryBuilder().build()).toThrow(QueryError);
  });

  it('produces undefined where/orderBy/joins when unused', () => {
    const q = new QueryBuilder().from('t').build();
    expect(q.where).toBeUndefined();
    expect(q.orderBy).toBeUndefined();
    expect(q.joins).toBeUndefined();
  });

  it('toSQL renders for dialect', () => {
    const { sql } = new QueryBuilder().from('products').where(isNull('deleted_at')).toSQL('postgres');
    expect(sql).toContain('IS NULL');
    expect(sql).toContain('"products"');
  });
});

describe('QueryBuilder — static helpers', () => {
  it('static insert builds InsertQuery', () => {
    const q = QueryBuilder.insert('users', [{ name: 'Ana' }]);
    expect(q.type).toBe('INSERT');
    expect(q.table).toBe('users');
    expect(q.values).toEqual([{ name: 'Ana' }]);
  });

  it('static update builds UpdateQuery', () => {
    const q = QueryBuilder.update('users', { name: 'Bob' }, [equals('id', 1)]);
    expect(q.type).toBe('UPDATE');
    expect(q.set).toEqual({ name: 'Bob' });
  });

  it('static deleteFrom builds DeleteQuery', () => {
    const q = QueryBuilder.deleteFrom('sessions', [equals('expired', true)]);
    expect(q.type).toBe('DELETE');
    expect(q.table).toBe('sessions');
  });

  it('static raw builds RawQuery', () => {
    const q = QueryBuilder.raw('SELECT 1', []);
    expect(q.type).toBe('RAW');
    expect(q.sql).toBe('SELECT 1');
  });
});
