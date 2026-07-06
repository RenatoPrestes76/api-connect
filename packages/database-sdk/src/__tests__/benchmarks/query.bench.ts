import { bench, describe } from 'vitest';
import { QueryBuilder }    from '../../query/query-builder.js';
import { SqlRenderer }     from '../../query/sql-renderer.js';
import { equals, greaterThan, and, or, isNull } from '../../query/filters.js';
import { MetadataCache }   from '../../schema/metadata-cache.js';
import type { SchemaReader, DatabaseSchema } from '../../schema/schema-reader.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const renderer = new SqlRenderer('postgres');

const simpleSelect = new QueryBuilder()
  .from('users')
  .where(equals('id', 1))
  .build();

const complexSelect = new QueryBuilder()
  .select(['id', 'email', 'name'])
  .from('users')
  .join('LEFT', 'orders', 'users.id = orders.user_id')
  .where(and(
    equals('active', true),
    greaterThan('created_at', '2024-01-01'),
    or(isNull('deleted_at'), equals('deleted_at', null)),
  ))
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(0)
  .build();

const insertQuery = QueryBuilder.insert('events', Array.from({ length: 50 }, (_, i) => ({
  user_id:    i + 1,
  action:     'click',
  created_at: new Date().toISOString(),
})));

const updateQuery = QueryBuilder.update(
  'users',
  { name: 'Updated', updated_at: new Date().toISOString() },
  [equals('id', 42)],
);

const deleteQuery = QueryBuilder.deleteFrom('sessions', [
  and(equals('user_id', 1), equals('expired', true)),
]);

// ─── QueryBuilder benchmarks ─────────────────────────────────────────────────

describe('QueryBuilder — build()', () => {
  bench('minimal SELECT *', () => {
    new QueryBuilder().from('users').build();
  });

  bench('SELECT with WHERE + ORDER BY + LIMIT', () => {
    new QueryBuilder()
      .from('users')
      .where(equals('active', true))
      .orderBy('name')
      .limit(10)
      .build();
  });

  bench('complex SELECT with JOIN + compound filter', () => {
    new QueryBuilder()
      .select(['id', 'email'])
      .from('users')
      .join('LEFT', 'orders', 'users.id = orders.user_id')
      .where(and(equals('active', true), greaterThan('score', 100)))
      .orderBy('created_at', 'DESC')
      .limit(50)
      .offset(100)
      .build();
  });

  bench('INSERT 50 rows', () => {
    QueryBuilder.insert('events', Array.from({ length: 50 }, (_, i) => ({
      user_id: i + 1,
      action:  'click',
    })));
  });
});

// ─── SqlRenderer benchmarks ──────────────────────────────────────────────────

describe('SqlRenderer — render()', () => {
  bench('render simple SELECT (postgres)', () => {
    renderer.render(simpleSelect);
  });

  bench('render complex SELECT with JOIN + compound filter', () => {
    renderer.render(complexSelect);
  });

  bench('render INSERT 50 rows', () => {
    renderer.render(insertQuery);
  });

  bench('render UPDATE', () => {
    renderer.render(updateQuery);
  });

  bench('render DELETE with compound filter', () => {
    renderer.render(deleteQuery);
  });

  bench('render across all dialects', () => {
    for (const dialect of ['postgres', 'mysql', 'sqlserver', 'oracle', 'firebird'] as const) {
      new SqlRenderer(dialect).render(complexSelect);
    }
  });
});

// ─── MetadataCache benchmarks ────────────────────────────────────────────────

const CACHED_SCHEMA: DatabaseSchema = {
  name:     'bench',
  tables:   Array.from({ length: 20 }, (_, i) => ({
    name:        `table_${i}`,
    columns:     Array.from({ length: 10 }, (_, j) => ({
      name: `col_${j}`, type: 'varchar', nullable: j > 0,
      isPrimaryKey: j === 0, isForeignKey: false, isUnique: j === 0,
    })),
    primaryKey:  { columns: ['col_0'] },
    foreignKeys: [],
    indexes:     [{ name: `pk_${i}`, columns: ['col_0'], isUnique: true, isPrimary: true }],
  })),
  relations:    [],
  discoveredAt: new Date(),
};

const mockReader: SchemaReader = {
  readSchema:  async () => CACHED_SCHEMA,
  readTable:   async (n) => CACHED_SCHEMA.tables.find((t) => t.name === n) ?? null,
  listTables:  async () => CACHED_SCHEMA.tables.map((t) => t.name),
};

describe('MetadataCache — load()', () => {
  bench('load() from warm cache (no DB call)', async () => {
    const cache = new MetadataCache(mockReader, { ttlMs: 60_000 });
    await cache.load(); // prime
    await cache.load(); // warm — no reader call
  });

  bench('refresh() force re-load', async () => {
    const cache = new MetadataCache(mockReader);
    await cache.refresh();
  });

  bench('invalidate + reload cycle', async () => {
    const cache = new MetadataCache(mockReader, { ttlMs: 60_000 });
    await cache.load();
    cache.invalidate();
    await cache.load();
  });
});
