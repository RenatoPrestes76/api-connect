/**
 * EntityClassifier — classifies a table into a business entity.
 *
 * Also detects:
 *  - isAuxiliary: small table with no meaningful FKs pointing in
 *  - isJunctionTable: exactly 2 FK columns that form the PK, no other data columns
 */
import { CompositeScorer } from '../scoring/composite-scorer.js';
import type { SampledColumn } from '../scoring/sampling-scorer.js';
import type { EntityClassification, EntityType, FieldRoleMap, TableInput } from '../types/index.js';

function buildFieldRoleMap(
  assignments: ReturnType<CompositeScorer['score']>['fieldRoles']
): FieldRoleMap {
  const map = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) {
    map.set(a.columnName, a);
  }
  return map as FieldRoleMap;
}

function detectJunctionTable(table: TableInput): boolean {
  if (table.foreignKeys.length !== 2) return false;

  const fkColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns));
  if (fkColumns.size !== 2) return false;

  const pkColumns = new Set(table.primaryKey?.columns ?? []);
  if (pkColumns.size !== 2) return false;

  // PK must consist exactly of the 2 FK columns
  for (const col of fkColumns) {
    if (!pkColumns.has(col)) return false;
  }

  // No extra "data" columns beyond the FK/PK columns
  const extraColumns = table.columns.filter((c) => !fkColumns.has(c.name) && !c.isIdentity);

  return extraColumns.length <= 2; // allow up to 2 metadata cols (created_at, etc.)
}

function detectAuxiliary(
  table: TableInput,
  allTables: readonly TableInput[],
  estimatedRows: number | null,
  entity: EntityType
): boolean {
  // Known non-auxiliary entity types
  if (
    ['PRODUCT', 'CUSTOMER', 'SUPPLIER', 'SALE', 'PURCHASE', 'MOVEMENT', 'INVENTORY'].includes(
      entity
    )
  ) {
    return false;
  }

  const fewRows = estimatedRows !== null && estimatedRows < 500;
  const fewColumns = table.columns.length <= 5;

  // Count tables that reference this one
  const incomingRefs = allTables.filter((t) =>
    t.foreignKeys.some(
      (fk) => fk.referencedTable === table.name && fk.referencedSchema === table.schema
    )
  ).length;

  const hasNoOutgoingFks = table.foreignKeys.length === 0;

  return fewColumns && (fewRows || (hasNoOutgoingFks && incomingRefs > 0));
}

export class EntityClassifier {
  private readonly _scorer = new CompositeScorer();

  classify(
    table: TableInput,
    entityHints: Readonly<Partial<Record<string, EntityType>>>,
    allTables: readonly TableInput[],
    sampledColumns: readonly SampledColumn[] = []
  ): EntityClassification {
    const result = this._scorer.score(table, entityHints, allTables, sampledColumns);
    const fieldRoles: FieldRoleMap = buildFieldRoleMap(result.fieldRoles);
    const statResult = table.statistics?.estimatedRows ?? null;

    const isJunction = detectJunctionTable(table);
    const isAuxiliary = !isJunction && detectAuxiliary(table, allTables, statResult, result.entity);

    return {
      tableSchema: table.schema,
      tableName: table.name,
      entity: result.entity,
      confidence: result.confidence,
      reasons: result.reasons,
      alternatives: result.alternatives,
      fieldRoles,
      isAuxiliary,
      isJunctionTable: isJunction,
      estimatedRows: statResult,
    };
  }
}
