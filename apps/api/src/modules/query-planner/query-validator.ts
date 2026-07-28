import type {
  CanonicalBusinessModel,
  CBLEntityKind,
  CBLFieldKind,
  CBMEntity,
} from '@seltriva/semantic-engine';
import {
  CANONICAL_RELATIONSHIPS,
  FIELD_VALUE_KINDS,
  resolveEntityAlias,
  resolveFieldAlias,
} from './canonical-vocabulary.js';
import { isFilterGroup } from './types.js';
import type {
  PlanValidationError,
  QueryFilter,
  QueryFilterNode,
  QueryIntentInput,
  QueryJoin,
  QueryOperator,
  QueryPagination,
  QueryProjection,
  QuerySort,
  QueryValue,
  RawFilterInput,
  ValidateIntentResult,
} from './types.js';

const NUMERIC_OPERATORS: readonly QueryOperator[] = ['GT', 'LT', 'GTE', 'LTE', 'BETWEEN'];
const NULLARY_OPERATORS: readonly QueryOperator[] = ['IS_NULL', 'NOT_NULL'];
const MULTI_VALUE_OPERATORS: readonly QueryOperator[] = ['IN', 'BETWEEN'];

interface FieldPath {
  readonly entityAlias: string | null; // null => rootEntity
  readonly entity: CBLEntityKind;
  readonly fieldKind: CBLFieldKind;
  readonly raw: string;
}

/**
 * Resolves an org's current (or a pinned historical) Canonical Business
 * Model and validates a raw QueryIntentInput against it, producing either a
 * fully-resolved plan or the complete list of validation problems (not just
 * the first one — a caller building a UI wants every issue at once).
 */
