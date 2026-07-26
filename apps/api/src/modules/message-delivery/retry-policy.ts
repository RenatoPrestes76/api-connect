export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 5;
export const DEFAULT_ACK_TIMEOUT_MS = 30_000; // 30s to ACK once sent
export const DEFAULT_TTL_MS = 24 * 60 * 60_000; // 24h before an undelivered message expires to DEAD_LETTER
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // 5 minutes

/** Exponential backoff before the next redelivery attempt: 2s, 4s, 8s, ... capped at 5 minutes. */
export function computeRedeliveryDelayMs(attempt: number): number {
  const delay = BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}
