import type { RetryOptions, RetryResult, JitterStrategy } from './types.js';

function applyJitter(delayMs: number, strategy: JitterStrategy, random: () => number): number {
  switch (strategy) {
    case 'none':
      return delayMs;
    case 'full':
      return random() * delayMs;
    case 'equal':
      return delayMs / 2 + random() * (delayMs / 2);
  }
}

/** Exponential backoff with configurable jitter — the default `full` jitter avoids thundering-herd retries. */
export async function withExponentialBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const jitter = options.jitter ?? 'full';
  const retryable = options.retryable ?? (() => true);
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = Math.random;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn(attempt);
      return { value, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !retryable(err)) throw err;
      const rawDelay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const delayMs = applyJitter(rawDelay, jitter, random);
      options.onAttempt?.(attempt, delayMs, err);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
