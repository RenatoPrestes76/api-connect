import { describe, it, expect } from 'vitest';
import {
  assertReadOnly,
  selectStrategy,
  buildExtractSql,
  hashRecord,
  ReadOnlyViolationError,
  ChangeDetector,
} from '../detection/change-detector.js';
import type { TableSyncConfig } from '../types/index.js';

const TABLE_CFG: TableSyncConfig = {
  schema: 'public',
  table: 'produto',
  mode: 'FULL',
  detection: 'UPDATED_AT',
  conflict: 'OVERWRITE',
  priority: 1,
};

describe('assertReadOnly()', () => {
  const SAFE = [
    'SELECT id FROM produto',
    'select * from produto where id = $1',
    'WITH cte AS (SELECT 1) SELECT * FROM cte',
    'EXPLAIN SELECT 1',
    'SHOW search_path',
  ];

  const UNSAFE = [
    'INSERT INTO produto VALUES (1)',
    'UPDATE produto SET nome=$1',
    'DELETE FROM produto',
    'DROP TABLE produto',
    'TRUNCATE produto',
    'CREATE TABLE x (id int)',
    'ALTER TABLE produto ADD COLUMN y text',
  ];

  for (const sql of SAFE) {
    it(`allows: ${sql.substring(0, 40)}`, () => {
      expect(() => assertReadOnly(sql)).not.toThrow();
    });
  }

  for (const sql of UNSAFE) {
    it(`blocks: ${sql.substring(0, 40)}`, () => {
      expect(() => assertReadOnly(sql)).toThrow(ReadOnlyViolationError);
    });
  }
});

describe('hashRecord()', () => {
  it('produces consistent hash for same record', () => {
    const r = { id: 1, nome: 'Produto' };
    expect(hashRecord(r)).toBe(hashRecord(r));
  });

  it('produces different hash for different records', () => {
    expect(hashRecord({ id: 1 })).not.toBe(hashRecord({ id: 2 }));
  });

  it('is key-order independent', () => {
    expect(hashRecord({ b: 2, a: 1 })).toBe(hashRecord({ a: 1, b: 2 }));
  });
});

describe('selectStrategy()', () => {
  it('selects UPDATED_AT when preferred and column present', () => {
    const s = selectStrategy(['id', 'updated_at', 'nome'], 'UPDATED_AT');
    expect(s).toBe('UPDATED_AT');
  });

  it('selects XMIN when preferred', () => {
    const s = selectStrategy(['id'], 'XMIN');
    expect(s).toBe('XMIN');
  });

  it('selects ROW_HASH when preferred', () => {
    const s = selectStrategy(['id'], 'ROW_HASH');
    expect(s).toBe('ROW_HASH');
  });

  it('auto-detects UPDATED_AT when no preferred given', () => {
    const s = selectStrategy(['id', 'nome', 'updated_at']);
    expect(s).toBe('UPDATED_AT');
  });

  it('falls back to ROW_HASH when no timestamp columns available', () => {
    const s = selectStrategy(['id', 'nome'], 'UPDATED_AT');
    expect(s).toBe('ROW_HASH'); // preferred UPDATED_AT not feasible, auto-detects
  });

  it('prefers XMIN in auto-detect', () => {
    const s = selectStrategy(['id', 'updated_at', 'xmin']);
    expect(s).toBe('XMIN');
  });
});

