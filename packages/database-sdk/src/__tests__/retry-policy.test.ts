import { describe, it, expect } from 'vitest';
import { computeDelay, DEFAULT_RETRY_POLICY } from '../connection/retry-policy.js';
import type { RetryPolicy } from '../connection/retry-policy.js';

describe('computeDelay — fixed backoff', () => {
  const policy: RetryPolicy = { attempts: 5, backoff: 'fixed', initialDelay: 1000 };

  it('returns initialDelay on every attempt', () => {
    expect(computeDelay(policy, 0)).toBe(1000);
    expect(computeDelay(policy, 1)).toBe(1000);
    expect(computeDelay(policy, 4)).toBe(1000);
  });

  it('respects maxDelay', () => {
    const p: RetryPolicy = { ...policy, maxDelay: 500 };
    expect(computeDelay(p, 0)).toBe(500);
  });
});

describe('computeDelay — exponential backoff', () => {
  const policy: RetryPolicy = {
    attempts: 5, backoff: 'exponential', initialDelay: 100, factor: 2,
  };

  it('doubles delay each attempt', () => {
    expect(computeDelay(policy, 0)).toBe(100);  // 100 * 2^0
    expect(computeDelay(policy, 1)).toBe(200);  // 100 * 2^1
    expect(computeDelay(policy, 2)).toBe(400);  // 100 * 2^2
    expect(computeDelay(policy, 3)).toBe(800);  // 100 * 2^3
  });

  it('respects maxDelay cap', () => {
    const p: RetryPolicy = { ...policy, maxDelay: 300 };
    expect(computeDelay(p, 0)).toBe(100);
    expect(computeDelay(p, 1)).toBe(200);
    expect(computeDelay(p, 2)).toBe(300); // capped
    expect(computeDelay(p, 3)).toBe(300); // capped
  });

  it('uses default factor of 2 when factor omitted', () => {
    const p: RetryPolicy = { attempts: 3, backoff: 'exponential', initialDelay: 50 };
    expect(computeDelay(p, 1)).toBe(100); // 50 * 2^1
  });
});

describe('computeDelay — linear backoff', () => {
  const policy: RetryPolicy = { attempts: 5, backoff: 'linear', initialDelay: 200 };

  it('increases linearly each attempt', () => {
    expect(computeDelay(policy, 0)).toBe(200);  // 200 * 1
    expect(computeDelay(policy, 1)).toBe(400);  // 200 * 2
    expect(computeDelay(policy, 2)).toBe(600);  // 200 * 3
  });

  it('respects maxDelay cap', () => {
    const p: RetryPolicy = { ...policy, maxDelay: 500 };
    expect(computeDelay(p, 0)).toBe(200);
    expect(computeDelay(p, 1)).toBe(400);
    expect(computeDelay(p, 2)).toBe(500); // capped
  });
});

describe('DEFAULT_RETRY_POLICY', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_RETRY_POLICY.attempts).toBe(4);
    expect(DEFAULT_RETRY_POLICY.backoff).toBe('exponential');
    expect(DEFAULT_RETRY_POLICY.initialDelay).toBe(1_000);
    expect(DEFAULT_RETRY_POLICY.factor).toBe(2);
    expect(DEFAULT_RETRY_POLICY.maxDelay).toBe(30_000);
  });
});
