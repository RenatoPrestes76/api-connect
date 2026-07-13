/**
 * ReportBuilder — assembles the final DatabaseIntelligenceReport.
 *
 * Also runs:
 *  - Risk detector (tables with no PK, columns with no types, circular refs)
 *  - Integration suggestion generator
 *  - UI DTO builder
 */
import type {
  DatabaseInput,
  DatabaseIntelligenceReport,
  DiscoveredRelationship,
  EntityClassification,
  EntityType,
  IntegrationSuggestion,
  KnowledgeGraphSnapshot,
  ReportSummary,
  RiskItem,
  UIEntityNode,
  UIHeatmapCell,
  UIRelationshipEdge,
} from '../types/index.js';
import { ALL_ENTITY_TYPES } from '../types/index.js';
import type { KnowledgeGraph } from '../knowledge-graph/graph.js';

// ─── High-priority entities for integration suggestions ───────────────────────
const INTEGRATION_PRIORITY: Partial<Record<EntityType, 1 | 2 | 3>> = {
  PRODUCT: 1,
  INVENTORY: 1,
  PRICE: 1,
  CUSTOMER: 1,
  SALE: 1,
  SUPPLIER: 2,
  CATEGORY: 2,
  BRANCH: 2,
  PURCHASE: 2,
  EXPIRY: 2,
  LOT: 3,
  MOVEMENT: 3,
  FISCAL: 3,
  USER: 3,
};

// ─── Risk thresholds ──────────────────────────────────────────────────────────

const HIGH_CONFIDENCE = 75;
const MIN_INTEGRATION_CONFIDENCE = 60;

export interface ReportBuildInput {
  readonly input: DatabaseInput;
  readonly classifications: readonly EntityClassification[];
  readonly relationships: readonly DiscoveredRelationship[];
  readonly graph: KnowledgeGraph;
  readonly durationMs: number;
}

export class ReportBuilder {
  build(ctx: ReportBuildInput): DatabaseIntelligenceReport {
    const { input, classifications, relationships, graph, durationMs } = ctx;

    // ─── Group entities ────────────────────────────────────────────────
    const entities: Partial<Record<EntityType, EntityClassification[]>> = {};
    for (const cls of classifications) {
      if (!entities[cls.entity]) entities[cls.entity] = [];
      entities[cls.entity]!.push(cls);
    }
    // Sort each group by confidence desc
    for (const list of Object.values(entities)) {
      list?.sort((a, b) => b.confidence - a.confidence);
    }

    // ─── Summary ──────────────────────────────────────────────────────
    const schemasFound = input.schemas.length;
    const tablesFound = classifications.length;
    const columnsFound = classifications.reduce((s, c) => s + c.fieldRoles.size, 0);
    const identified = classifications.filter((c) => c.entity !== 'UNKNOWN').length;
    const auxiliaryCount = classifications.filter((c) => c.isAuxiliary).length;
    const junctionCount = classifications.filter((c) => c.isJunctionTable).length;
    const avgConf =
      tablesFound > 0
        ? Math.round(classifications.reduce((s, c) => s + c.confidence, 0) / tablesFound)
        : 0;

    // ─── Risks ────────────────────────────────────────────────────────
    const risks = this._detectRisks(classifications, relationships);

    // ─── Suggestions ──────────────────────────────────────────────────
    const suggestions = this._buildSuggestions(classifications);

    // ─── Graph snapshot ───────────────────────────────────────────────
    const knowledgeGraph: KnowledgeGraphSnapshot = {
      nodes: graph.allNodes(),
      edges: graph.allEdges(),
    };

    // ─── UI DTOs ──────────────────────────────────────────────────────
    const ui = this._buildUI(classifications, relationships);

    const summary: ReportSummary = {
      schemasFound,
      tablesFound,
      columnsFound,
      entitiesIdentified: identified,
      relationshipsFound: relationships.length,
      auxiliaryTables: auxiliaryCount,
      junctionTables: junctionCount,
      overallConfidence: avgConf,
      hasRisks: risks.some((r) => r.level === 'HIGH'),
    };

    return {
      generatedAt: new Date().toISOString(),
      durationMs,
      database: input.database,
      host: input.host,
      port: input.port,
      summary,
      entities,
      relationships,
      knowledgeGraph,
      risks,
      suggestions,
      ui,
    };
  }

  // ─── Risk detection ──────────────────────────────────────────────────────

