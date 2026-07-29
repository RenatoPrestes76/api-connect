import type { DialectGenerator } from './dialects/dialect-generator.js';
import type { SqlParameter } from './types.js';

/**
 * Every literal value that ends up in a WHERE clause goes through here —
 * never through string interpolation. `add()` returns only a placeholder
 * token; the actual value is tracked separately and surfaced as
 * GeneratedQuery.parameters, exactly mirroring how the driver-layer
 * QueryBuilder in @seltriva/database-sdk already does it for physical SQL.
 */
export class ParameterBuilder {
  private values: unknown[] = [];

  constructor(private readonly dialect: DialectGenerator) {}

  add(value: unknown): string {
    this.values.push(value);
    return this.dialect.placeholder(this.values.length);
  }

  build(): SqlParameter[] {
    return this.values.map((value, i) => ({ name: `p${i + 1}`, value }));
  }
}
