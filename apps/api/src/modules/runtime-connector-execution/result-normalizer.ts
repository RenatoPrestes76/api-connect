import type { AtlasStandardResponseStatus, ReportExecutionResultInput } from './types.js';

/**
 * Every ERP returns a different result shape — the Runtime reports raw
 * observed facts (success/rowCount/timedOut/unauthorized/partial) and this
 * function is the single place that classifies them into the Atlas
 * Standard Response taxonomy, so callers everywhere else in Atlas only
 * ever see these six outcomes regardless of which database produced them.
 */
export function normalizeResult(
  input: Pick<
    ReportExecutionResultInput,
    'success' | 'rowCount' | 'partial' | 'timedOut' | 'unauthorized'
  >
): AtlasStandardResponseStatus {
  if (input.unauthorized) return 'UNAUTHORIZED';
  if (input.timedOut) return 'TIMEOUT';
  if (!input.success) return 'FAILED';
  if (input.partial) return 'PARTIAL';
  if (input.rowCount === 0) return 'EMPTY';
  return 'SUCCESS';
}
