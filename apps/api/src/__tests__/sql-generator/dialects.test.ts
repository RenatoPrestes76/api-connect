import { describe, it, expect } from 'vitest';
import { getDialectGenerator } from '../../modules/sql-generator/dialects/index.js';
import type { SqlDialect } from '../../modules/sql-generator/types.js';

describe('dialect generators — identifier quoting', () => {
  it.each<[SqlDialect, string]>([
    ['SQLSERVER', '[produtos]'],
    ['POSTGRESQL', '"produtos"'],
    ['MYSQL', '`produtos`'],
    ['ORACLE', '"produtos"'],
    ['FIREBIRD', '"produtos"'],
    ['MARIADB', '`produtos`'],
    ['SQLITE', '"produtos"'],
  ])('%s quotes identifiers as %s', (dialect, expected) => {
    expect(getDialectGenerator(dialect).quoteIdentifier('produtos')).toBe(expected);
  });
});

describe('dialect generators — parameter placeholders', () => {
  it.each<[SqlDialect, string, string]>([
    ['SQLSERVER', '@p1', '@p2'],
    ['POSTGRESQL', '$1', '$2'],
    ['MYSQL', '?', '?'],
    ['ORACLE', ':1', ':2'],
    ['FIREBIRD', '?', '?'],
    ['MARIADB', '?', '?'],
    ['SQLITE', '?', '?'],
  ])('%s placeholders: first=%s second=%s', (dialect, first, second) => {
    const generator = getDialectGenerator(dialect);
    expect(generator.placeholder(1)).toBe(first);
    expect(generator.placeholder(2)).toBe(second);
  });
});

describe('dialect generators — relative-date arithmetic (today + N days)', () => {
  it('SQL Server uses DATEADD/GETDATE', () => {
    expect(getDialectGenerator('SQLSERVER').todayPlusDays(7)).toBe('DATEADD(day, 7, GETDATE())');
  });
  it('PostgreSQL uses CURRENT_DATE + INTERVAL', () => {
    expect(getDialectGenerator('POSTGRESQL').todayPlusDays(7)).toBe(
      "CURRENT_DATE + INTERVAL '7 days'"
    );
  });
  it('MySQL/MariaDB use DATE_ADD/CURDATE', () => {
    expect(getDialectGenerator('MYSQL').todayPlusDays(30)).toBe(
      'DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
    );
    expect(getDialectGenerator('MARIADB').todayPlusDays(30)).toBe(
      'DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
    );
  });
  it('Oracle uses TRUNC(SYSDATE)', () => {
    expect(getDialectGenerator('ORACLE').todayPlusDays(7)).toBe('TRUNC(SYSDATE) + 7');
  });
  it('Firebird uses CURRENT_DATE + N (matches the spec example exactly)', () => {
    expect(getDialectGenerator('FIREBIRD').todayPlusDays(7)).toBe('CURRENT_DATE + 7');
  });
  it('SQLite uses date(now, ...)', () => {
    expect(getDialectGenerator('SQLITE').todayPlusDays(7)).toBe("date('now', '+7 days')");
    expect(getDialectGenerator('SQLITE').todayPlusDays(-3)).toBe("date('now', '-3 days')");
  });
});

describe('dialect generators — pagination syntax', () => {
  it('SQL Server: OFFSET/FETCH NEXT, defaults ORDER BY when none given', () => {
    const sql = getDialectGenerator('SQLSERVER').paginate('SELECT * FROM x', '', 10, 20);
    expect(sql).toBe(
      'SELECT * FROM x ORDER BY (SELECT NULL) OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY'
    );
  });
  it('PostgreSQL/MySQL/MariaDB/SQLite: LIMIT ... OFFSET ...', () => {
    for (const dialect of ['POSTGRESQL', 'MYSQL', 'MARIADB', 'SQLITE'] as const) {
      const sql = getDialectGenerator(dialect).paginate(
        'SELECT * FROM x',
        'ORDER BY x.id ASC',
        10,
        20
      );
      expect(sql).toBe('SELECT * FROM x ORDER BY x.id ASC LIMIT 10 OFFSET 20');
    }
  });
  it('Oracle: OFFSET ... ROWS FETCH NEXT ... ROWS ONLY', () => {
    const sql = getDialectGenerator('ORACLE').paginate(
      'SELECT * FROM x',
      'ORDER BY x.id ASC',
      10,
      20
    );
    expect(sql).toBe('SELECT * FROM x ORDER BY x.id ASC OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY');
  });
  it('Firebird: SELECT FIRST n SKIP m injected right after SELECT', () => {
    const sql = getDialectGenerator('FIREBIRD').paginate(
      'SELECT * FROM x',
      'ORDER BY x.id ASC',
      10,
      20
    );
    expect(sql).toBe('SELECT FIRST 10 SKIP 20 * FROM x ORDER BY x.id ASC');
  });
});
