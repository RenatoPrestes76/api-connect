import type { SimpleFilterOperator } from './operators.js';

export interface SimpleFilter {
  readonly field: string;
  readonly operator: SimpleFilterOperator;
  readonly value?: unknown;
}

export interface CompoundFilter {
  readonly operator: 'and' | 'or';
  readonly filters: Filter[];
}

export type Filter = SimpleFilter | CompoundFilter;

export interface OrderBy {
  readonly column: string;
  readonly direction: 'ASC' | 'DESC';
}

export interface Join {
  readonly type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  readonly table: string;
  readonly on: string;
}

// ─── Simple filter constructors ───────────────────────────────────────────────

export function equals(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'eq', value };
}

export function notEquals(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'neq', value };
}

export function greaterThan(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'gt', value };
}

export function greaterThanOrEqual(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'gte', value };
}

export function lessThan(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'lt', value };
}

export function lessThanOrEqual(field: string, value: unknown): SimpleFilter {
  return { field, operator: 'lte', value };
}

export function between(field: string, min: unknown, max: unknown): SimpleFilter {
  return { field, operator: 'between', value: [min, max] };
}

export function like(field: string, pattern: string): SimpleFilter {
  return { field, operator: 'like', value: pattern };
}

export function inList(field: string, values: unknown[]): SimpleFilter {
  return { field, operator: 'in', value: values };
}

export function isNull(field: string): SimpleFilter {
  return { field, operator: 'isNull' };
}

export function isNotNull(field: string): SimpleFilter {
  return { field, operator: 'isNotNull' };
}

// ─── Compound filter constructors ─────────────────────────────────────────────

export function and(...filters: Filter[]): CompoundFilter {
  return { operator: 'and', filters };
}

export function or(...filters: Filter[]): CompoundFilter {
  return { operator: 'or', filters };
}
