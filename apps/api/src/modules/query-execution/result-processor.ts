import { MAX_STORED_ROWS } from './retry-policy.js';
import type { QueryExecutionResult } from './types.js';

/**
 * Normalizes one raw value as reported by the Runtime. Everything already
 * arrives JSON-transported (dates/numbers/strings/null), but drivers that
 * need to preserve exact precision or a non-JSON-native type wrap the value
 * in a small tagged envelope — this is the only place that convention is
 * understood.
 */
export function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj['$date'] === 'string') return obj['$date'];
    if (typeof obj['$decimal'] === 'string') return obj['$decimal']; // preserved as a string — never silently parsed into a lossy float
  }
  return value;
}

export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeValue(value);
  }
  return normalized;
}

/** Normalizes every reported row and caps storage at MAX_STORED_ROWS — the truncation itself is reported back via `truncated`. */
export function processResultRows(
  rows: Record<string, unknown>[],
  columns: string[] | undefined
): { rows: Record<string, unknown>[]; columns: string[]; truncated: boolean } {
  const truncated = rows.length > MAX_STORED_ROWS;
  const capped = truncated ? rows.slice(0, MAX_STORED_ROWS) : rows;
  const normalizedRows = capped.map(normalizeRow);
  const resolvedColumns = columns ?? (normalizedRows[0] ? Object.keys(normalizedRows[0]) : []);
  return { rows: normalizedRows, columns: resolvedColumns, truncated };
}

/** Slices a stored result into one page — no re-execution needed for subsequent GET /:id?page= calls. */
export function paginateResult(
  storedRows: Record<string, unknown>[],
  storedColumns: string[],
  totalRows: number,
  page: number,
  pageSize: number
): QueryExecutionResult {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(pageSize, MAX_STORED_ROWS));
  const start = (safePage - 1) * safePageSize;
  const pageRows = storedRows.slice(start, start + safePageSize);
  return {
    columns: storedColumns,
    rows: pageRows,
    rowCount: pageRows.length,
    totalRows,
    page: safePage,
    pageSize: safePageSize,
    hasMore: start + pageRows.length < storedRows.length,
  };
}
