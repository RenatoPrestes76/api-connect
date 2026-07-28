import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { erpMetadataStore } from '../../../modules/erp-metadata/erp-metadata-store.js';
import { flattenEntities, serializeSuggestion } from '../discovery/analyze-schema.js';

const NOT_DISCOVERED_MESSAGE =
  'No schema has been discovered for this profile yet — run POST /erp-metadata/discover first';

function requireProfileId(ctx: RouteContext, res: ServerResponse): string | null {
  const profileId = ctx.query.get('profileId');
  if (!profileId) {
    apiError(res, 'profileId query parameter is required', 422, 'VALIDATION_ERROR');
    return null;
  }
  return profileId;
}

export function registerErpMetadataSchemaRoutes(router: Router): void {
  // ─── GET /erp-metadata/schema ─────────────────────────────────────────────
  router.get(
    '/erp-metadata/schema',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = requireProfileId(ctx, res);
      if (!profileId) return;
      const report = erpMetadataStore.getReport(profileId);
      const cacheMeta = erpMetadataStore.getCacheMeta(profileId);
      if (!report || !cacheMeta)
        return apiError(res, NOT_DISCOVERED_MESSAGE, 404, 'NOT_DISCOVERED');

      json(res, {
        profileId,
        database: report.database,
        host: report.host,
        port: report.port,
        generatedAt: report.generatedAt,
        durationMs: report.durationMs,
        summary: report.summary,
        risks: report.risks,
        suggestions: report.suggestions.map(serializeSuggestion),
        cache: {
          version: cacheMeta.version,
          checksum: cacheMeta.checksum,
          lastDiscoveredAt: cacheMeta.lastDiscoveredAt,
        },
      });
    })
  );

  // ─── GET /erp-metadata/tables ─────────────────────────────────────────────
  router.get(
    '/erp-metadata/tables',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = requireProfileId(ctx, res);
      if (!profileId) return;
      const report = erpMetadataStore.getReport(profileId);
      if (!report) return apiError(res, NOT_DISCOVERED_MESSAGE, 404, 'NOT_DISCOVERED');

      const tables = flattenEntities(report.entities);
      json(res, { total: tables.length, tables });
    })
  );

  // ─── GET /erp-metadata/table/:name ────────────────────────────────────────
  router.get(
    '/erp-metadata/table/:name',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = requireProfileId(ctx, res);
      if (!profileId) return;
      const report = erpMetadataStore.getReport(profileId);
      if (!report) return apiError(res, NOT_DISCOVERED_MESSAGE, 404, 'NOT_DISCOVERED');

      const tableName = ctx.params['name'] as string;
      const table = flattenEntities(report.entities).find(
        (t) => t.table === tableName || t.table.endsWith(`.${tableName}`)
      );
      if (!table) return apiError(res, `Table '${tableName}' was not discovered`, 404, 'NOT_FOUND');
      json(res, { table });
    })
  );

  // ─── GET /erp-metadata/relationships ──────────────────────────────────────
  router.get(
    '/erp-metadata/relationships',
    requirePermission('erp-metadata.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = requireProfileId(ctx, res);
      if (!profileId) return;
      const report = erpMetadataStore.getReport(profileId);
      if (!report) return apiError(res, NOT_DISCOVERED_MESSAGE, 404, 'NOT_DISCOVERED');

      const { nodes, edges } = report.knowledgeGraph;
      json(res, {
        profileId,
        graph: {
          nodes: nodes.map((n) => ({
            id: n.id,
            entity: n.entity,
            confidence: n.confidence,
            schema: n.classification.tableSchema,
            table: n.classification.tableName,
          })),
          edges: edges.map((e) => ({
            from: e.fromId,
            to: e.toId,
            kind: e.kind,
            cardinality: e.cardinality,
            label: e.label,
            confidence: e.confidence,
          })),
          stats: { nodeCount: nodes.length, edgeCount: edges.length },
        },
      });
    })
  );
}
