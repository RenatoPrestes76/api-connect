export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 60_000; // 1 minute per attempt
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // 5 minutes

/** Exponential backoff: 2s, 4s, 8s, ... capped at 5 minutes. `attempt` is the attempt number that just failed (1-based). */
export function computeBackoffDelayMs(attempt: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}
