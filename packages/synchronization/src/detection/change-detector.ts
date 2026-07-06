/**
 * ChangeDetector — auto-selects and applies the best change detection strategy.
 *
 * Strategy selection order (most precise first):
 *  1. XMIN           — PostgreSQL-native, no schema changes required
 *  2. UPDATED_AT     — Standard updatedAt column
 *  3. CREATED_AT     — Only catches new inserts
 *  4. ROW_HASH       — Hash of serialized row (expensive, fallback)
 *  5. CHECKSUM       — CRC32 of row (slightly cheaper)
 *  6. COMPARISON     — Full row comparison (last resort)
 *
 * All queries are SELECT-only; any attempt to write throws ReadOnlyViolationError.
 */
import { createHash } from 'crypto';
import type {
  ChangeDetectionStrategyKind,
  DetectedChange,
  RecordValue,
  SyncRecord,
  TableSyncConfig,
} from '../types/index.js';

// ─── ReadOnly guard ───────────────────────────────────────────────────────────

export class ReadOnlyViolationError extends Error {
  constructor(sql: string) {
    super(`[HERMES] READ ONLY violation — write operation detected: ${sql.slice(0, 120)}`);
    this.name = 'ReadOnlyViolationError';
  }
}

const WRITE_VERB_RE = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|VACUUM|REINDEX|CLUSTER|COPY|LOCK|COMMENT)\b/i;

export function assertReadOnly(sql: string): void {
  if (WRITE_VERB_RE.test(sql)) throw new ReadOnlyViolationError(sql);
}

// ─── Strategy implementations ─────────────────────────────────────────────────

export interface StrategyResult {
  readonly strategy:  ChangeDetectionStrategyKind;
  readonly sql:       string;
  readonly params:    readonly RecordValue[];
  readonly sinceCol:  string | null;
}

/**
 * Detect which strategy to use by inspecting available columns.
 */
export function selectStrategy(
  columns: readonly string[],
  preferred?: ChangeDetectionStrategyKind,
): ChangeDetectionStrategyKind {
  if (preferred && preferred !== 'NONE') {
    // Validate the preferred strategy is feasible
    if (preferred === 'UPDATED_AT' && !hasUpdatedAt(columns)) {
      // Fall through to auto-detect
    } else {
      return preferred;
    }
  }

  // Auto-detect
  if (hasXmin(columns))      return 'XMIN';
  if (hasUpdatedAt(columns)) return 'UPDATED_AT';
  if (hasCreatedAt(columns)) return 'CREATED_AT';
  return 'ROW_HASH';
}

function hasXmin(columns: readonly string[]): boolean {
  return columns.some((c) => c.toLowerCase() === 'xmin');
}

function hasUpdatedAt(columns: readonly string[]): boolean {
  const patterns = ['updated_at', 'atualizado_em', 'dt_atualizacao', 'modified_at', 'changed_at', 'dt_alteracao'];
  return columns.some((c) => patterns.includes(c.toLowerCase()));
}

function hasCreatedAt(columns: readonly string[]): boolean {
  const patterns = ['created_at', 'criado_em', 'dt_criacao', 'inserted_at', 'dt_inclusao'];
  return columns.some((c) => patterns.includes(c.toLowerCase()));
}

function findColumn(columns: readonly string[], patterns: readonly string[]): string | null {
  return columns.find((c) => patterns.includes(c.toLowerCase())) ?? null;
}

// ─── SQL generators ───────────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

function qualName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

