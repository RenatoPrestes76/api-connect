import type { SqlDialect } from './dialect.js';

export class MySQLDialect implements SqlDialect {
  readonly name = 'mysql';

  quoteIdentifier(name: string): string {
    return `\`${name}\``;
  }

  placeholder(_index: number): string {
    return '?';
  }

  renderLimit(limit?: number, offset?: number): string {
    let s = '';
    if (limit !== undefined) s += ` LIMIT ${limit}`;
    if (offset !== undefined) s += ` OFFSET ${offset}`;
    return s;
  }

  renderIntoSelect(sql: string, limit?: number, offset?: number): string {
    return sql + this.renderLimit(limit, offset);
  }

  booleanLiteral(value: boolean): string {
    return value ? '1' : '0';
  }
}

export const mysqlDialect = new MySQLDialect();
