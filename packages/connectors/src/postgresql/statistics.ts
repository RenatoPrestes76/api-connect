/**
 * TableStatisticsEngine — reads pg_stat_user_tables and profiles data.
 *
 * Statistics source:
 *   - Row counts, sizes      → pg_class + pg_stat_user_tables
 *   - Vacuum/Analyze times   → pg_stat_user_tables
 *   - Table/index sizes      → pg_relation_size(), pg_indexes_size(), pg_total_relation_size()
 *
 * Data profiling (sampling):
 *   - Reads LIMIT N rows to compute null%, distinct count, avg length, sample values
 *   - Identifiers (schema, table, column) are safely quoted via quoteIdent()
 *   - Never executes anything but SELECT
 */
import type { QueryRunner } from './query-runner.js';
import {
  quoteIdent,
  qualifiedName,
  asSchemaName,
  asTableName,
  asColumnName,
  type SchemaName,
  type TableStatistics,
  type TableProfile,
  type ColumnProfile,
  type ColumnMetadata,
} from './types.js';

// ─── Raw Row Types ────────────────────────────────────────────────────────────

// Plain `type` aliases (not `interface`) so these structurally satisfy the
// `Record<string, unknown>` generic constraint on QueryRunner.query<T>().
type RawStats = {
  live_tuples: string;
  dead_tuples: string;
  estimated_rows: string;
  table_bytes: string;
  indexes_bytes: string;
  total_bytes: string;
  table_size_human: string;
  total_size_human: string;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  last_autoanalyze: string | null;
};

type RawColumnSample = {
  total_count: string;
  non_null_count: string;
  distinct_count: string;
  avg_length: string | null;
};

// ─── TableStatisticsEngine ───────────────────────────────────────────────────

export class TableStatisticsEngine {
  constructor(private readonly _runner: QueryRunner) {}

  // ─── Per-table Statistics ────────────────────────────────────────────────

  async getTableStatistics(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>
  ): Promise<TableStatistics> {
    const { rows } = await this._runner.query<RawStats>(
      `
      SELECT
        COALESCE(s.n_live_tup, 0)::text                         AS live_tuples,
        COALESCE(s.n_dead_tup, 0)::text                         AS dead_tuples,
        GREATEST(s.n_live_tup, c.reltuples::bigint, 0)::text    AS estimated_rows,
        pg_relation_size(c.oid)::text                           AS table_bytes,
        pg_indexes_size(c.oid)::text                            AS indexes_bytes,
        pg_total_relation_size(c.oid)::text                     AS total_bytes,
        pg_size_pretty(pg_relation_size(c.oid))                 AS table_size_human,
        pg_size_pretty(pg_total_relation_size(c.oid))           AS total_size_human,
        s.last_vacuum::text,
        s.last_autovacuum::text,
        s.last_analyze::text,
        s.last_autoanalyze::text
      FROM pg_class c
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s
        ON s.relname    = c.relname
       AND s.schemaname = n.nspname
      WHERE n.nspname = $1
        AND c.relname = $2
        AND c.relkind = 'r'
    `,
      [schema, table]
    );

    const row = rows[0];
    if (!row) {
      return this._emptyStats(schema, table);
    }

    return {
      schema,
      table,
      estimatedRows: parseInt(row.estimated_rows, 10) || 0,
      liveTuples: parseInt(row.live_tuples, 10) || 0,
      deadTuples: parseInt(row.dead_tuples, 10) || 0,
      tableSizeBytes: parseInt(row.table_bytes, 10) || 0,
      indexesSizeBytes: parseInt(row.indexes_bytes, 10) || 0,
      totalSizeBytes: parseInt(row.total_bytes, 10) || 0,
      tableSizeHuman: row.table_size_human,
      totalSizeHuman: row.total_size_human,
      lastVacuum: row.last_vacuum ? new Date(row.last_vacuum) : null,
      lastAutoVacuum: row.last_autovacuum ? new Date(row.last_autovacuum) : null,
      lastAnalyze: row.last_analyze ? new Date(row.last_analyze) : null,
      lastAutoAnalyze: row.last_autoanalyze ? new Date(row.last_autoanalyze) : null,
    };
  }

  // ─── Data Profiling ───────────────────────────────────────────────────────

