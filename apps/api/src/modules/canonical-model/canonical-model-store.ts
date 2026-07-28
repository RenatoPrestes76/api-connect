import { randomUUID } from 'node:crypto';
import {
  InMemoryCBMStore,
  InMemoryCBMSnapshotStore,
  type CanonicalBusinessModel,
  type CBMDiff,
} from '@seltriva/semantic-engine';
import { buildCanonicalModelForOrganization } from './canonical-model-builder.js';
import type { ApproveModelError, BuildError, RollbackError } from './types.js';

export type BuildModelResult =
  | {
      ok: true;
      model: CanonicalBusinessModel;
      profilesConsidered: number;
      profilesContributing: number;
    }
  | { ok: false; error: BuildError };
export type ApproveModelResult =
  | { ok: true; model: CanonicalBusinessModel }
  | { ok: false; error: ApproveModelError };
export type RollbackModelResult =
  | { ok: true; model: CanonicalBusinessModel; diff: CBMDiff }
  | { ok: false; error: RollbackError };

let _instance: CanonicalModelStore | null = null;

/**
 * Org-scoped orchestration over the real CBM implementation in
 * @seltriva/semantic-engine — this class owns *when* to build/approve/roll
 * back, the shared package owns the model shape and its versioning/diff
 * primitives. Every model's `name` is the organizationId, which is what
 * gives tenant isolation for free from InMemoryCBMStore's name-scoped
 * history.
 */
export class CanonicalModelStore {
  private cbmStore = new InMemoryCBMStore();
  private snapshotStore = new InMemoryCBMSnapshotStore();
  /** organizationId -> the modelId currently approved for production use by other Atlas modules. */
  private approvedModelIdByOrg = new Map<string, string>();

  static getInstance(): CanonicalModelStore {
    if (!_instance) _instance = new CanonicalModelStore();
    return _instance;
  }

  async build(organizationId: string): Promise<BuildModelResult> {
    const result = buildCanonicalModelForOrganization(organizationId);
    if (!result.ok) return { ok: false, error: result.error };

    await this.cbmStore.save(result.model);
    this.snapshotStore.take(result.model);
    return {
      ok: true,
      model: result.model,
      profilesConsidered: result.profilesConsidered,
      profilesContributing: result.profilesContributing,
    };
  }

  async getApproved(organizationId: string): Promise<CanonicalBusinessModel | null> {
    const modelId = this.approvedModelIdByOrg.get(organizationId);
    if (!modelId) return null;
    const result = await this.cbmStore.get(modelId);
    return result.success && result.data ? result.data : null;
  }

  async getLatestDraft(organizationId: string): Promise<CanonicalBusinessModel | null> {
    const result = await this.cbmStore.getLatest(organizationId);
    return result.success ? (result.data ?? null) : null;
  }

  async getModel(modelId: string): Promise<CanonicalBusinessModel | null> {
    const result = await this.cbmStore.get(modelId);
    return result.success && result.data ? result.data : null;
  }

  async history(organizationId: string): Promise<CanonicalBusinessModel[]> {
    return this.cbmStore.listHistory(organizationId);
  }

  async approve(organizationId: string, modelId: string): Promise<ApproveModelResult> {
    const model = await this.getModel(modelId);
    if (!model) return { ok: false, error: 'MODEL_NOT_FOUND' };
    if (model.name !== organizationId) return { ok: false, error: 'MODEL_ORGANIZATION_MISMATCH' };
    this.approvedModelIdByOrg.set(organizationId, modelId);
    return { ok: true, model };
  }

  /**
   * Restores an older version as the new latest — append-only, so nothing is
   * destroyed: the old versions (including the one just prior to rollback)
   * remain in history. The restored content is immediately re-approved,
   * since "rollback" implies putting it back into production use.
   */
  async rollback(organizationId: string, targetModelId: string): Promise<RollbackModelResult> {
    const target = await this.getModel(targetModelId);
    if (!target) return { ok: false, error: 'MODEL_NOT_FOUND' };
    if (target.name !== organizationId) return { ok: false, error: 'MODEL_ORGANIZATION_MISMATCH' };

    // Snapshot of whatever was latest *before* this rollback — the diff
    // should describe what the rollback actually undoes, not compare the
    // restored copy against its own source (which is trivially identical).
    const beforeRollback = await this.getLatestDraft(organizationId);
    const beforeSnapshots = beforeRollback
      ? await this.snapshotStore.listForModel(beforeRollback.id)
      : { data: undefined };
    const beforeSnapshot = beforeSnapshots.data?.[beforeSnapshots.data.length - 1];

    const restored: CanonicalBusinessModel = {
      ...target,
      id: randomUUID(),
      version: bumpVersion(target.version),
      updatedAt: new Date(),
    };
    await this.cbmStore.save(restored);
    const afterSnapshot = this.snapshotStore.take(restored).data;
    this.approvedModelIdByOrg.set(organizationId, restored.id);

    const diff =
      beforeSnapshot && afterSnapshot
        ? this.snapshotStore.diff(beforeSnapshot, afterSnapshot)
        : {
            addedEntities: [],
            removedEntities: [],
            remappedEntities: [],
            addedFields: [],
            removedFields: [],
            remappedFields: [],
            hasChanges: false,
          };

    return { ok: true, model: restored, diff };
  }
}

function bumpVersion(version: string): string {
  const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join('.');
}

export const canonicalModelStore = CanonicalModelStore.getInstance();
