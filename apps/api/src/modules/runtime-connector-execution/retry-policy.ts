export const DEFAULT_TIMEOUT_MS = 30_000; // spec default — configurable per execution
export const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // 5 minutes

/** Exponential backoff before the next execution attempt: 2s, 4s, 8s, ... capped at 5 minutes. */
export function computeBackoffDelayMs(attempt: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}
