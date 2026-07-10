/**
 * Sprint 29 — ORCHESTRATOR
 * Retry policy engine with fixed, linear and exponential backoff strategies.
 */
import type { RetryPolicy, BackoffStrategy } from './types.js';

export function computeBackoffMs(
  attempt: number,
  baseMs: number,
  strategy: BackoffStrategy
): number {
  switch (strategy) {
    case 'fixed':
      return baseMs;
    case 'linear':
      return baseMs * attempt;
    case 'exponential':
      return baseMs * Math.pow(2, attempt - 1);
  }
}

export function shouldRetry(error: unknown, policy: RetryPolicy): boolean {
  if (!policy.retryOn || policy.retryOn.length === 0) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return policy.retryOn.some((pattern) => msg.includes(pattern));
}

export type StepFn<T> = () => Promise<T>;

export async function withRetry<T>(
  fn: StepFn<T>,
  policy: RetryPolicy,
  onAttempt?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      onAttempt?.(attempt, err);

      if (attempt < policy.maxAttempts && shouldRetry(err, policy)) {
        const delay = computeBackoffMs(attempt, policy.backoffMs, policy.strategy);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