  private _detectRisks(
    classifications: readonly EntityClassification[],
    relationships: readonly DiscoveredRelationship[]
  ): RiskItem[] {
    const risks: RiskItem[] = [];

    // Tables with no PK
    const noPK = classifications.filter(
      (c) => !c.fieldRoles.has('IDENTIFIER') && !c.isJunctionTable
    );
    if (noPK.length > 0) {
      risks.push({
        level: 'HIGH',
        category: 'INTEGRITY',
        description: `${noPK.length} table(s) have no identifiable primary key`,
        tables: noPK.map((c) => `${c.tableSchema}.${c.tableName}`),
        suggestion: 'Add a primary key to ensure data integrity and enable efficient lookups',
      });
    }

    // Low-confidence classifications
    const lowConf = classifications.filter((c) => c.entity !== 'UNKNOWN' && c.confidence < 40);
    if (lowConf.length > 5) {
      risks.push({
        level: 'MEDIUM',
        category: 'NAMING',
        description: `${lowConf.length} tables have ambiguous names that could not be classified with high confidence`,
        tables: lowConf.map((c) => `${c.tableSchema}.${c.tableName}`),
        suggestion: 'Consider adopting a standard naming convention for tables and columns',
      });
    }

    // Circular references
    const circular = relationships.filter((r) => r.kind === 'CIRCULAR');
    if (circular.length > 0) {
      const tables = [
        ...new Set(
          circular.flatMap((r) => [`${r.fromSchema}.${r.fromTable}`, `${r.toSchema}.${r.toTable}`])
        ),
      ];
      risks.push({
        level: 'MEDIUM',
        category: 'RELATIONSHIPS',
        description: `${circular.length} circular reference(s) detected — may complicate synchronization`,
        tables,
        suggestion:
          'Review circular dependencies and consider breaking cycles with soft deletes or nullable FKs',
      });
    }

    // PRODUCT tables with no price or inventory link
    const products = classifications.filter(
      (c) => c.entity === 'PRODUCT' && c.confidence >= HIGH_CONFIDENCE
    );
    if (products.length > 0) {
      const orphaned = products.filter((p) => {
        const id = `${p.tableSchema}.${p.tableName}`;
        const hasInventoryLink = relationships.some(
          (r) => r.toSchema + '.' + r.toTable === id || r.fromSchema + '.' + r.fromTable === id
        );
        return !hasInventoryLink;
      });
      if (orphaned.length > 0) {
        risks.push({
          level: 'LOW',
          category: 'COMPLETENESS',
          description: `${orphaned.length} PRODUCT table(s) have no detectable link to INVENTORY or PRICE`,
          tables: orphaned.map((c) => `${c.tableSchema}.${c.tableName}`),
          suggestion: 'Verify that stock and pricing data are accessible for these product tables',
        });
      }
    }

    return risks;
  }

  // ─── Integration suggestions ─────────────────────────────────────────────

  private _buildSuggestions(
    classifications: readonly EntityClassification[]
  ): IntegrationSuggestion[] {
    const suggestions: IntegrationSuggestion[] = [];

    for (const cls of classifications) {
      const priority = INTEGRATION_PRIORITY[cls.entity];
      if (!priority || cls.confidence < MIN_INTEGRATION_CONFIDENCE) continue;

      const fieldMapping = new Map<string, import('../types/index.js').FieldRole>();
      for (const [colName, assignment] of cls.fieldRoles) {
        if (assignment.role !== 'UNKNOWN' && assignment.confidence >= 50) {
          fieldMapping.set(colName, assignment.role);
        }
      }

      if (fieldMapping.size === 0) continue;

      suggestions.push({
        priority,
        entity: cls.entity,
        table: `${cls.tableSchema}.${cls.tableName}`,
        reason: `${cls.entity} classified with ${cls.confidence}% confidence`,
        fieldMapping,
      });
    }

    // Sort by priority then confidence
    return suggestions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const confA =
        classifications.find((c) => `${c.tableSchema}.${c.tableName}` === a.table)?.confidence ?? 0;
      const confB =
        classifications.find((c) => `${c.tableSchema}.${c.tableName}` === b.table)?.confidence ?? 0;
      return confB - confA;
    });
  }

  // ─── UI DTOs ─────────────────────────────────────────────────────────────

  private _buildUI(
    classifications: readonly EntityClassification[],
    relationships: readonly DiscoveredRelationship[]
  ): DatabaseIntelligenceReport['ui'] {
    const entityMap: UIEntityNode[] = classifications.map((cls) => ({
      id: `${cls.tableSchema}.${cls.tableName}`,
      label: cls.tableName,
      entity: cls.entity,
      confidence: cls.confidence,
      schema: cls.tableSchema,
      table: cls.tableName,
      columns: cls.fieldRoles.size,
      rows: cls.estimatedRows,
    }));

    const relationshipMap: UIRelationshipEdge[] = relationships.map((r) => ({
      source: `${r.fromSchema}.${r.fromTable}`,
      target: `${r.toSchema}.${r.toTable}`,
      kind: r.kind,
      cardinality: r.cardinality,
      label: `${r.fromColumn} → ${r.toColumn}`,
    }));

    const heatmap: UIHeatmapCell[] = [...classifications]
      .sort((a, b) => b.confidence - a.confidence)
      .map((cls) => ({
        schema: cls.tableSchema,
        table: cls.tableName,
        entity: cls.entity,
        confidence: cls.confidence,
        estimatedRows: cls.estimatedRows,
      }));

    return { entityMap, relationshipMap, heatmap };
  }
}
