import type { SqlDialect } from './dialect.js';

export class PostgresDialect implements SqlDialect {
  readonly name = 'postgres';

  quoteIdentifier(name: string): string {
    return `"${name}"`;
  }

  placeholder(index: number): string {
    return `$${index}`;
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
    return value ? 'TRUE' : 'FALSE';
  }
}

export const postgresDialect = new PostgresDialect();
