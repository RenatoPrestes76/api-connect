import type { DatabaseIntelligenceReport } from '@seltriva/database-intelligence';
import { refineClassification } from './business-refinement.js';
import type { MappingSuggestion } from './types.js';

/**
 * Turns an already-computed erp-metadata (Sprint 46.9) report into one
 * business-entity suggestion per discovered table. Never touches the
 * customer's database — operates purely on the cached
 * DatabaseIntelligenceReport that erp-metadata's discovery flow produced.
 */
export function analyzeReport(report: DatabaseIntelligenceReport): MappingSuggestion[] {
  const classifications = Object.values(report.entities).flat();
  const entityByTable = new Map(classifications.map((c) => [c.tableName, c.entity]));
  return classifications.map((classification) => {
    const refined = refineClassification(classification, report.relationships, entityByTable);
    return {
      schema: classification.tableSchema,
      table: classification.tableName,
      athenaEntity: classification.entity,
      suggestedEntity: refined.suggestedEntity,
      confidence: refined.confidence,
      reasons: refined.reasons,
      alternatives: refined.alternatives,
    } satisfies MappingSuggestion;
  });
}
