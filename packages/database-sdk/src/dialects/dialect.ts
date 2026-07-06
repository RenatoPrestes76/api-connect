export interface SqlDialect {
  readonly name: string;
  quoteIdentifier(name: string): string;
  placeholder(index: number): string;
  renderLimit(limit?: number, offset?: number): string;
  renderIntoSelect(baseSql: string, limit?: number, offset?: number): string;
  booleanLiteral(value: boolean): string;
}
