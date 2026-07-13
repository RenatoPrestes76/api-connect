/**
 * GET /api/v1/discovery/entities?analysisId=<uuid>
 *
 * Returns the classified entity list for a previously run analysis.
 * Supports optional ?entity=PRODUCT filter and ?minConfidence=60 threshold.
 */
import type { RouteHandler } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import type { PrometheusStore } from '../../../services/prometheus-store.js';
import { flattenEntities } from './analyze-schema.js';

export function createEntitiesHandler(store: PrometheusStore): RouteHandler {
  return async (ctx, res) => {
    const analysisId = ctx.query.get('analysisId');
    if (!analysisId) {
      return apiError(res, '`analysisId` query parameter is required', 400, 'BAD_REQUEST');
    }

    const report = store.get(analysisId);
    if (!report) {
      return apiError(res, `Analysis '${analysisId}' not found or expired`, 404, 'NOT_FOUND');
    }

    let entities = flattenEntities(report.entities);

    const entityFilter = ctx.query.get('entity')?.toUpperCase();
    const minConfidence = Number(ctx.query.get('minConfidence') ?? '0');

    if (entityFilter) {
      entities = entities.filter((e) => e.entity === entityFilter);
    }
    if (minConfidence > 0) {
      entities = entities.filter((e) => e.confidence >= minConfidence);
    }

    json(res, {
      analysisId,
      database: report.database,
      total: entities.length,
      entities,
    });
  };
}
