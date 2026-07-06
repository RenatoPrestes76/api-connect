/**
 * GET /api/v1/discovery/graph?analysisId=<uuid>
 *
 * Returns the knowledge graph (nodes + edges) for a previously run analysis.
 * Nodes are entity-classified tables; edges are discovered FK relationships.
 */
import type { RouteHandler } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import type { PrometheusStore } from '../../../services/prometheus-store.js';

export function createGraphHandler(store: PrometheusStore): RouteHandler {
  return async (ctx, res) => {
    const analysisId = ctx.query.get('analysisId');
    if (!analysisId) {
      return apiError(res, '`analysisId` query parameter is required', 400, 'BAD_REQUEST');
    }

    const report = store.get(analysisId);
    if (!report) {
      return apiError(res, `Analysis '${analysisId}' not found or expired`, 404, 'NOT_FOUND');
    }

    const { nodes, edges } = report.knowledgeGraph;

    json(res, {
      analysisId,
      database: report.database,
      graph: {
        nodes: nodes.map((n) => ({
          id:         n.id,
          entity:     n.entity,
          confidence: n.confidence,
          schema:     n.classification.tableSchema,
          table:      n.classification.tableName,
          columns:    n.classification.fieldRoles.size,
          rows:       n.classification.estimatedRows,
        })),
        edges: edges.map((e) => ({
          from:        e.fromId,
          to:          e.toId,
          kind:        e.kind,
          cardinality: e.cardinality,
          label:       e.label,
          confidence:  e.confidence,
        })),
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      },
    });
  };
}