describe('buildExtractSql()', () => {
  it('generates safe SELECT with LIMIT and OFFSET', () => {
    const { sql } = buildExtractSql(
      'public',
      'produto',
      TABLE_CFG,
      ['id', 'nome', 'updated_at'],
      null,
      0,
      1000
    );
    assertReadOnly(sql);
    expect(sql).toContain('LIMIT');
    expect(sql).toContain('OFFSET');
    expect(sql).toContain('"produto"');
  });

  it('includes WHERE clause when since is provided', () => {
    const { sql, params } = buildExtractSql(
      'public',
      'produto',
      TABLE_CFG,
      ['id', 'nome', 'updated_at'],
      '2024-01-01T00:00:00Z',
      0,
      1000
    );
    assertReadOnly(sql);
    expect(params).toContain('2024-01-01T00:00:00Z');
  });

  it('uses XMIN strategy', () => {
    const xminCfg = { ...TABLE_CFG, detection: 'XMIN' as const };
    const { sql } = buildExtractSql('public', 'produto', xminCfg, ['id'], null, 0, 100);
    assertReadOnly(sql);
    expect(sql).toContain('xmin');
  });

  it('returns sinceCol for UPDATED_AT strategy', () => {
    const { sinceCol } = buildExtractSql(
      'public',
      'produto',
      TABLE_CFG,
      ['id', 'updated_at'],
      null,
      0,
      100
    );
    expect(sinceCol).toBe('updated_at');
  });

  it('sinceCol is null for ROW_HASH strategy', () => {
    const hashCfg = { ...TABLE_CFG, detection: 'ROW_HASH' as const };
    const { sinceCol } = buildExtractSql(
      'public',
      'produto',
      hashCfg,
      ['id', 'nome'],
      null,
      0,
      100
    );
    expect(sinceCol).toBeNull();
  });
});

describe('ChangeDetector', () => {
  it('hasChanged returns false for same record', () => {
    const detector = new ChangeDetector();
    const r = { id: 1, nome: 'Produto' };
    const hash = hashRecord(r);
    expect(detector.hasChanged(r, hash)).toBe(false);
  });

  it('hasChanged returns true for modified record', () => {
    const detector = new ChangeDetector();
    const r1 = { id: 1, nome: 'Produto A' };
    const hash = hashRecord(r1);
    expect(detector.hasChanged({ id: 1, nome: 'Produto B' }, hash)).toBe(true);
  });

  it('estimateChanges returns DetectedChange with count', async () => {
    const detector = new ChangeDetector();
    const result = await detector.estimateChanges(
      'public',
      'produto',
      'UPDATED_AT',
      '2024-01-01',
      async (sql, _p) => {
        assertReadOnly(sql);
        return [{ n: 500 }];
      }
    );
    expect(result.estimated).toBe(500);
    expect(result.schema).toBe('public');
    expect(result.table).toBe('produto');
  });

  it('estimateChanges handles null estimate', async () => {
    const detector = new ChangeDetector();
    const result = await detector.estimateChanges(
      'public',
      'produto',
      'ROW_HASH',
      null,
      async () => [{}]
    );
    expect(result.estimated).toBeNull();
  });

  it('extractSinceValue returns updated_at value', () => {
    const detector = new ChangeDetector();
    const r = { id: 1, updated_at: '2024-06-01T00:00:00Z' };
    expect(detector.extractSinceValue(r, 'UPDATED_AT')).toBe('2024-06-01T00:00:00Z');
  });

  it('extractSinceValue returns null for ROW_HASH', () => {
    const detector = new ChangeDetector();
    expect(detector.extractSinceValue({ id: 1 }, 'ROW_HASH')).toBeNull();
  });

  it('extractSinceValue returns CREATED_AT column value', () => {
    const detector = new ChangeDetector();
    expect(detector.extractSinceValue({ id: 1, criado_em: '2024-01-01' }, 'CREATED_AT')).toBe(
      '2024-01-01'
    );
  });

  it('extractSinceValue returns null for CREATED_AT when no matching column', () => {
    const detector = new ChangeDetector();
    expect(detector.extractSinceValue({ id: 1, nome: 'x' }, 'CREATED_AT')).toBeNull();
  });

  it('estimateChanges uses XMIN strategy', async () => {
    const detector = new ChangeDetector();
    const result = await detector.estimateChanges(
      'public',
      'produto',
      'XMIN',
      '12345',
      async (sql, params) => {
        assertReadOnly(sql);
        expect(sql).toContain('xmin');
        expect(params[0]).toBe('12345');
        return [{ n: 99 }];
      }
    );
    expect(result.estimated).toBe(99);
  });
});
