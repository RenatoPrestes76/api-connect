import type { ServerResponse }   from 'node:http';
import type { RouteContext }     from '../../../http/router.js';
import { json }                  from '../../../http/router.js';
import { prometheusStore }       from '../../../services/prometheus-store.js';
import { flattenEntities, serializeSuggestion } from '../discovery/analyze-schema.js';

function toIsoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export async function hubListDiscovery(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const runs = prometheusStore.entries().map(([analysisId, report]) => ({
    analysisId,
    generatedAt: toIsoString(report.generatedAt),
    durationMs:  report.durationMs ?? 0,
    database:    report.database,
    host:        (report as { host?: string }).host ?? 'unknown',
    port:        (report as { port?: number }).port ?? 5432,
    summary: {
      schemasFound:       report.summary.schemasFound,
      tablesFound:        report.summary.tablesFound,
      columnsFound:       report.summary.columnsFound,
      entitiesIdentified: report.summary.entitiesIdentified,
      relationshipsFound: report.summary.relationshipsFound,
      auxiliaryTables:    report.summary.auxiliaryTables,
      junctionTables:     report.summary.junctionTables,
      overallConfidence:  report.summary.overallConfidence,
      hasRisks:           (report.risks?.length ?? 0) > 0,
    },
    entities:    flattenEntities(report.entities),
    suggestions: (report.suggestions ?? []).map(serializeSuggestion),
    risks: (report.risks ?? []).map((r) => ({
      level:       (r as { severity?: string }).severity ?? 'low',
      category:    (r as { category?: string }).category ?? 'general',
      description: (r as { description?: string }).description ?? '',
      tables:      (r as { affectedTables?: string[] }).affectedTables ?? [],
    })),
  }));

  runs.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  json(res, runs);
}
