import { isFilterGroup } from '../query-planner/types.js';
import type {
  QueryFilter,
  QueryFilterNode,
  QueryPagination,
  QuerySort,
} from '../query-planner/types.js';
import type { DialectGenerator } from './dialects/dialect-generator.js';
import { ParameterBuilder } from './parameter-builder.js';
import type { PhysicalResolution } from './physical-resolver.js';
import type { OptimizedPlan } from './optimizer.js';
import type { SqlGenerationError, SqlParameter } from './types.js';

const OPERATOR_SQL: Readonly<Record<string, string>> = {
  EQ: '=',
  NE: '<>',
  GT: '>',
  LT: '<',
  GTE: '>=',
  LTE: '<=',
};

function qualify(dialect: DialectGenerator, table: string, column: string): string {
  return `${dialect.quoteIdentifier(table)}.${dialect.quoteIdentifier(column)}`;
}

export type RenderOutcome =
  | { ok: true; sql: string; parameters: readonly SqlParameter[] }
  | { ok: false; errors: SqlGenerationError[] };

export function renderSql(
  optimized: OptimizedPlan,
  pagination: QueryPagination | null,
  resolution: PhysicalResolution,
  dialect: DialectGenerator
): RenderOutcome {
  const errors: SqlGenerationError[] = [];
  const params = new ParameterBuilder(dialect);

  function columnSql(raw: string): string | null {
    const resolved = resolution.resolveField(raw);
    if (!resolved) {
      errors.push({
        code: 'FIELD_HAS_NO_PHYSICAL_COLUMN',
        message: `Could not resolve a physical column for "${raw}"`,
      });
      return null;
    }
    const table = resolved.tableAlias
      ? (resolution.joins.find((j) => j.alias === resolved.tableAlias)?.physicalTable ??
        resolved.physicalTable)
      : resolution.rootPhysicalTable;
    return qualify(dialect, table, resolved.physicalColumn);
  }

  function renderLeaf(filter: QueryFilter): string | null {
    const col = columnSql(filter.field);
    if (!col) return null;

    if (filter.operator === 'IS_NULL') return `${col} IS NULL`;
    if (filter.operator === 'NOT_NULL') return `${col} IS NOT NULL`;

    const value = filter.value;
    if (!value) return null;

    if (value.kind === 'field') {
      const rightCol = columnSql(value.field);
      const opSql = OPERATOR_SQL[filter.operator];
      if (!rightCol || !opSql) return null;
      return `${col} ${opSql} ${rightCol}`;
    }

    if (value.kind === 'relativeDate') {
      const opSql = OPERATOR_SQL[filter.operator];
      if (!opSql) return null;
      return `${col} ${opSql} ${dialect.todayPlusDays(value.days)}`;
    }

    // literal — always parameterized, never string-interpolated
    if (filter.operator === 'BETWEEN') {
      const values = value.value as [unknown, unknown];
      return `${col} BETWEEN ${params.add(values[0])} AND ${params.add(values[1])}`;
    }
    if (filter.operator === 'IN') {
      const values = value.value as unknown[];
      return `${col} IN (${values.map((v) => params.add(v)).join(', ')})`;
    }
    if (filter.operator === 'LIKE') {
      return `${col} LIKE ${params.add(value.value)}`;
    }
    const opSql = OPERATOR_SQL[filter.operator];
    if (!opSql) return null;
    return `${col} ${opSql} ${params.add(value.value)}`;
  }

  function renderNode(node: QueryFilterNode): string | null {
    if (isFilterGroup(node)) {
      const parts = node.filters.map(renderNode).filter((p): p is string => p !== null);
      return parts.length === 0 ? null : `(${parts.join(` ${node.logic} `)})`;
    }
    return renderLeaf(node);
  }

  const selectColumns: string[] =
    optimized.projections.length > 0
      ? optimized.projections
          .map((p) => {
            const col = columnSql(p.field);
            if (!col) return null;
            const alias = p.alias ?? p.field.replace('.', '_');
            return `${col} AS ${dialect.quoteIdentifier(alias)}`;
          })
          .filter((c): c is string => c !== null)
      : [`${dialect.quoteIdentifier(resolution.rootPhysicalTable)}.*`];

  const fromSql = resolution.rootPhysicalSchema
    ? `${dialect.quoteIdentifier(resolution.rootPhysicalSchema)}.${dialect.quoteIdentifier(resolution.rootPhysicalTable)}`
    : dialect.quoteIdentifier(resolution.rootPhysicalTable);

  const joinSql = optimized.joins
    .map((j) => {
      const resolvedJoin = resolution.joins.find((rj) => rj.alias === j.alias);
      if (!resolvedJoin) return null;
      const left = qualify(dialect, resolution.rootPhysicalTable, resolvedJoin.onLeftColumn);
      const right = qualify(dialect, resolvedJoin.physicalTable, resolvedJoin.onRightColumn);
      return `INNER JOIN ${dialect.quoteIdentifier(resolvedJoin.physicalTable)} ON ${left} = ${right}`;
    })
    .filter((j): j is string => j !== null);

  const whereParts = optimized.filters.map(renderNode).filter((p): p is string => p !== null);

  const orderByParts = optimized.sorting
    .map((s: QuerySort) => {
      const col = columnSql(s.field);
      return col ? `${col} ${s.direction}` : null;
    })
    .filter((p): p is string => p !== null);
  const orderBySql = orderByParts.length > 0 ? `ORDER BY ${orderByParts.join(', ')}` : '';

  if (errors.length > 0) return { ok: false, errors };

  let selectSql = `SELECT ${selectColumns.join(', ')} FROM ${fromSql}`;
  if (joinSql.length > 0) selectSql += ` ${joinSql.join(' ')}`;
  if (whereParts.length > 0) selectSql += ` WHERE ${whereParts.join(' AND ')}`;

  const sql = pagination
    ? dialect.paginate(selectSql, orderBySql, pagination.limit, pagination.offset)
    : orderBySql
      ? `${selectSql} ${orderBySql}`
      : selectSql;

  return { ok: true, sql, parameters: params.build() };
}
