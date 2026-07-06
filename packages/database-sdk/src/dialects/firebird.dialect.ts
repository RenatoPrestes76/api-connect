import type { SqlDialect } from './dialect.js';

export class FirebirdDialect implements SqlDialect {
  readonly name = 'firebird';

  quoteIdentifier(name: string): string { return `"${name}"`; }

  placeholder(_index: number): string { return '?'; }

  renderLimit(_limit?: number, _offset?: number): string { return ''; }

  renderIntoSelect(sql: string, limit?: number, offset?: number): string {
    const first = limit  !== undefined ? `FIRST ${limit} `  : '';
    const skip  = offset !== undefined ? `SKIP ${offset} ` : '';
    if (!first && !skip) return sql;
    return sql.replace(/^SELECT /, `SELECT ${first}${skip}`);
  }

  booleanLiteral(value: boolean): string { return value ? '1' : '0'; }
}

export const firebirdDialect = new FirebirdDialect();