export function buildExtractSql(
  schema:    string,
  table:     string,
  config:    TableSyncConfig,
  columns:   readonly string[],
  since:     RecordValue,
  offset:    number,
  batchSize: number,
): StrategyResult {
  const fqn      = qualName(schema, table);
  const strategy = selectStrategy(columns, config.detection);

  let sql:       string;
  let params:    RecordValue[];
  let sinceCol:  string | null = null;

  switch (strategy) {
    case 'XMIN': {
      sql    = `SELECT *, xmin::text AS _xmin FROM ${fqn} WHERE xmin::text::bigint > $1::bigint LIMIT $2 OFFSET $3`;
      params = [since ?? '0', batchSize, offset];
      sinceCol = '_xmin';
      break;
    }

    case 'UPDATED_AT': {
      const col = findColumn(columns, ['updated_at', 'atualizado_em', 'dt_atualizacao', 'modified_at', 'changed_at', 'dt_alteracao'])!;
      sinceCol  = col;
      const cond = since != null ? `WHERE ${quoteIdent(col)} > $1` : '';
      const pList = since != null ? [since, batchSize, offset] : [batchSize, offset];
      const offset$ = since != null ? '$3' : '$2';
      const batch$  = since != null ? '$2' : '$1';
      sql    = `SELECT * FROM ${fqn} ${cond} ORDER BY ${quoteIdent(col)} ASC LIMIT ${batch$} OFFSET ${offset$}`;
      params = pList;
      break;
    }

    case 'CREATED_AT': {
      const col = findColumn(columns, ['created_at', 'criado_em', 'dt_criacao', 'inserted_at', 'dt_inclusao'])!;
      sinceCol  = col;
      const cond = since != null ? `WHERE ${quoteIdent(col)} > $1` : '';
      const pList = since != null ? [since, batchSize, offset] : [batchSize, offset];
      const offset$ = since != null ? '$3' : '$2';
      const batch$  = since != null ? '$2' : '$1';
      sql    = `SELECT * FROM ${fqn} ${cond} ORDER BY ${quoteIdent(col)} ASC LIMIT ${batch$} OFFSET ${offset$}`;
      params = pList;
      break;
    }

    default: {
      // ROW_HASH / CHECKSUM / COMPARISON / NONE — full table scan in batches
      const orderBy = config.orderBy ? ` ORDER BY ${quoteIdent(config.orderBy)}` : '';
      sql    = `SELECT * FROM ${fqn}${orderBy} LIMIT $1 OFFSET $2`;
      params = [batchSize, offset];
      break;
    }
  }

  assertReadOnly(sql);
  return { strategy, sql, params, sinceCol };
}

// ─── Row hash ─────────────────────────────────────────────────────────────────

export function hashRecord(record: SyncRecord): string {
  const normalized = JSON.stringify(
    Object.entries(record)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );
  return createHash('md5').update(normalized).digest('hex');
}

// ─── Change detector ──────────────────────────────────────────────────────────

export class ChangeDetector {
  /**
   * Detect actual changes by comparing current hash against previous hash.
   * Used when no timestamp column is available.
   */
  hasChanged(current: SyncRecord, previousHash: string): boolean {
    return hashRecord(current) !== previousHash;
  }

  /**
   * Extract the "since" value from a record for a given strategy.
   * This value is stored in the checkpoint and used on the next run.
   */
  extractSinceValue(record: SyncRecord, strategy: ChangeDetectionStrategyKind): RecordValue {
    switch (strategy) {
      case 'XMIN':       return record['_xmin'] ?? record['xmin'] ?? null;
      case 'UPDATED_AT': {
        const keys = ['updated_at', 'atualizado_em', 'dt_atualizacao', 'modified_at'];
        for (const k of keys) {
          if (k in record) return record[k] ?? null;
        }
        return null;
      }
      case 'CREATED_AT': {
        const keys = ['created_at', 'criado_em', 'dt_criacao', 'inserted_at'];
        for (const k of keys) {
          if (k in record) return record[k] ?? null;
        }
        return null;
      }
      default: return null;
    }
  }

  /** Estimate detected change count (for progress reporting). */
  async estimateChanges(
    schema:   string,
    table:    string,
    strategy: ChangeDetectionStrategyKind,
    since:    RecordValue,
    queryFn:  (sql: string, params: readonly RecordValue[]) => Promise<readonly SyncRecord[]>,
  ): Promise<DetectedChange> {
    let sql:    string;
    let params: RecordValue[];

    const fqn = qualName(schema, table);

    switch (strategy) {
      case 'UPDATED_AT':
        sql    = `SELECT COUNT(*)::int AS n FROM ${fqn} WHERE updated_at > $1`;
        params = [since];
        break;
      case 'XMIN':
        sql    = `SELECT COUNT(*)::int AS n FROM ${fqn} WHERE xmin::text::bigint > $1::bigint`;
        params = [since ?? '0'];
        break;
      default:
        sql    = `SELECT COUNT(*)::int AS n FROM ${fqn}`;
        params = [];
    }

    assertReadOnly(sql);
    const rows = await queryFn(sql, params);
    const estimated = Number(rows[0]?.['n'] ?? null) || null;

    return {
      schema,
      table,
      strategy,
      since,
      until:     null,
      estimated,
    };
  }
}
