import type { CBLEntityKind } from '@seltriva/semantic-engine';

// ─── Query Plan — ERP-agnostic, canonical-level query description ─────────
//
// A QueryPlan never references physical tables/columns — only canonical
// entity/field names already validated against an organization's approved
// Canonical Business Model (Sprint 46.11). Translating a plan into real SQL
// for a specific ERP's schema is Sprint 46.13's job, not this module's.

export type QueryOperator =
  | 'EQ'
  | 'NE'
  | 'GT'
  | 'LT'
  | 'GTE'
  | 'LTE'
  | 'BETWEEN'
  | 'IN'
  | 'LIKE'
  | 'IS_NULL'
  | 'NOT_NULL';

export type QueryLiteral = string | number | boolean | Array<string | number> | null;

export type QueryValue =
  | { kind: 'literal'; value: QueryLiteral }
  | { kind: 'field'; field: string }
  | { kind: 'relativeDate'; days: number };

export interface QueryFilter {
  readonly field: string;
  readonly operator: QueryOperator;
  readonly value?: QueryValue;
}

export interface QueryFilterGroup {
  readonly logic: 'AND' | 'OR';
  readonly filters: readonly QueryFilterNode[];
}

export type QueryFilterNode = QueryFilter | QueryFilterGroup;

export function isFilterGroup(node: QueryFilterNode): node is QueryFilterGroup {
  return 'logic' in node;
}

export interface QueryProjection {
  readonly field: string;
  readonly alias?: string;
}

export interface QuerySort {
  readonly field: string;
  readonly direction: 'ASC' | 'DESC';
}

export interface QueryJoin {
  readonly alias: string;
  readonly entity: CBLEntityKind;
  readonly viaRootField: string;
}

export interface QueryPagination {
  readonly limit: number;
  readonly offset: number;
}

export interface QueryPlanRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly canonicalModelId: string;
  readonly canonicalVersion: string;
  readonly rootEntity: CBLEntityKind;
  readonly joins: readonly QueryJoin[];
  readonly projections: readonly QueryProjection[];
  readonly filters: readonly QueryFilterNode[];
  readonly sorting: readonly QuerySort[];
  readonly pagination: QueryPagination | null;
  readonly createdAt: string;
  readonly createdBy: string;
}

// ─── Raw intent input (what callers actually POST) ─────────────────────────

export interface RawFilterInput {
  field?: string;
  operator?: QueryOperator;
  value?: unknown;
  logic?: 'AND' | 'OR';
  filters?: RawFilterInput[];
}

export interface RawSortInput {
  field: string;
  direction?: 'ASC' | 'DESC';
}

export interface RawPaginationInput {
  limit?: number;
  offset?: number;
}

export interface QueryIntentInput {
  organizationId?: string;
  /** Pins the plan to a specific historical CBM version instead of the org's current approved one. */
  canonicalModelId?: string;
  entity?: string;
  filters?: RawFilterInput[];
  projections?: string[];
  sorting?: RawSortInput[];
  pagination?: RawPaginationInput;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type PlanValidationErrorCode =
  | 'NO_CANONICAL_MODEL'
  | 'UNKNOWN_CANONICAL_VERSION'
  | 'MODEL_ORGANIZATION_MISMATCH'
  | 'ENTITY_NOT_FOUND'
  | 'FIELD_NOT_FOUND'
  | 'INVALID_RELATIONSHIP'
  | 'OPERATOR_TYPE_MISMATCH'
  | 'INVALID_PAGINATION';

export interface PlanValidationError {
  readonly code: PlanValidationErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface ResolvedPlanInput {
  readonly organizationId: string;
  readonly canonicalModelId: string;
  readonly canonicalVersion: string;
  readonly rootEntity: CBLEntityKind;
  readonly joins: QueryJoin[];
  readonly projections: QueryProjection[];
  readonly filters: QueryFilterNode[];
  readonly sorting: QuerySort[];
  readonly pagination: QueryPagination | null;
}

export type ValidateIntentResult =
  | { ok: true; resolved: ResolvedPlanInput }
  | { ok: false; errors: PlanValidationError[] };