  async profileTable(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>,
    columns: ColumnMetadata[],
    sampleSize = 100
  ): Promise<TableProfile> {
    if (columns.length === 0) {
      return {
        schema,
        table,
        sampleSize,
        actualRowsSampled: 0,
        columns: [],
      };
    }

    // Get actual sample count
    const sampleAlias = '_s';
    const sampleSubquery = `(SELECT * FROM ${qualifiedName(schema, table)} LIMIT ${sampleSize}) ${sampleAlias}`;

    // Count total rows in sample
    const countResult = await this._runner
      .query<{ cnt: string }>(`SELECT COUNT(*)::text AS cnt FROM ${sampleSubquery}`)
      .catch(() => ({ rows: [{ cnt: '0' }], rowCount: 1 }));
    const actualRowsSampled = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    // Profile each column in parallel (up to 10 at a time to avoid overloading)
    const columnProfiles: ColumnProfile[] = [];
    const batchSize = 10;

    for (let i = 0; i < columns.length; i += batchSize) {
      const batch = columns.slice(i, i + batchSize);
      const profiles = await Promise.all(
        batch.map((col) =>
          this._profileColumn(schema, table, col, sampleSize, actualRowsSampled).catch(
            (): ColumnProfile => this._emptyColumnProfile(col, actualRowsSampled)
          )
        )
      );
      columnProfiles.push(...profiles);
    }

    return {
      schema,
      table,
      sampleSize,
      actualRowsSampled,
      columns: columnProfiles,
    };
  }

  // ─── Single Column Profile ────────────────────────────────────────────────

  private async _profileColumn(
    schema: SchemaName,
    table: ReturnType<typeof asTableName>,
    column: ColumnMetadata,
    sampleSize: number,
    totalRows: number
  ): Promise<ColumnProfile> {
    const quotedCol = quoteIdent(String(column.name));
    const sampleSQL = `(SELECT * FROM ${qualifiedName(schema, table)} LIMIT ${sampleSize}) _sample`;

    const { rows } = await this._runner.query<RawColumnSample>(`
      SELECT
        COUNT(*)::text                         AS total_count,
        COUNT(${quotedCol})::text              AS non_null_count,
        COUNT(DISTINCT ${quotedCol})::text     AS distinct_count,
        AVG(LENGTH(${quotedCol}::text))::text  AS avg_length
      FROM ${sampleSQL}
    `);

    const row = rows[0];
    if (!row) return this._emptyColumnProfile(column, totalRows);

    const nonNullCount = parseInt(row.non_null_count, 10) || 0;
    const distinctCount = parseInt(row.distinct_count, 10) || 0;
    const total = parseInt(row.total_count, 10) || 1;

    // Fetch up to 5 distinct sample values (non-null, cast to text)
    const sampleValRows = await this._runner
      .query<{ v: string }>(
        `
        SELECT DISTINCT ${quotedCol}::text AS v
        FROM ${qualifiedName(schema, table)}
        WHERE ${quotedCol} IS NOT NULL
        LIMIT 5
      `
      )
      .catch(() => ({ rows: [] as { v: string }[], rowCount: 0 }));

    return {
      columnName: asColumnName(String(column.name)),
      totalRows,
      nonNullCount,
      nullPercent: total > 0 ? Math.round((1 - nonNullCount / total) * 10_000) / 100 : 0,
      distinctCount,
      distinctPercent:
        nonNullCount > 0 ? Math.round((distinctCount / nonNullCount) * 10_000) / 100 : 0,
      avgLength:
        row.avg_length !== null ? Math.round(parseFloat(row.avg_length) * 100) / 100 : null,
      sampleValues: sampleValRows.rows.map((r) => r.v),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private _emptyStats(schema: SchemaName, table: ReturnType<typeof asTableName>): TableStatistics {
    return {
      schema,
      table,
      estimatedRows: 0,
      liveTuples: 0,
      deadTuples: 0,
      tableSizeBytes: 0,
      indexesSizeBytes: 0,
      totalSizeBytes: 0,
      tableSizeHuman: '0 bytes',
      totalSizeHuman: '0 bytes',
      lastVacuum: null,
      lastAutoVacuum: null,
      lastAnalyze: null,
      lastAutoAnalyze: null,
    };
  }

  private _emptyColumnProfile(col: ColumnMetadata, totalRows: number): ColumnProfile {
    return {
      columnName: asColumnName(String(col.name)),
      totalRows,
      nonNullCount: 0,
      nullPercent: 0,
      distinctCount: 0,
      distinctPercent: 0,
      avgLength: null,
      sampleValues: [],
    };
  }
}
