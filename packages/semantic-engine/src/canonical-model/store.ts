import type { SemanticResult } from '../business-language/index.js';
import { ok, err } from './result.js';
import type { CanonicalBusinessModel, CBMListOptions, CBMStore, CBMSummary } from './index.js';

function toSummary(model: CanonicalBusinessModel): CBMSummary {
  return {
    id: model.id,
    name: model.name,
    domain: model.domain,
    entityCount: model.entities.length,
    averageConfidence: model.confidence,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

/**
 * In-memory, append-only CBMStore: every save() adds a new immutable model
 * version to that name's history — nothing is ever overwritten in place, so
 * `get(modelId)` always resolves any past version, which is what makes
 * rollback and diffing possible.
 */
export class InMemoryCBMStore implements CBMStore {
  private models = new Map<string, CanonicalBusinessModel>();
  /** name -> ordered list of modelIds, oldest first */
  private historyByName = new Map<string, string[]>();

  async save(model: CanonicalBusinessModel): Promise<SemanticResult<string>> {
    this.models.set(model.id, model);
    const history = this.historyByName.get(model.name) ?? [];
    history.push(model.id);
    this.historyByName.set(model.name, history);
    return ok(model.id);
  }

  async get(modelId: string): Promise<SemanticResult<CanonicalBusinessModel>> {
    const model = this.models.get(modelId);
    if (!model) return err('REGISTRY_ERROR', `No canonical model found with id "${modelId}"`);
    return ok(model);
  }

  async getLatest(name: string): Promise<SemanticResult<CanonicalBusinessModel | null>> {
    const history = this.historyByName.get(name);
    if (!history || history.length === 0) return ok(null);
    const latestId = history[history.length - 1] as string;
    return ok(this.models.get(latestId) ?? null);
  }

  async list(options: CBMListOptions = {}): Promise<SemanticResult<CBMSummary[]>> {
    let all = Array.from(this.models.values());
    if (options.domain) all = all.filter((m) => m.domain === options.domain);
    if (options.minConfidence !== undefined) {
      all = all.filter((m) => m.confidence >= (options.minConfidence as number));
    }
    all = all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const offset = options.offset ?? 0;
    const limit = options.limit ?? all.length;
    return ok(all.slice(offset, offset + limit).map(toSummary));
  }

  async delete(modelId: string): Promise<SemanticResult<void>> {
    const model = this.models.get(modelId);
    if (!model) return err('REGISTRY_ERROR', `No canonical model found with id "${modelId}"`);
    this.models.delete(modelId);
    const history = this.historyByName.get(model.name);
    if (history) {
      this.historyByName.set(
        model.name,
        history.filter((id) => id !== modelId)
      );
    }
    return ok(undefined);
  }

  async exists(modelId: string): Promise<boolean> {
    return this.models.has(modelId);
  }

  /** Every past version for a name, oldest first — powers rollback listings. */
  async listHistory(name: string): Promise<CanonicalBusinessModel[]> {
    const history = this.historyByName.get(name) ?? [];
    return history.map((id) => this.models.get(id)).filter((m): m is CanonicalBusinessModel => !!m);
  }
}
