import type { SqlDialect } from './dialect.js';

export class OracleDialect implements SqlDialect {
  readonly name = 'oracle';

  quoteIdentifier(name: string): string { return `"${name}"`; }

  placeholder(index: number): string { return `:${index}`; }

  renderLimit(limit?: number, offset?: number): string {
    if (limit !== undefined && offset !== undefined) {
      return ` OFFSET ${offset} ROWS FETCH FIRST ${limit} ROWS ONLY`;
    }
    if (limit !== undefined) {
      return ` FETCH FIRST ${limit} ROWS ONLY`;
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

export const oracleDialect = new OracleDialect();
