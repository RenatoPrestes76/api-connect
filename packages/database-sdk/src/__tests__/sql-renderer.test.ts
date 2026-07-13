import { describe, it, expect } from 'vitest';
import { SqlRenderer } from '../query/sql-renderer.js';
import type {
  SelectQuery,
  InsertQuery,
  UpdateQuery,
  DeleteQuery,
  RawQuery,
} from '../query/query-types.js';
import {
  equals,
  greaterThan,
  isNull,
  inList,
  between,
  like,
  notEquals,
  and,
  or,
} from '../query/filters.js';
import { QueryError } from '../errors/database-errors.js';

const pg = new SqlRenderer('postgres');
const my = new SqlRenderer('mysql');
const ms = new SqlRenderer('sqlserver');
const ora = new SqlRenderer('oracle');
const fb = new SqlRenderer('firebird');

describe('SqlRenderer — identifier quoting', () => {
  const q: SelectQuery = { type: 'SELECT', table: 'products', columns: ['id', 'name'] };

  it('postgres uses double quotes', () => {
    expect(pg.render(q).sql).toBe('SELECT "id", "name" FROM "products"');
  });

  it('mysql uses backticks', () => {
    expect(my.render(q).sql).toBe('SELECT `id`, `name` FROM `products`');
  });

  it('sqlserver uses square brackets', () => {
    expect(ms.render(q).sql).toBe('SELECT [id], [name] FROM [products]');
  });

  it('oracle uses double quotes', () => {
    expect(ora.render(q).sql).toBe('SELECT "id", "name" FROM "products"');
  });

  it('firebird uses double quotes', () => {
    expect(fb.render(q).sql).toBe('SELECT "id", "name" FROM "products"');
  });
});

describe('SqlRenderer — parameter placeholders', () => {
  const q: SelectQuery = { type: 'SELECT', table: 't', columns: ['*'], where: [equals('x', 1)] };

  it('postgres uses $1', () => {
    const r = pg.render(q);
    expect(r.sql).toContain('$1');
    expect(r.params).toEqual([1]);
  });

  it('mysql uses ?', () => {
    expect(my.render(q).sql).toContain('?');
  });

  it('sqlserver uses @p1', () => {
    expect(ms.render(q).sql).toContain('@p1');
  });

  it('oracle uses :1', () => {
    expect(ora.render(q).sql).toContain(':1');
  });

  it('firebird uses ?', () => {
    expect(fb.render(q).sql).toContain('?');
  });
});

describe('SqlRenderer — SELECT with filters', () => {
  it('renders multiple WHERE conditions with AND', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'orders',
      columns: ['*'],
      where: [greaterThan('total', 100), equals('status', 'paid')],
    };
    const { sql } = pg.render(q);
    expect(sql).toContain('WHERE');
    expect(sql).toContain('AND');
  });

  it('renders IS NULL filter', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 't',
      columns: ['*'],
      where: [isNull('deleted_at')],
    };
    expect(pg.render(q).sql).toContain('IS NULL');
  });

  it('renders IN filter', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 't',
      columns: ['*'],
      where: [inList('id', [1, 2, 3])],
    };
    expect(pg.render(q).sql).toContain('IN ($1, $2, $3)');
  });

  it('renders BETWEEN filter', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 't',
      columns: ['*'],
      where: [between('price', 10, 50)],
    };
    expect(pg.render(q).sql).toContain('BETWEEN');
  });

  it('renders LIKE filter', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 't',
      columns: ['*'],
      where: [like('name', '%test%')],
    };
    expect(pg.render(q).sql).toContain('LIKE');
  });

  it('renders != filter', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 't',
      columns: ['*'],
      where: [notEquals('status', 'x')],
    };
    expect(pg.render(q).sql).toContain('!=');
  });
});

describe('SqlRenderer — compound filters (and/or)', () => {
  it('renders AND compound filter with parentheses', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'users',
      columns: ['*'],
      where: [and(equals('active', true), greaterThan('age', 18))],
    };
    const { sql, params } = pg.render(q);
    expect(sql).toContain('("active" = $1 AND "age" > $2)');
    expect(params).toEqual([true, 18]);
  });

  it('renders OR compound filter with parentheses', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'users',
      columns: ['*'],
      where: [or(equals('role', 'admin'), equals('role', 'moderator'))],
    };
    const { sql } = pg.render(q);
    expect(sql).toContain('("role" = $1 OR "role" = $2)');
  });

  it('renders nested and/or', () => {
    const nested = and(
      or(equals('status', 'active'), equals('status', 'pending')),
      equals('verified', true)
    );
    const q: SelectQuery = { type: 'SELECT', table: 't', columns: ['*'], where: [nested] };
    const { sql } = pg.render(q);
    expect(sql).toContain('OR');
    expect(sql).toContain('AND');
    expect(sql).toMatch(/\(.*OR.*\)/);
  });

  it('renders mysql compound filter with backtick quoting', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'orders',
      columns: ['*'],
      where: [or(equals('status', 'new'), equals('status', 'open'))],
    };
    const { sql } = my.render(q);
    expect(sql).toContain('(`status` = ? OR `status` = ?)');
  });
});

