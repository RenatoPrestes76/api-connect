import type { CanonicalBusinessModel, CBLEntityKind, CBMEntity } from '@seltriva/semantic-engine';
import type { DiscoveredRelationship } from '@seltriva/database-intelligence';
import { erpMetadataStore } from '../erp-metadata/erp-metadata-store.js';
import { resolveFieldAlias } from '../query-planner/canonical-vocabulary.js';
import type { QueryJoin, QueryPlanRecord } from '../query-planner/types.js';
import type { SqlGenerationError } from './types.js';

export interface ResolvedField {
  readonly tableAlias: string | null; // null => root
  readonly physicalTable: string;
  readonly physicalColumn: string;
}

export interface ResolvedJoinTable {
  readonly alias: string;
  readonly entity: CBLEntityKind;
  readonly physicalSchema: string;
  readonly physicalTable: string;
  readonly onLeftColumn: string;
  readonly onRightColumn: string;
}

export interface PhysicalResolution {
  readonly profileId: string;
  readonly rootEntity: CBMEntity;
  readonly rootPhysicalSchema: string;
  readonly rootPhysicalTable: string;
  readonly joins: readonly ResolvedJoinTable[];
  resolveField(raw: string): ResolvedField | null;
}

interface MetaFields {
  profileId?: string;
  schema?: string;
  table?: string;
}

function metaOf(entity: CBMEntity): MetaFields {
  return (entity.metadata as MetaFields | undefined) ?? {};
}

function findPhysicalRelationship(
  relationships: readonly DiscoveredRelationship[],
  tableA: { schema: string; table: string },
  tableB: { schema: string; table: string }
): { leftColumn: string; rightColumn: string } | null {
  for (const rel of relationships) {
    if (rel.fromTable === tableA.table && rel.toTable === tableB.table) {
      return { leftColumn: rel.fromColumn, rightColumn: rel.toColumn };
    }
    if (rel.fromTable === tableB.table && rel.toTable === tableA.table) {
      return { leftColumn: rel.toColumn, rightColumn: rel.fromColumn };
    }
  }
  return null;
}

/**
 * Resolves a QueryPlan's canonical entity/field references into physical
 * table/column names for one specific connected ERP — reusing the *same*
 * approved-mapping data (canonical-model 46.11) and discovered-relationship
 * data (erp-metadata 46.9) that already exists, never re-querying the
 * customer's database.
 */
