/**
 * MetadataAggregator — assembles the full PostgreSQLIntrospectionReport.
 *
 * Orchestration:
 *   1. Server info + extensions
 *   2. For each schema (filtered):
 *      a. Tables (filtered) → columns, PK, FKs, indexes in parallel
 *      b. Views + Materialized Views
 *      c. Sequences + Enums
 *   3. For each table: statistics + optional data profiling
 *
 * Filtering uses glob-style patterns:
 *   - '*produto*' matches any table containing "produto"
 *   - 'vendas*' matches tables starting with "vendas"
 *   - exact string matches literally
 */
import type { SchemaDiscovery } from './schema-discovery.js';
import type { TableStatisticsEngine } from './statistics.js';
import {
  asTableName,
  type SchemaName,
  type SchemaMetadata,
  type TableMetadata,
  type TableStatistics,
  type TableProfile,
  type PostgreSQLIntrospectionReport,
  type DiscoveryFilter,
} from './types.js';

// ─── Glob Matching ────────────────────────────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchesAnyPattern(name: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(name));
}

function shouldIncludeSchema(name: SchemaName, filter: DiscoveryFilter): boolean {
  const s = String(name);
  if (filter.excludeSchemas?.length && matchesAnyPattern(s, filter.excludeSchemas)) return false;
  if (filter.includeSchemas?.length && !matchesAnyPattern(s, filter.includeSchemas)) return false;
  return true;
}

function shouldIncludeTable(name: ReturnType<typeof asTableName>, filter: DiscoveryFilter): boolean {
  const t = String(name);
  if (filter.excludeTables?.length && matchesAnyPattern(t, filter.excludeTables)) return false;
  if (filter.includeTables?.length && !matchesAnyPattern(t, filter.includeTables)) return false;
  return true;
}

// ─── MetadataAggregator ───────────────────────────────────────────────────────

export class MetadataAggregator {
  constructor(
    private readonly _discovery: SchemaDiscovery,
    private readonly _statistics: TableStatisticsEngine,
  ) {}

  async buildReport(filter: DiscoveryFilter = {}): Promise<PostgreSQLIntrospectionReport> {
    const connectedAt = new Date();
    const warnings: string[] = [];
    const sampleSize = filter.sampleSize ?? 100;
    const enableProfiling = filter.enableProfiling !== false;

    // ── 1. Server info ────────────────────────────────────────────────────
    const [serverInfo, extensions] = await Promise.all([
      this._discovery.getServerInfo(),
      this._discovery.getExtensions(),
    ]);

    // ── 2. Schemas ────────────────────────────────────────────────────────
    const allSchemas = await this._discovery.getSchemas();
    const filteredSchemas = allSchemas.filter((s) => shouldIncludeSchema(s.name, filter));

    if (filteredSchemas.length === 0) {
      warnings.push('No schemas matched the discovery filter — check includeSchemas/excludeSchemas');
    }

    // ── 3. Discover each schema ───────────────────────────────────────────
    const schemaMetadatas: SchemaMetadata[] = [];
    const statsMap: Record<string, TableStatistics> = {};
    const profileMap: Record<string, TableProfile> = {};
    let totalTables = 0;
    let totalViews = 0;
    let totalEstimatedRows = 0;

    for (const schema of filteredSchemas) {
      const schemaName = schema.name;

      // Discover structure in parallel
      const [rawTables, views, matViews, sequences, enums] = await Promise.all([
        this._discovery.getTables(schemaName).catch((e: unknown) => {
          warnings.push(`Failed to get tables for schema "${schemaName}": ${String(e)}`);
          return [] as Awaited<ReturnType<typeof this._discovery.getTables>>;
        }),
        this._discovery.getViews(schemaName).catch(() => []),
        this._discovery.getMaterializedViews(schemaName).catch(() => []),
        this._discovery.getSequences(schemaName).catch(() => []),
        this._discovery.getEnums(schemaName).catch(() => []),
      ]);

      // Filter tables
      const includedTables = rawTables.filter((t) => shouldIncludeTable(t.name, filter));

      if (rawTables.length > 0 && includedTables.length === 0) {
        warnings.push(`All tables in schema "${schemaName}" were excluded by the filter`);
      }

      // Discover each table's full structure in parallel (batched)
      const tables = await this._discoverTablesBatched(schemaName, includedTables, warnings);

      // Statistics + profiling for each table
      await Promise.all(
        tables.map(async (table) => {
          const key = `${schemaName}.${table.name}`;

          const stats = await this._statistics
            .getTableStatistics(schemaName, table.name)
            .catch((): TableStatistics => ({
              schema: schemaName,
              table: table.name,
              estimatedRows: 0, liveTuples: 0, deadTuples: 0,
              tableSizeBytes: 0, indexesSizeBytes: 0, totalSizeBytes: 0,
              tableSizeHuman: '0 bytes', totalSizeHuman: '0 bytes',
              lastVacuum: null, lastAutoVacuum: null, lastAnalyze: null, lastAutoAnalyze: null,
            }));

          statsMap[key] = stats;
          totalEstimatedRows += stats.estimatedRows;

          if (enableProfiling) {
            const profile = await this._statistics
              .profileTable(schemaName, table.name, table.columns, sampleSize)
              .catch((): TableProfile => ({
                schema: schemaName,
                table: table.name,
                sampleSize,
                actualRowsSampled: 0,
                columns: [],
              }));
            profileMap[key] = profile;
          }
        }),
      );

      totalTables += tables.length;
      totalViews  += views.length + matViews.length;

      // Rebuild tables with correct comments from rawTables
      const tablesWithComments: TableMetadata[] = tables.map((t) => {
        const raw = rawTables.find((r) => r.name === t.name);
        return raw ? { ...t, comment: raw.comment } : t;
      });

      schemaMetadatas.push({
        name:              schemaName,
        owner:             schema.owner,
        tables:            tablesWithComments,
        views,
        materializedViews: matViews,
        sequences,
        enums,
      });
    }

    const completedAt = new Date();

    return {
      connectedAt,
      completedAt,
      durationMs:          completedAt.getTime() - connectedAt.getTime(),
      host:                '',
      port:                0,
      database:            '',
      serverVersion:       serverInfo.serverVersion,
      encoding:            serverInfo.encoding,
      collation:           serverInfo.collation,
      timezone:            serverInfo.timezone,
      extensions,
      schemasDiscovered:   schemaMetadatas.length,
      tablesDiscovered:    totalTables,
      viewsDiscovered:     totalViews,
      totalEstimatedRows,
      schemas:             schemaMetadatas,
      statistics:          statsMap,
      profiles:            profileMap,
      warnings,
    };
  }

  // ─── Batched Table Discovery ──────────────────────────────────────────────

  private async _discoverTablesBatched(
    schema: SchemaName,
    rawTables: Array<{ name: ReturnType<typeof asTableName>; comment: string | null; isPartitioned: boolean }>,
    warnings: string[],
    batchSize = 5,
  ): Promise<TableMetadata[]> {
    const results: TableMetadata[] = [];

    for (let i = 0; i < rawTables.length; i += batchSize) {
      const batch = rawTables.slice(i, i + batchSize);
      const resolved = await Promise.all(
        batch.map(async (t) => {
          try {
            return await this._discovery.discoverTable(schema, t.name, t.isPartitioned);
          } catch (err) {
            warnings.push(`Failed to discover table "${schema}.${t.name}": ${String(err)}`);
            return null;
          }
        }),
      );
      results.push(...resolved.filter((t): t is TableMetadata => t !== null));
    }

    return results;
  }
}
