import { describe, it, expect } from 'vitest';
import { PostgresDialect }   from '../dialects/postgres.dialect.js';
import { MySQLDialect }      from '../dialects/mysql.dialect.js';
import { SQLServerDialect }  from '../dialects/sqlserver.dialect.js';
import { OracleDialect }     from '../dialects/oracle.dialect.js';
import { FirebirdDialect }   from '../dialects/firebird.dialect.js';

describe('PostgresDialect', () => {
  const d = new PostgresDialect();

  it('has name "postgres"', ()             => expect(d.name).toBe('postgres'));
  it('quoteIdentifier wraps in double-quotes', () => expect(d.quoteIdentifier('id')).toBe('"id"'));
  it('placeholder uses $n', ()             => expect(d.placeholder(3)).toBe('$3'));
  it('renderLimit adds LIMIT + OFFSET', () => expect(d.renderLimit(10, 20)).toBe(' LIMIT 10 OFFSET 20'));
  it('renderLimit only LIMIT when no offset', () => expect(d.renderLimit(5)).toBe(' LIMIT 5'));
  it('renderLimit only OFFSET when no limit',  () => expect(d.renderLimit(undefined, 10)).toBe(' OFFSET 10'));
  it('renderLimit empty when neither',         () => expect(d.renderLimit()).toBe(''));
  it('renderIntoSelect appends to SQL',    () => {
    expect(d.renderIntoSelect('SELECT 1', 5, 0)).toBe('SELECT 1 LIMIT 5 OFFSET 0');
  });
  it('booleanLiteral', () => {
    expect(d.booleanLiteral(true)).toBe('TRUE');
    expect(d.booleanLiteral(false)).toBe('FALSE');
  });
});

describe('MySQLDialect', () => {
  const d = new MySQLDialect();

  it('has name "mysql"', ()             => expect(d.name).toBe('mysql'));
  it('quoteIdentifier uses backticks', () => expect(d.quoteIdentifier('name')).toBe('`name`'));
  it('placeholder always ?', ()         => { expect(d.placeholder(1)).toBe('?'); expect(d.placeholder(99)).toBe('?'); });
  it('renderLimit', ()                  => expect(d.renderLimit(10, 5)).toBe(' LIMIT 10 OFFSET 5'));
  it('booleanLiteral uses 1/0', ()      => {
    expect(d.booleanLiteral(true)).toBe('1');
    expect(d.booleanLiteral(false)).toBe('0');
  });
});

describe('SQLServerDialect', () => {
  const d = new SQLServerDialect();

  it('has name "sqlserver"', ()             => expect(d.name).toBe('sqlserver'));
  it('quoteIdentifier uses brackets', ()    => expect(d.quoteIdentifier('col')).toBe('[col]'));
  it('placeholder uses @pN', ()             => expect(d.placeholder(2)).toBe('@p2'));
  it('renderLimit uses FETCH NEXT', ()      => expect(d.renderLimit(10, 20)).toBe(' OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY'));
  it('renderLimit defaults offset to 0', () => expect(d.renderLimit(5)).toBe(' OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY'));
  it('renderLimit only offset', ()          => expect(d.renderLimit(undefined, 10)).toBe(' OFFSET 10 ROWS'));
  it('renderLimit empty when neither', ()   => expect(d.renderLimit()).toBe(''));
  it('booleanLiteral uses 1/0', ()          => {
    expect(d.booleanLiteral(true)).toBe('1');
    expect(d.booleanLiteral(false)).toBe('0');
  });
});

describe('OracleDialect', () => {
  const d = new OracleDialect();

  it('has name "oracle"', ()               => expect(d.name).toBe('oracle'));
  it('quoteIdentifier wraps in double-quotes', () => expect(d.quoteIdentifier('id')).toBe('"id"'));
  it('placeholder uses :n', ()             => expect(d.placeholder(1)).toBe(':1'));
  it('renderLimit with both', ()           => expect(d.renderLimit(10, 5)).toBe(' OFFSET 5 ROWS FETCH FIRST 10 ROWS ONLY'));
  it('renderLimit only limit', ()          => expect(d.renderLimit(10)).toBe(' FETCH FIRST 10 ROWS ONLY'));
  it('renderLimit only offset', ()         => expect(d.renderLimit(undefined, 5)).toBe(' OFFSET 5 ROWS'));
  it('renderLimit empty when neither', ()  => expect(d.renderLimit()).toBe(''));
  it('booleanLiteral uses 1/0', ()         => {
    expect(d.booleanLiteral(true)).toBe('1');
    expect(d.booleanLiteral(false)).toBe('0');
  });
});

describe('FirebirdDialect', () => {
  const d = new FirebirdDialect();

  it('has name "firebird"', ()             => expect(d.name).toBe('firebird'));
  it('quoteIdentifier wraps in double-quotes', () => expect(d.quoteIdentifier('id')).toBe('"id"'));
  it('placeholder always ?', ()            => expect(d.placeholder(5)).toBe('?'));
  it('renderLimit always empty string', () => {
    expect(d.renderLimit(10, 5)).toBe('');
    expect(d.renderLimit(10)).toBe('');
  });
  it('renderIntoSelect inserts FIRST SKIP', () => {
    expect(d.renderIntoSelect('SELECT * FROM t', 10, 5)).toBe('SELECT FIRST 10 SKIP 5 * FROM t');
  });
  it('renderIntoSelect only FIRST', () => {
    expect(d.renderIntoSelect('SELECT 1', 5)).toBe('SELECT FIRST 5 1');
  });
  it('renderIntoSelect only SKIP', () => {
    expect(d.renderIntoSelect('SELECT 1', undefined, 3)).toBe('SELECT SKIP 3 1');
  });
  it('renderIntoSelect unchanged when no limit/offset', () => {
    expect(d.renderIntoSelect('SELECT 1')).toBe('SELECT 1');
  });
  it('booleanLiteral uses 1/0', () => {
    expect(d.booleanLiteral(true)).toBe('1');
    expect(d.booleanLiteral(false)).toBe('0');
  });
});