describe('SqlRenderer — ORDER BY, LIMIT, OFFSET', () => {
  it('renders ORDER BY + LIMIT + OFFSET (postgres)', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'p',
      columns: ['*'],
      orderBy: [{ column: 'name', direction: 'ASC' }],
      limit: 10,
      offset: 20,
    };
    const { sql } = pg.render(q);
    expect(sql).toContain('ORDER BY "name" ASC');
    expect(sql).toContain('LIMIT 10');
    expect(sql).toContain('OFFSET 20');
  });

  it('renders FIRST/SKIP pagination (firebird)', () => {
    const q: SelectQuery = { type: 'SELECT', table: 'p', columns: ['*'], limit: 10, offset: 5 };
    const { sql } = fb.render(q);
    expect(sql).toContain('FIRST 10');
    expect(sql).toContain('SKIP 5');
  });

  it('renders OFFSET ROWS FETCH NEXT (sqlserver)', () => {
    const q: SelectQuery = { type: 'SELECT', table: 'p', columns: ['*'], limit: 10, offset: 0 };
    const { sql } = ms.render(q);
    expect(sql).toContain('OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY');
  });

  it('renders FETCH FIRST (oracle)', () => {
    const q: SelectQuery = { type: 'SELECT', table: 'p', columns: ['*'], limit: 5 };
    const { sql } = ora.render(q);
    expect(sql).toContain('FETCH FIRST 5 ROWS ONLY');
  });
});

describe('SqlRenderer — JOIN', () => {
  it('renders INNER JOIN', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'orders',
      columns: ['*'],
      joins: [{ type: 'INNER', table: 'users', on: 'orders.user_id = users.id' }],
    };
    expect(pg.render(q).sql).toContain('INNER JOIN');
  });

  it('renders LEFT JOIN', () => {
    const q: SelectQuery = {
      type: 'SELECT',
      table: 'orders',
      columns: ['*'],
      joins: [{ type: 'LEFT', table: 'payments', on: 'orders.id = payments.order_id' }],
    };
    expect(pg.render(q).sql).toContain('LEFT JOIN');
  });
});

describe('SqlRenderer — INSERT', () => {
  it('renders single-row INSERT', () => {
    const q: InsertQuery = {
      type: 'INSERT',
      table: 'users',
      values: [{ name: 'Ana', email: 'a@b.com' }],
    };
    const { sql, params } = pg.render(q);
    expect(sql).toContain('INSERT INTO "users"');
    expect(params).toEqual(['Ana', 'a@b.com']);
  });

  it('renders multi-row INSERT', () => {
    const q: InsertQuery = {
      type: 'INSERT',
      table: 'users',
      values: [{ name: 'A' }, { name: 'B' }],
    };
    expect(pg.render(q).sql).toContain('($1), ($2)');
  });

  it('throws on empty values', () => {
    const q: InsertQuery = { type: 'INSERT', table: 'users', values: [] };
    expect(() => pg.render(q)).toThrow(QueryError);
  });
});

describe('SqlRenderer — UPDATE', () => {
  it('renders UPDATE with SET and WHERE', () => {
    const q: UpdateQuery = {
      type: 'UPDATE',
      table: 'users',
      set: { name: 'Bob' },
      where: [equals('id', 1)],
    };
    const { sql } = pg.render(q);
    expect(sql).toContain('UPDATE "users" SET "name" = $1');
    expect(sql).toContain('WHERE');
  });
});

describe('SqlRenderer — DELETE', () => {
  it('renders DELETE with WHERE', () => {
    const q: DeleteQuery = { type: 'DELETE', table: 'users', where: [equals('id', 5)] };
    const { sql, params } = pg.render(q);
    expect(sql).toContain('DELETE FROM "users"');
    expect(params).toEqual([5]);
  });
});

describe('SqlRenderer — RAW', () => {
  it('passes raw SQL through unchanged', () => {
    const q: RawQuery = { type: 'RAW', sql: 'SELECT NOW()', params: [] };
    expect(pg.render(q).sql).toBe('SELECT NOW()');
  });
});

describe('SqlRenderer — wildcard SELECT', () => {
  it('uses * when columns is empty', () => {
    const q: SelectQuery = { type: 'SELECT', table: 'products', columns: [] };
    expect(pg.render(q).sql).toBe('SELECT * FROM "products"');
  });
});
