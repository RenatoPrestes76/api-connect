/**
 * DatabaseScanner — the top-level ATHENA orchestrator.
 *
 * Flow:
 *  1. Check cache (schema fingerprint)
 *  2. Collect all tables across all schemas
 *  3. First pass: name-only classification to build entity hints map
 *  4. Second pass: full classification (all signals) in parallel
 *  5. Relationship analysis
 *  6. Knowledge Graph construction
 *  7. Risk detection
 *  8. Integration suggestions
 *  9. Report assembly
 * 10. Cache result
 */
import { EntityClassifier } from '../classifier/entity-classifier.js';
import { RelationshipAnalyzer } from '../relationships/relationship-analyzer.js';
import { GraphBuilder } from '../knowledge-graph/graph-builder.js';
import { AnalysisCache } from './cache.js';
import { WorkerPool } from './worker-pool.js';
import { ReportBuilder } from '../report/report-builder.js';
import {
  type DatabaseInput,
  type DatabaseIntelligenceReport,
  type EntityClassification,
  type EntityType,
  type ScanOptions,
  type TableInput,
  DEFAULT_SCAN_OPTIONS,
  ALL_ENTITY_TYPES,
} from '../types/index.js';
import { NameScorer } from '../scoring/name-scorer.js';

export class DatabaseScanner {
  private readonly _classifier  = new EntityClassifier();
  private readonly _relAnalyzer = new RelationshipAnalyzer();
  private readonly _graphBuilder = new GraphBuilder();
  private readonly _cache       = new AnalysisCache();
  private readonly _reportBuilder = new ReportBuilder();
  private readonly _nameScorer  = new NameScorer();

  async scan(
    input:   DatabaseInput,
    options: ScanOptions = {},
  ): Promise<DatabaseIntelligenceReport> {
    const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
    const start = Date.now();

    // ─── Cache check ─────────────────────────────────────────────────────
    const fingerprint = this._cache.fingerprint(input);
    const cached = this._cache.get(fingerprint);
    if (cached) return cached;

    // ─── Collect tables ───────────────────────────────────────────────────
    const allTables = this._collectTables(input, opts);

    // ─── First pass: name-only entity hints ───────────────────────────────
    const entityHints = this._buildEntityHints(allTables);

    // ─── Second pass: full classification ────────────────────────────────
    const pool = new WorkerPool(opts.parallelism);
    const classifications = await pool.runCollect(
      allTables,
      async (table) => this._classifier.classify(table, entityHints, allTables),
    );

    // ─── Relationship analysis ────────────────────────────────────────────
    const relationships = this._relAnalyzer.analyze(allTables, entityHints);

    // ─── Knowledge Graph ──────────────────────────────────────────────────
    const graph = this._graphBuilder.build(classifications, relationships);

    // ─── Report ───────────────────────────────────────────────────────────
    const report = this._reportBuilder.build({
      input,
      classifications,
      relationships,
      graph,
      durationMs: Date.now() - start,
    });

    this._cache.set(fingerprint, report);
    return report;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private _collectTables(input: DatabaseInput, opts: Required<ScanOptions>): TableInput[] {
    const tables: TableInput[] = [];

    for (const schema of input.schemas) {
      if (!this._shouldIncludeSchema(schema.name, opts)) continue;

      for (const table of schema.tables) {
        if (!this._shouldIncludeTable(table.name, opts)) continue;
        tables.push({ ...table, schema: schema.name });
      }
    }

    return tables;
  }

  private _shouldIncludeSchema(name: string, opts: Required<ScanOptions>): boolean {
    const lower = name.toLowerCase();
    const system = ['information_schema', 'pg_catalog', 'pg_toast'];
    if (system.includes(lower)) return false;
    if (opts.includeSchemas.length > 0 && !opts.includeSchemas.some((p) => matches(lower, p))) return false;
    if (opts.excludeSchemas.length > 0 &&  opts.excludeSchemas.some((p) => matches(lower, p))) return false;
    return true;
  }

  private _shouldIncludeTable(name: string, opts: Required<ScanOptions>): boolean {
    const lower = name.toLowerCase();
    if (opts.includeTables.length > 0 && !opts.includeTables.some((p) => matches(lower, p))) return false;
    if (opts.excludeTables.length > 0 &&  opts.excludeTables.some((p) => matches(lower, p))) return false;
    return true;
  }

  private _buildEntityHints(tables: readonly TableInput[]): Partial<Record<string, EntityType>> {
    const hints: Record<string, EntityType> = {};

    for (const table of tables) {
      const nameResult = this._nameScorer.score(table.name);
      const scored = Object.entries(nameResult.scores) as [EntityType, number][];
      if (scored.length === 0) continue;
      const best = scored.sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 50) {
        hints[`${table.schema}.${table.name}`] = best[0];
        hints[table.name] = best[0]; // also by bare name for cross-schema FKs
      }
    }

    return hints;
  }

  /** Expose cache for testing / invalidation. */
  get cache(): AnalysisCache { return this._cache; }
}

// ─── Glob-style pattern matching ──────────────────────────────────────────────

function matches(name: string, pattern: string): boolean {
  // Convert glob pattern to regex: * → .*, ? → .
  const regexStr = pattern
    .toLowerCase()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(name);
}
