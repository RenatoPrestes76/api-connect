/**
 * GET /api/v1/discovery/suggestions?analysisId=<uuid>
 *
 * Returns integration suggestions for a previously run analysis, ordered by
 * priority (1 = highest) then confidence.
 */
import type { RouteHandler } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import type { PrometheusStore } from '../../../services/prometheus-store.js';
import { serializeSuggestion } from './analyze-schema.js';

export function createSuggestionsHandler(store: PrometheusStore): RouteHandler {
  return async (ctx, res) => {
    const analysisId = ctx.query.get('analysisId');
    if (!analysisId) {
      return apiError(res, '`analysisId` query parameter is required', 400, 'BAD_REQUEST');
    }

    const report = store.get(analysisId);
    if (!report) {
      return apiError(res, `Analysis '${analysisId}' not found or expired`, 404, 'NOT_FOUND');
    }

    const suggestions = report.suggestions.map(serializeSuggestion);

    const priorityFilter = ctx.query.get('priority');
    const filtered = priorityFilter
      ? suggestions.filter((s) => String(s.priority) === priorityFilter)
      : suggestions;

    json(res, {
      analysisId,
      database: report.database,
      total: filtered.length,
      suggestions: filtered,
    });
  };
}
