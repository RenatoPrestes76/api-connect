import type { SqlDialect } from './dialect.js';

export class SQLServerDialect implements SqlDialect {
  readonly name = 'sqlserver';

  quoteIdentifier(name: string): string { return `[${name}]`; }

  placeholder(index: number): string { return `@p${index}`; }

  renderLimit(limit?: number, offset?: number): string {
    if (limit !== undefined) {
      return ` OFFSET ${offset ?? 0} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
    if (offset !== undefined) {
      return ` OFFSET ${offset} ROWS`;
    }
    return '';
  }

  renderIntoSelect(sql: string, limit?: number, offset?: number): string {
    return sql + this.renderLimit(limit, offset);
  }

  booleanLiteral(value: boolean): string { return value ? '1' : '0'; }
}

export const sqlServerDialect = new SQLServerDialect();
