import { isFilterGroup } from '../query-planner/types.js';
import type {
  QueryFilter,
  QueryFilterNode,
  QueryJoin,
  QueryOperator,
  QueryPlanRecord,
  QueryProjection,
  QuerySort,
} from '../query-planner/types.js';

export interface OptimizedPlan {
  readonly filters: readonly QueryFilterNode[];
  readonly projections: readonly QueryProjection[];
  readonly sorting: readonly QuerySort[];
  readonly joins: readonly QueryJoin[];
  readonly notes: readonly string[];
}

// Cheaper/more selective operators are evaluated first — equality and
// null-checks are near-free index lookups, range/set checks cost more,
// pattern matching is the most expensive and belongs last.
const OPERATOR_COST: Readonly<Record<QueryOperator, number>> = {
  EQ: 0,
  NE: 0,
  IS_NULL: 0,
  NOT_NULL: 0,
  IN: 1,
  GT: 2,
  GTE: 2,
  LT: 2,
  LTE: 2,
  BETWEEN: 2,
  LIKE: 3,
};

function filterKey(filter: QueryFilter): string {
  return `${filter.field}|${filter.operator}|${JSON.stringify(filter.value ?? null)}`;
}

function dedupeAndOrder(nodes: readonly QueryFilterNode[], notes: string[]): QueryFilterNode[] {
  const seen = new Set<string>();
  const result: QueryFilterNode[] = [];
  for (const node of nodes) {
    if (isFilterGroup(node)) {
      const children = dedupeAndOrder(node.filters, notes);
      result.push({ logic: node.logic, filters: children });
      continue;
    }
    const key = filterKey(node);
    if (seen.has(key)) {
      notes.push(`Removed redundant duplicate filter: ${node.field} ${node.operator}`);
      continue;
    }
    seen.add(key);
    result.push(node);
  }
  return result.slice().sort((a, b) => {
    const costA = isFilterGroup(a) ? 1.5 : OPERATOR_COST[a.operator];
    const costB = isFilterGroup(b) ? 1.5 : OPERATOR_COST[b.operator];
    return costA - costB;
  });
}

function fieldAliasOf(raw: string): string | null {
  const dot = raw.indexOf('.');
  return dot === -1 ? null : raw.slice(0, dot);
}

function collectReferencedAliases(
  filters: readonly QueryFilterNode[],
  projections: readonly QueryProjection[],
  sorting: readonly QuerySort[],
  joinAliases: ReadonlySet<string>
): Set<string> {
  const referenced = new Set<string>();
  const visitFilters = (nodes: readonly QueryFilterNode[]): void => {
    for (const node of nodes) {
      if (isFilterGroup(node)) {
        visitFilters(node.filters);
        continue;
      }
      const alias = fieldAliasOf(node.field);
      if (alias) referenced.add(alias);
      if (node.value?.kind === 'field') {
        const valueAlias = fieldAliasOf(node.value.field);
        if (valueAlias) referenced.add(valueAlias);
      }
    }
  };
  visitFilters(filters);
  for (const projection of projections) {
    const alias = fieldAliasOf(projection.field);
    if (alias) referenced.add(alias);
    else if (joinAliases.has(projection.field)) referenced.add(projection.field); // bare relationship-alias shorthand
  }
  for (const sort of sorting) {
    const alias = fieldAliasOf(sort.field);
    if (alias) referenced.add(alias);
  }
  return referenced;
}

/**
 * Applies real, visible transformations to a resolved QueryPlan before SQL
 * is rendered: dedupes and reduces redundant filter conditions, orders
 * predicates cheapest-first, drops joins nothing actually references, and
 * dedupes projections. Every change is recorded in `notes` so /explain can
 * show exactly what was optimized, not just claim that it was.
 */
export function optimizePlan(plan: QueryPlanRecord): OptimizedPlan {
  const notes: string[] = [];

  const filters = dedupeAndOrder(plan.filters, notes);
  if (filters.length > 0)
    notes.push('Ordered predicates cheapest-first (equality/null before range/set before LIKE)');

  const seenProjections = new Set<string>();
  const projections: QueryProjection[] = [];
  for (const projection of plan.projections) {
    const key = `${projection.field}|${projection.alias ?? ''}`;
    if (seenProjections.has(key)) {
      notes.push(`Removed duplicate projection: ${projection.field}`);
      continue;
    }
    seenProjections.add(key);
    projections.push(projection);
  }

  const joinAliases = new Set(plan.joins.map((j) => j.alias));
  const referencedAliases = collectReferencedAliases(
    filters,
    projections,
    plan.sorting,
    joinAliases
  );
  const joins = plan.joins.filter((j) => {
    const used = referencedAliases.has(j.alias);
    if (!used)
      notes.push(
        `Removed unused join: ${j.alias} (${j.entity}) — not referenced by any filter, projection, or sort`
      );
    return used;
  });

  return { filters, projections, sorting: plan.sorting, joins, notes };
}
