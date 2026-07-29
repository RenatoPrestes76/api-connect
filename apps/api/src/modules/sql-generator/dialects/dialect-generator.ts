import type { SqlDialect } from '../types.js';

/**
 * Everything about a SQL dialect that genuinely differs and would produce
 * wrong or non-portable SQL if generalized: identifier quoting, parameter
 * placeholder style, relative-date arithmetic, and pagination syntax.
 */
export interface DialectGenerator {
  readonly dialect: SqlDialect;
  quoteIdentifier(name: string): string;
  placeholder(index: number): string;
  /** Dialect-specific SQL expression for "today + N days" (N may be negative) — used as the resolved value of a relativeDate filter. */
  todayPlusDays(days: number): string;
  /**
   * Wraps a fully-assembled SELECT statement (without ORDER BY/pagination)
   * plus its ORDER BY clause into the dialect's pagination syntax. Some
   * dialects (Firebird) inject their pagination keywords right after
   * SELECT rather than appending them.
   */
  paginate(selectSql: string, orderBySql: string, limit: number, offset: number): string;
}

export function qualifyTable(
  schema: string,
  table: string,
  quote: (name: string) => string
): string {
  return schema ? `${quote(schema)}.${quote(table)}` : quote(table);
}