export function resolvePhysicalPlan(
  plan: QueryPlanRecord,
  model: CanonicalBusinessModel,
  entityInstanceId: string | undefined
): { ok: true; resolution: PhysicalResolution } | { ok: false; errors: SqlGenerationError[] } {
  const errors: SqlGenerationError[] = [];

  const rootCandidates = model.entities.filter((e) => e.entityKind === plan.rootEntity);
  let rootEntity: CBMEntity | undefined;
  if (entityInstanceId) {
    rootEntity = rootCandidates.find((e) => e.id === entityInstanceId);
    if (!rootEntity) {
      return {
        ok: false,
        errors: [
          {
            code: 'ENTITY_INSTANCE_NOT_FOUND',
            message: `No entity instance "${entityInstanceId}" found for ${plan.rootEntity}`,
          },
        ],
      };
    }
  } else if (rootCandidates.length === 1) {
    rootEntity = rootCandidates[0];
  } else if (rootCandidates.length === 0) {
    return {
      ok: false,
      errors: [
        {
          code: 'ENTITY_INSTANCE_NOT_FOUND',
          message: `No connected ERP contributes a ${plan.rootEntity} entity to this canonical model`,
        },
      ],
    };
  } else {
    return {
      ok: false,
      errors: [
        {
          code: 'AMBIGUOUS_ENTITY_INSTANCE',
          message: `Multiple ERPs contribute a ${plan.rootEntity} entity (${rootCandidates.map((e) => e.id).join(', ')}) — specify entityInstanceId`,
        },
      ],
    };
  }
  if (!rootEntity) {
    return {
      ok: false,
      errors: [{ code: 'ENTITY_INSTANCE_NOT_FOUND', message: 'Root entity could not be resolved' }],
    };
  }

  const rootMeta = metaOf(rootEntity);
  if (!rootMeta.profileId || !rootMeta.schema || !rootMeta.table) {
    return {
      ok: false,
      errors: [
        {
          code: 'ENTITY_INSTANCE_NOT_FOUND',
          message: 'The resolved entity instance is missing physical source metadata',
        },
      ],
    };
  }
  const profileId: string = rootMeta.profileId;
  const rootSchema: string = rootMeta.schema;
  const rootTable: string = rootMeta.table;
  const resolvedRootEntity: CBMEntity = rootEntity;

  const report = erpMetadataStore.getReport(profileId);
  const relationships = report?.relationships ?? [];

  const resolvedJoins: ResolvedJoinTable[] = [];
  for (const join of plan.joins as readonly QueryJoin[]) {
    const candidates = model.entities.filter(
      (e) => e.entityKind === join.entity && metaOf(e).profileId === profileId
    );
    if (candidates.length === 0) {
      errors.push({
        code: 'JOIN_SPANS_MULTIPLE_ERPS',
        message: `"${join.alias}" (${join.entity}) has no instance under the same ERP connection as ${plan.rootEntity} — a join cannot span two physical databases`,
      });
      continue;
    }
    const joinedEntity = candidates[0] as CBMEntity;
    const joinedMeta = metaOf(joinedEntity);
    if (!joinedMeta.schema || !joinedMeta.table) {
      errors.push({
        code: 'ENTITY_INSTANCE_NOT_FOUND',
        message: `"${join.alias}" is missing physical source metadata`,
      });
      continue;
    }
    const relationship = findPhysicalRelationship(
      relationships,
      { schema: rootSchema, table: rootTable },
      { schema: joinedMeta.schema, table: joinedMeta.table }
    );
    if (!relationship) {
      errors.push({
        code: 'NO_PHYSICAL_RELATIONSHIP_FOUND',
        message: `No discovered foreign key connects "${rootTable}" and "${joinedMeta.table}" — cannot build a JOIN for "${join.alias}"`,
      });
      continue;
    }
    resolvedJoins.push({
      alias: join.alias,
      entity: join.entity,
      physicalSchema: joinedMeta.schema,
      physicalTable: joinedMeta.table,
      onLeftColumn: relationship.leftColumn,
      onRightColumn: relationship.rightColumn,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const joinedByAlias = new Map<string, ResolvedJoinTable>(resolvedJoins.map((j) => [j.alias, j]));
  const joinedEntityByAlias = new Map<string, CBMEntity>(
    resolvedJoins.map((j) => [
      j.alias,
      model.entities.find(
        (e) => e.entityKind === j.entity && metaOf(e).profileId === profileId
      ) as CBMEntity,
    ])
  );

  function resolveField(raw: string): ResolvedField | null {
    const parts = raw.split('.');
    if (parts.length === 2) {
      const [aliasRaw, fieldRaw] = parts as [string, string];
      const join = joinedByAlias.get(aliasRaw);
      const joinedEntity = joinedEntityByAlias.get(aliasRaw);
      if (!join || !joinedEntity) return null;
      const fieldKind = resolveFieldAlias(fieldRaw);
      const field = fieldKind
        ? joinedEntity.fields.find((f) => f.fieldKind === fieldKind)
        : undefined;
      if (!field) return null;
      return {
        tableAlias: aliasRaw,
        physicalTable: join.physicalTable,
        physicalColumn: field.sourceName,
      };
    }

    const directKind = resolveFieldAlias(raw);
    const directField = directKind
      ? resolvedRootEntity.fields.find((f) => f.fieldKind === directKind)
      : undefined;
    if (directField) {
      return { tableAlias: null, physicalTable: rootTable, physicalColumn: directField.sourceName };
    }

    // Bare relationship-alias shorthand (e.g. "store" => store.name), matching query-planner's own resolution.
    const join = joinedByAlias.get(raw);
    const joinedEntity = joinedEntityByAlias.get(raw);
    if (join && joinedEntity) {
      const nameField = joinedEntity.fields.find((f) => f.fieldKind === 'NAME');
      if (nameField)
        return {
          tableAlias: raw,
          physicalTable: join.physicalTable,
          physicalColumn: nameField.sourceName,
        };
    }
    return null;
  }

  return {
    ok: true,
    resolution: {
      profileId,
      rootEntity,
      rootPhysicalSchema: rootSchema,
      rootPhysicalTable: rootTable,
      joins: resolvedJoins,
      resolveField,
    },
  };
}
