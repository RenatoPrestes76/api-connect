import { erpMetadataStore } from '../erp-metadata/erp-metadata-store.js';
import { SEMANTIC_MODEL_VERSION } from './business-refinement.js';
import { analyzeReport } from './semantic-mapping-engine.js';
import type {
  AnalyzeError,
  AnalyzeSummary,
  ApproveError,
  ApproveInput,
  MappingRecord,
  MappingRecordDTO,
  MappingStatus,
} from './types.js';
import { ALL_BUSINESS_ENTITY_TYPES } from './types.js';

export type AnalyzeResult =
  | { ok: true; summary: AnalyzeSummary; records: MappingRecord[] }
  | { ok: false; error: AnalyzeError };
export type ApproveResult =
  | { ok: true; record: MappingRecord }
  | { ok: false; error: ApproveError };

let _instance: SemanticMappingStore | null = null;

export class SemanticMappingStore {
  /** profileId -> "schema.table" -> record */
  private records = new Map<string, Map<string, MappingRecord>>();

  static getInstance(): SemanticMappingStore {
    if (!_instance) _instance = new SemanticMappingStore();
    return _instance;
  }

  private key(schema: string, table: string): string {
    return `${schema}.${table}`;
  }

  /**
   * Re-runs the business refinement engine over the profile's current
   * erp-metadata report. Approved mappings are preserved whenever possible —
   * only their suggestion/reasons/alternatives are refreshed for review
   * visibility, never their approved entity or status.
   */
  analyze(profileId: string, actorEmail: string): AnalyzeResult {
    const report = erpMetadataStore.getReport(profileId);
    if (!report) return { ok: false, error: 'NOT_DISCOVERED' };

    const suggestions = analyzeReport(report);
    const now = new Date().toISOString();
    const profileRecords = this.records.get(profileId) ?? new Map<string, MappingRecord>();

    let suggested = 0;
    let resuggested = 0;
    let preserved = 0;

    for (const suggestion of suggestions) {
      const k = this.key(suggestion.schema, suggestion.table);
      const existing = profileRecords.get(k);

      if (!existing) {
        profileRecords.set(k, {
          profileId,
          schema: suggestion.schema,
          table: suggestion.table,
          status: 'PENDING',
          athenaEntity: suggestion.athenaEntity,
          suggestedEntity: suggestion.suggestedEntity,
          suggestedConfidence: suggestion.confidence,
          reasons: suggestion.reasons,
          alternatives: suggestion.alternatives,
          conflicts: suggestion.conflicts,
          reasoning: suggestion.reasoning,
          approvedEntity: null,
          approvedBy: null,
          approvedAt: null,
          modelVersion: SEMANTIC_MODEL_VERSION,
          createdAt: now,
          updatedAt: now,
          history: [
            {
              action: 'SUGGESTED',
              entity: suggestion.suggestedEntity,
              confidence: suggestion.confidence,
              modelVersion: SEMANTIC_MODEL_VERSION,
              actorEmail,
              createdAt: now,
            },
          ],
        });
        suggested += 1;
        continue;
      }

      if (existing.status === 'APPROVED') {
        const changed = existing.suggestedEntity !== suggestion.suggestedEntity;
        existing.suggestedEntity = suggestion.suggestedEntity;
        existing.suggestedConfidence = suggestion.confidence;
        existing.reasons = suggestion.reasons;
        existing.alternatives = suggestion.alternatives;
        existing.conflicts = suggestion.conflicts;
        existing.reasoning = suggestion.reasoning;
        existing.athenaEntity = suggestion.athenaEntity;
        existing.modelVersion = SEMANTIC_MODEL_VERSION;
        existing.updatedAt = now;
        if (changed) {
          existing.history.push({
            action: 'PRESERVED_ON_REANALYSIS',
            entity: existing.approvedEntity ?? existing.suggestedEntity,
            confidence: null,
            modelVersion: SEMANTIC_MODEL_VERSION,
            actorEmail,
            createdAt: now,
          });
        }
        preserved += 1;
        continue;
      }

      const changed = existing.suggestedEntity !== suggestion.suggestedEntity;
      existing.suggestedEntity = suggestion.suggestedEntity;
      existing.suggestedConfidence = suggestion.confidence;
      existing.reasons = suggestion.reasons;
      existing.alternatives = suggestion.alternatives;
      existing.conflicts = suggestion.conflicts;
      existing.reasoning = suggestion.reasoning;
      existing.athenaEntity = suggestion.athenaEntity;
      existing.status = 'PENDING';
      existing.modelVersion = SEMANTIC_MODEL_VERSION;
      existing.updatedAt = now;
      if (changed) {
        existing.history.push({
          action: 'RESUGGESTED',
          entity: suggestion.suggestedEntity,
          confidence: suggestion.confidence,
          modelVersion: SEMANTIC_MODEL_VERSION,
          actorEmail,
          createdAt: now,
        });
        resuggested += 1;
      }
    }

    this.records.set(profileId, profileRecords);

    const all = Array.from(profileRecords.values());
    const summary: AnalyzeSummary = {
      profileId,
      modelVersion: SEMANTIC_MODEL_VERSION,
      analyzedAt: now,
      tablesAnalyzed: suggestions.length,
      suggested,
      resuggested,
      preserved,
      pending: all.filter((r) => r.status === 'PENDING').length,
      approved: all.filter((r) => r.status === 'APPROVED').length,
    };
    return { ok: true, summary, records: all };
  }

  listEntities(profileId: string): MappingRecord[] {
    return Array.from(this.records.get(profileId)?.values() ?? []);
  }

  listForReview(profileId: string, status: MappingStatus = 'PENDING'): MappingRecord[] {
    return this.listEntities(profileId).filter((r) => r.status === status);
  }

  decide(input: ApproveInput): ApproveResult {
    const record = this.records.get(input.profileId)?.get(this.key(input.schema, input.table));
    if (!record) return { ok: false, error: 'NOT_ANALYZED' };

    if (input.decision === 'REJECT') {
      record.status = 'REJECTED';
      record.updatedAt = new Date().toISOString();
      record.history.push({
        action: 'REJECTED',
        entity: record.suggestedEntity,
        confidence: null,
        modelVersion: SEMANTIC_MODEL_VERSION,
        actorEmail: input.actorEmail,
        createdAt: record.updatedAt,
      });
      return { ok: true, record };
    }

    const finalEntity = input.entity ?? record.suggestedEntity;
    if (!ALL_BUSINESS_ENTITY_TYPES.includes(finalEntity)) {
      return { ok: false, error: 'INVALID_ENTITY' };
    }
    const isOverride = finalEntity !== record.suggestedEntity;

    record.status = 'APPROVED';
    record.approvedEntity = finalEntity;
    record.approvedBy = input.actorEmail;
    record.approvedAt = new Date().toISOString();
    record.updatedAt = record.approvedAt;
    record.history.push({
      action: isOverride ? 'OVERRIDDEN' : 'APPROVED',
      entity: finalEntity,
      confidence: record.suggestedConfidence,
      modelVersion: SEMANTIC_MODEL_VERSION,
      actorEmail: input.actorEmail,
      createdAt: record.approvedAt,
    });
    return { ok: true, record };
  }

  toDTO(record: MappingRecord): MappingRecordDTO {
    return { ...record };
  }
}

export const semanticMappingStore = SemanticMappingStore.getInstance();
