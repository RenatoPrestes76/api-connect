export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
/** Runtime considered offline if no heartbeat within this window — checked before dispatch, not a general liveness monitor. */
export const RUNTIME_OFFLINE_THRESHOLD_MS = 2 * 60_000;
/** Every returned result is capped at this many rows — the control plane's in-memory store is not a place to buffer unbounded ERP data. */
export const MAX_STORED_ROWS = 10_000;

export function computeBackoffDelayMs(attempt: number): number {
  return Math.min(2000 * 2 ** Math.max(0, attempt - 1), 300_000);
}
