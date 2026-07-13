/**
 * POST /api/v1/discovery/analyze-schema
 *
 * Accepts a DatabaseSchema (from @seltriva/database-sdk) plus optional source
 * metadata, runs it through the ATHENA DatabaseScanner, and returns the full
 * intelligence report.  The analysisId can be used to fetch sub-views later.
 */
import type { DatabaseSchema } from '@seltriva/database-sdk';
import { DatabaseScanner } from '@seltriva/database-intelligence';
import type {
  DatabaseIntelligenceReport,
  EntityClassification,
  IntegrationSuggestion,
} from '@seltriva/database-intelligence';
import type { RouteHandler } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { adaptDatabaseSchema } from '../../../services/discovery-adapter.js';
import type { PrometheusStore } from '../../../services/prometheus-store.js';

// ─── Request shape ────────────────────────────────────────────────────────────

interface AnalyzeSchemaRequest {
  schema: DatabaseSchema;
  source?: {
    host?: string;
    port?: number;
    database?: string;
    connectorId?: string;
  };
}

// ─── Response serialisation ───────────────────────────────────────────────────

function flattenEntities(
  entities: DatabaseIntelligenceReport['entities']
): ReturnType<typeof serializeClassification>[] {
  const result: ReturnType<typeof serializeClassification>[] = [];
  for (const classifications of Object.values(entities)) {
    for (const cls of classifications ?? []) {
      result.push(serializeClassification(cls));
    }
  }
  return result.sort((a, b) => b.confidence - a.confidence);
}

function serializeClassification(cls: EntityClassification) {
  return {
    table: `${cls.tableSchema}.${cls.tableName}`,
    entity: cls.entity,
    confidence: cls.confidence,
    isAuxiliary: cls.isAuxiliary,
    isJunctionTable: cls.isJunctionTable,
    estimatedRows: cls.estimatedRows,
    alternatives: cls.alternatives,
    fieldRoles: Object.fromEntries(
      [...cls.fieldRoles.entries()].map(([col, a]) => [
        col,
        { role: a.role, confidence: a.confidence },
      ])
    ),
  };
}

function serializeSuggestion(s: IntegrationSuggestion) {
  return {
    priority: s.priority,
    entity: s.entity,
    table: s.table,
    reason: s.reason,
    fieldMapping: Object.fromEntries(s.fieldMapping),
  };
}

// ─── Handler factory ──────────────────────────────────────────────────────────

const _scanner = new DatabaseScanner();

export function createAnalyzeSchemaHandler(store: PrometheusStore): RouteHandler {
  return async (ctx, res) => {
    const body = ctx.body as Partial<AnalyzeSchemaRequest> | undefined;

    if (!body?.schema) {
      return apiError(res, '`schema` is required in the request body', 400, 'BAD_REQUEST');
    }
    if (!Array.isArray(body.schema.tables)) {
      return apiError(res, '`schema.tables` must be an array', 400, 'BAD_REQUEST');
    }

    const input = adaptDatabaseSchema(body.schema, {
      host: body.source?.host,
      port: body.source?.port,
      database: body.source?.database,
    });

    const report = await _scanner.scan(input);
    const analysisId = crypto.randomUUID();
    store.set(analysisId, report);

    json(res, {
      analysisId,
      generatedAt: report.generatedAt,
      durationMs: report.durationMs,
      database: report.database,
      host: report.host,
      port: report.port,
      summary: report.summary,
      entities: flattenEntities(report.entities),
      suggestions: report.suggestions.map(serializeSuggestion),
      risks: report.risks,
    });
  };
}

// Export helpers for reuse in other handlers
export { flattenEntities, serializeClassification, serializeSuggestion };
