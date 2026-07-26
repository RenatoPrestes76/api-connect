export const DEFAULT_FAILURE_THRESHOLD = 5; // consecutive failures before the circuit opens
export const DEFAULT_CIRCUIT_TIMEOUT_MS = 60_000; // how long the circuit stays OPEN before allowing a trial (HALF_OPEN) request
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // 5 minutes

/** Exponential backoff before the next reconnect attempt: 2s, 4s, 8s, ... capped at 5 minutes — informational for the Runtime's own retry loop. */
export function computeReconnectDelayMs(consecutiveFailures: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, consecutiveFailures - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

/** Rolling window size for availability/avg-query-time calculations. */
export const HEALTH_HISTORY_LIMIT = 50;
