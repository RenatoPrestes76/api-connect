import { randomUUID } from 'node:crypto';
import { canonicalModelStore } from '../canonical-model/canonical-model-store.js';
import { validateIntent } from './query-validator.js';
import type {
  PlanValidationError,
  QueryIntentInput,
  QueryPlanRecord,
  ValidateIntentResult,
} from './types.js';

export type PlanResult =
  | { ok: true; plan: QueryPlanRecord }
  | { ok: false; errors: PlanValidationError[] };

let _instance: QueryPlannerStore | null = null;

export class QueryPlannerStore {
  private plans: QueryPlanRecord[] = [];

  static getInstance(): QueryPlannerStore {
    if (!_instance) _instance = new QueryPlannerStore();
    return _instance;
  }

  /** Resolves the model this intent should validate against — a pinned historical version if given, else the org's current approved model. */
  private async resolveModel(
    input: QueryIntentInput,
    organizationId: string
  ): Promise<
    | { ok: true; model: Awaited<ReturnType<typeof canonicalModelStore.getApproved>> }
    | { ok: false; errors: PlanValidationError[] }
  > {
    if (input.canonicalModelId) {
      const model = await canonicalModelStore.getModel(input.canonicalModelId);
      if (!model) {
        return {
          ok: false as const,
          errors: [
            {
              code: 'UNKNOWN_CANONICAL_VERSION' as const,
              message: `No canonical model found with id "${input.canonicalModelId}"`,
            },
          ],
        };
      }
      return { ok: true as const, model };
    }
    const model = await canonicalModelStore.getApproved(organizationId);
    return { ok: true as const, model };
  }

  async validate(
    input: QueryIntentInput,
    organizationId: string,
    actorEmail: string
  ): Promise<ValidateIntentResult> {
    void actorEmail;
    const modelResult = await this.resolveModel(input, organizationId);
    if (!modelResult.ok) return { ok: false, errors: modelResult.errors };
    return validateIntent(input, modelResult.model, organizationId);
  }

  async createPlan(
    input: QueryIntentInput,
    organizationId: string,
    actorEmail: string
  ): Promise<PlanResult> {
    const result = await this.validate(input, organizationId, actorEmail);
    if (!result.ok) return { ok: false, errors: result.errors };

    const plan: QueryPlanRecord = {
      id: randomUUID(),
      organizationId: result.resolved.organizationId,
      canonicalModelId: result.resolved.canonicalModelId,
      canonicalVersion: result.resolved.canonicalVersion,
      rootEntity: result.resolved.rootEntity,
      joins: result.resolved.joins,
      projections: result.resolved.projections,
      filters: result.resolved.filters,
      sorting: result.resolved.sorting,
      pagination: result.resolved.pagination,
      createdAt: new Date().toISOString(),
      createdBy: actorEmail,
    };
    this.plans.push(plan);
    return { ok: true, plan };
  }

  getById(id: string): QueryPlanRecord | undefined {
    return this.plans.find((p) => p.id === id);
  }

  history(
    organizationId: string,
    limit = 50,
    offset = 0
  ): { total: number; plans: QueryPlanRecord[] } {
    const forOrg = this.plans
      .filter((p) => p.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { total: forOrg.length, plans: forOrg.slice(offset, offset + limit) };
  }
}

export const queryPlannerStore = QueryPlannerStore.getInstance();