export function validateIntent(
  input: QueryIntentInput,
  model: CanonicalBusinessModel | null,
  organizationId: string
): ValidateIntentResult {
  const errors: PlanValidationError[] = [];

  if (!model) {
    return {
      ok: false,
      errors: [
        {
          code: 'NO_CANONICAL_MODEL',
          message:
            'This organization has no canonical business model yet — build and approve one first',
        },
      ],
    };
  }
  if (model.name !== organizationId) {
    return {
      ok: false,
      errors: [
        {
          code: 'MODEL_ORGANIZATION_MISMATCH',
          message: 'The referenced canonical model does not belong to this organization',
        },
      ],
    };
  }

  const entityIndex = new Map<CBLEntityKind, CBMEntity>();
  for (const entity of model.entities) entityIndex.set(entity.entityKind, entity);

  if (!input.entity) {
    errors.push({ code: 'ENTITY_NOT_FOUND', message: 'entity is required', path: 'entity' });
    return { ok: false, errors };
  }
  const rootEntity =
    resolveEntityAlias(input.entity) ?? (input.entity.toUpperCase() as CBLEntityKind);
  const maybeRootCbmEntity = entityIndex.get(rootEntity);
  if (!maybeRootCbmEntity) {
    errors.push({
      code: 'ENTITY_NOT_FOUND',
      message: `Entity "${input.entity}" was not found in this organization's canonical model`,
      path: 'entity',
    });
    return { ok: false, errors };
  }
  const rootCbmEntity: CBMEntity = maybeRootCbmEntity;

  const joinsByAlias = new Map<string, QueryJoin>();

  function resolveFieldPath(raw: string, path: string): FieldPath | null {
    const parts = raw.split('.');
    if (parts.length === 2) {
      const [aliasRaw, fieldRaw] = parts as [string, string];
      const relationships = CANONICAL_RELATIONSHIPS[rootEntity] ?? [];
      const relationship = relationships.find(
        (r) => r.alias.toLowerCase() === aliasRaw.toLowerCase()
      );
      if (!relationship) {
        errors.push({
          code: 'INVALID_RELATIONSHIP',
          message: `"${aliasRaw}" is not a valid relationship from ${rootEntity}`,
          path,
        });
        return null;
      }
      const targetEntity = entityIndex.get(relationship.toEntity);
      if (!targetEntity) {
        errors.push({
          code: 'ENTITY_NOT_FOUND',
          message: `Related entity "${relationship.toEntity}" (via "${aliasRaw}") was not found in this organization's canonical model`,
          path,
        });
        return null;
      }
      const fieldKind = resolveFieldAlias(fieldRaw);
      if (!fieldKind || !targetEntity.fields.some((f) => f.fieldKind === fieldKind)) {
        errors.push({
          code: 'FIELD_NOT_FOUND',
          message: `Field "${fieldRaw}" was not found on entity "${relationship.toEntity}"`,
          path,
        });
        return null;
      }
      if (!joinsByAlias.has(relationship.alias)) {
        joinsByAlias.set(relationship.alias, {
          alias: relationship.alias,
          entity: relationship.toEntity,
          viaRootField: relationship.alias,
        });
      }
      return { entityAlias: relationship.alias, entity: relationship.toEntity, fieldKind, raw };
    }

    const directFieldKind = resolveFieldAlias(raw);
    if (directFieldKind && rootCbmEntity.fields.some((f) => f.fieldKind === directFieldKind)) {
      return { entityAlias: null, entity: rootEntity, fieldKind: directFieldKind, raw };
    }

    // Bare relationship alias used as a projection shorthand (e.g. "store" => store.name).
    const relationships = CANONICAL_RELATIONSHIPS[rootEntity] ?? [];
    const relationship = relationships.find((r) => r.alias.toLowerCase() === raw.toLowerCase());
    if (relationship) {
      const targetEntity = entityIndex.get(relationship.toEntity);
      if (!targetEntity || !targetEntity.fields.some((f) => f.fieldKind === 'NAME')) {
        errors.push({
          code: 'FIELD_NOT_FOUND',
          message: `Related entity "${relationship.toEntity}" (via "${raw}") has no NAME field to project`,
          path,
        });
        return null;
      }
      if (!joinsByAlias.has(relationship.alias)) {
        joinsByAlias.set(relationship.alias, {
          alias: relationship.alias,
          entity: relationship.toEntity,
          viaRootField: relationship.alias,
        });
      }
      return {
        entityAlias: relationship.alias,
        entity: relationship.toEntity,
        fieldKind: 'NAME',
        raw,
      };
    }

    errors.push({
      code: 'FIELD_NOT_FOUND',
      message: `Field "${raw}" was not found on entity "${rootEntity}"`,
      path,
    });
    return null;
  }

  function normalizeValue(raw: unknown, path: string): QueryValue | undefined {
    if (raw === undefined) return undefined;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      if (typeof obj['relativeDays'] === 'number') {
        return { kind: 'relativeDate', days: obj['relativeDays'] };
      }
      if (typeof obj['field'] === 'string') {
        const fieldPath = resolveFieldPath(obj['field'], `${path}.value.field`);
        return fieldPath ? { kind: 'field', field: obj['field'] } : undefined;
      }
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: `Unrecognized value shape at ${path}`,
        path,
      });
      return undefined;
    }
    return {
      kind: 'literal',
      value: raw as QueryValue extends { kind: 'literal'; value: infer V } ? V : never,
    };
  }

  function checkOperatorCompatibility(
    fieldPath: FieldPath,
    operator: QueryOperator,
    value: QueryValue | undefined,
    path: string
  ): void {
    if (NULLARY_OPERATORS.includes(operator)) {
      if (value !== undefined) {
        errors.push({
          code: 'OPERATOR_TYPE_MISMATCH',
          message: `Operator ${operator} does not take a value`,
          path,
        });
      }
      return;
    }
    if (value === undefined) {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: `Operator ${operator} requires a value`,
        path,
      });
      return;
    }
    if (value.kind === 'field') return; // field-to-field comparisons are validated structurally only
    if (value.kind === 'relativeDate') {
      const valueKind = FIELD_VALUE_KINDS[fieldPath.fieldKind];
      if (valueKind !== 'date') {
        errors.push({
          code: 'OPERATOR_TYPE_MISMATCH',
          message: `A relative date value cannot be used with field "${fieldPath.raw}" (${valueKind})`,
          path,
        });
      }
      return;
    }

    const valueKind = FIELD_VALUE_KINDS[fieldPath.fieldKind];
    if (operator === 'LIKE' && valueKind !== 'string') {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: `LIKE can only be used on text fields, not "${fieldPath.raw}" (${valueKind})`,
        path,
      });
    }
    if (NUMERIC_OPERATORS.includes(operator) && valueKind !== 'number' && valueKind !== 'date') {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: `${operator} requires a numeric or date field, not "${fieldPath.raw}" (${valueKind})`,
        path,
      });
    }
    if (operator === 'BETWEEN' && (!Array.isArray(value.value) || value.value.length !== 2)) {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: 'BETWEEN requires an array of exactly two values',
        path,
      });
    }
    if (operator === 'IN' && !Array.isArray(value.value)) {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: 'IN requires an array of values',
        path,
      });
    }
    if (!MULTI_VALUE_OPERATORS.includes(operator) && Array.isArray(value.value)) {
      errors.push({
        code: 'OPERATOR_TYPE_MISMATCH',
        message: `${operator} does not accept an array value`,
        path,
      });
    }
  }

  function resolveFilterNode(raw: RawFilterInput, path: string): QueryFilterNode | null {
    if (raw.logic) {
      if (!Array.isArray(raw.filters) || raw.filters.length === 0) {
        errors.push({
          code: 'OPERATOR_TYPE_MISMATCH',
          message: 'A filter group requires a non-empty "filters" array',
          path,
        });
        return null;
      }
      const resolvedChildren = raw.filters
        .map((child, i) => resolveFilterNode(child, `${path}.filters[${i}]`))
        .filter((n): n is QueryFilterNode => n !== null);
      if (resolvedChildren.length === 0) return null;
      return { logic: raw.logic, filters: resolvedChildren };
    }

    if (!raw.field || !raw.operator) {
      errors.push({
        code: 'FIELD_NOT_FOUND',
        message: 'Each filter requires a "field" and "operator"',
        path,
      });
      return null;
    }
    const fieldPath = resolveFieldPath(raw.field, `${path}.field`);
    if (!fieldPath) return null;
    const value = normalizeValue(raw.value, path);
    checkOperatorCompatibility(fieldPath, raw.operator, value, path);
    const filter: QueryFilter = { field: raw.field, operator: raw.operator, value };
    return filter;
  }

  const filters: QueryFilterNode[] = [];
  (input.filters ?? []).forEach((raw, i) => {
    const resolved = resolveFilterNode(raw, `filters[${i}]`);
    if (resolved) filters.push(resolved);
  });

  const projections: QueryProjection[] = [];
  (input.projections ?? []).forEach((raw, i) => {
    const fieldPath = resolveFieldPath(raw, `projections[${i}]`);
    if (fieldPath) {
      projections.push({
        field: fieldPath.entityAlias ? `${fieldPath.entityAlias}.${raw.split('.')[1] ?? raw}` : raw,
      });
    }
  });

  const sorting: QuerySort[] = [];
  (input.sorting ?? []).forEach((raw, i) => {
    const fieldPath = resolveFieldPath(raw.field, `sorting[${i}].field`);
    if (fieldPath) {
      sorting.push({ field: raw.field, direction: raw.direction === 'DESC' ? 'DESC' : 'ASC' });
    }
  });

  let pagination: QueryPagination | null = null;
  if (input.pagination) {
    const limit = input.pagination.limit ?? 50;
    const offset = input.pagination.offset ?? 0;
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      errors.push({
        code: 'INVALID_PAGINATION',
        message: 'limit must be an integer between 1 and 1000',
        path: 'pagination.limit',
      });
    }
    if (!Number.isInteger(offset) || offset < 0) {
      errors.push({
        code: 'INVALID_PAGINATION',
        message: 'offset must be a non-negative integer',
        path: 'pagination.offset',
      });
    }
    pagination = { limit, offset };
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    resolved: {
      organizationId,
      canonicalModelId: model.id,
      canonicalVersion: model.version,
      rootEntity,
      joins: Array.from(joinsByAlias.values()),
      projections,
      filters,
      sorting,
      pagination,
    },
  };
}

export { isFilterGroup };
