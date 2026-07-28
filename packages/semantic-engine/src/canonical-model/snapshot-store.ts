import { createHash, randomUUID } from 'node:crypto';
import type { SemanticResult } from '../business-language/index.js';
import { ok, err } from './result.js';
import type {
  CanonicalBusinessModel,
  CBMDiff,
  CBMEntity,
  CBMField,
  CBMSnapshot,
  CBMSnapshotStore,
} from './index.js';

/** Deterministic checksum over what actually defines a model's shape — its entity/field labels and mapping decisions, not ids or timestamps. */
export function computeCBMChecksum(model: CanonicalBusinessModel): string {
  const hash = createHash('sha256');
  const entities = [...model.entities].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  for (const entity of entities) {
    hash.update(`E|${entity.sourceName}|${entity.cblTerm}|${entity.mappingStatus}\n`);
    const fields = [...entity.fields].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    for (const field of fields) {
      hash.update(
        `F|${entity.sourceName}|${field.sourceName}|${field.cblTerm}|${field.mappingStatus}\n`
      );
    }
  }
  return hash.digest('hex');
}

/**
 * `CBMSnapshot` is deliberately lightweight (id + checksum + statistics) so
 * listing history stays cheap — but `diff()` is declared *synchronous* and
 * needs the full entity/field lists to say *what* changed, not just *that*
 * something changed. `take(model)` already receives the full model directly,
 * so this store retains it internally keyed by snapshotId — diff() reads
 * that cache synchronously instead of going through the (async) CBMStore.
 */
export class InMemoryCBMSnapshotStore implements CBMSnapshotStore {
  private snapshots = new Map<string, CBMSnapshot>();
  private modelsBySnapshot = new Map<string, CanonicalBusinessModel>();
  private snapshotIdsByModel = new Map<string, string[]>();

  take(model: CanonicalBusinessModel): SemanticResult<CBMSnapshot> {
    const snapshot: CBMSnapshot = {
      snapshotId: randomUUID(),
      modelId: model.id,
      version: model.version,
      checksum: computeCBMChecksum(model),
      takenAt: new Date(),
      statistics: model.statistics,
    };
    this.snapshots.set(snapshot.snapshotId, snapshot);
    this.modelsBySnapshot.set(snapshot.snapshotId, model);
    const list = this.snapshotIdsByModel.get(model.id) ?? [];
    list.push(snapshot.snapshotId);
    this.snapshotIdsByModel.set(model.id, list);
    return ok(snapshot);
  }

  async get(snapshotId: string): Promise<SemanticResult<CBMSnapshot>> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return err('REGISTRY_ERROR', `No snapshot found with id "${snapshotId}"`);
    return ok(snapshot);
  }

  async listForModel(modelId: string): Promise<SemanticResult<CBMSnapshot[]>> {
    const ids = this.snapshotIdsByModel.get(modelId) ?? [];
    const snapshots = ids.map((id) => this.snapshots.get(id)).filter((s): s is CBMSnapshot => !!s);
    return ok(snapshots);
  }

  diff(snapshotA: CBMSnapshot, snapshotB: CBMSnapshot): CBMDiff {
    const modelA = this.modelsBySnapshot.get(snapshotA.snapshotId);
    const modelB = this.modelsBySnapshot.get(snapshotB.snapshotId);
    return diffModels(modelA, modelB);
  }
}

function diffModels(
  modelA: CanonicalBusinessModel | undefined,
  modelB: CanonicalBusinessModel | undefined
): CBMDiff {
  const entitiesA = new Map((modelA?.entities ?? []).map((e) => [e.sourceName, e]));
  const entitiesB = new Map((modelB?.entities ?? []).map((e) => [e.sourceName, e]));

  const addedEntities: CBMEntity[] = [];
  const removedEntities: CBMEntity[] = [];
  const remappedEntities: Array<{
    entity: string;
    from: CBMEntity['cblTerm'];
    to: CBMEntity['cblTerm'];
  }> = [];
  const addedFields: Array<{ entity: string; field: CBMField }> = [];
  const removedFields: Array<{ entity: string; fieldName: string }> = [];
  const remappedFields: Array<{
    entity: string;
    field: string;
    from: CBMField['cblTerm'];
    to: CBMField['cblTerm'];
  }> = [];

  for (const [sourceName, entityB] of entitiesB) {
    const entityA = entitiesA.get(sourceName);
    if (!entityA) {
      addedEntities.push(entityB);
      continue;
    }
    if (entityA.cblTerm !== entityB.cblTerm) {
      remappedEntities.push({ entity: sourceName, from: entityA.cblTerm, to: entityB.cblTerm });
    }

    const fieldsA = new Map(entityA.fields.map((f) => [f.sourceName, f]));
    const fieldsB = new Map(entityB.fields.map((f) => [f.sourceName, f]));
    for (const [fieldName, fieldB] of fieldsB) {
      const fieldA = fieldsA.get(fieldName);
      if (!fieldA) {
        addedFields.push({ entity: sourceName, field: fieldB });
      } else if (fieldA.cblTerm !== fieldB.cblTerm) {
        remappedFields.push({
          entity: sourceName,
          field: fieldName,
          from: fieldA.cblTerm,
          to: fieldB.cblTerm,
        });
      }
    }
    for (const fieldName of fieldsA.keys()) {
      if (!fieldsB.has(fieldName)) removedFields.push({ entity: sourceName, fieldName });
    }
  }
  for (const [sourceName, entityA] of entitiesA) {
    if (!entitiesB.has(sourceName)) removedEntities.push(entityA);
  }

  const hasChanges =
    addedEntities.length > 0 ||
    removedEntities.length > 0 ||
    remappedEntities.length > 0 ||
    addedFields.length > 0 ||
    removedFields.length > 0 ||
    remappedFields.length > 0;

  return {
    addedEntities,
    removedEntities,
    remappedEntities,
    addedFields,
    removedFields,
    remappedFields,
    hasChanges,
  };
}
