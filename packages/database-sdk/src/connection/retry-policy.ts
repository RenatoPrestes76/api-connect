export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

export interface RetryPolicy {
  readonly attempts:     number;
  readonly backoff:      BackoffStrategy;
  readonly initialDelay: number;
  readonly maxDelay?:    number;
  readonly factor?:      number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts:     4,
  backoff:      'exponential',
  initialDelay: 1_000,
  maxDelay:     30_000,
  factor:       2,
};

export function computeDelay(policy: RetryPolicy, attempt: number): number {
  const factor   = policy.factor   ?? 2;
  const maxDelay = policy.maxDelay ?? Infinity;

  switch (policy.backoff) {
    case 'exponential':
      return Math.min(policy.initialDelay * Math.pow(factor, attempt), maxDelay);
    case 'linear':
      return Math.min(policy.initialDelay * (attempt + 1), maxDelay);
    default: // 'fixed'
      return Math.min(policy.initialDelay, maxDelay);
  }
}
