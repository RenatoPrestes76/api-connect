import { describe, it, expect, vi } from 'vitest';
import { computeBackoffMs, shouldRetry, withRetry } from '../../modules/orchestrator/retry.js';
import type { RetryPolicy } from '../../modules/orchestrator/types.js';

describe('computeBackoffMs', () => {
  it('fixed strategy always returns base', () => {
    expect(computeBackoffMs(1, 1000, 'fixed')).toBe(1000);
    expect(computeBackoffMs(3, 1000, 'fixed')).toBe(1000);
  });

  it('linear strategy multiplies by attempt', () => {
    expect(computeBackoffMs(1, 1000, 'linear')).toBe(1000);
    expect(computeBackoffMs(3, 1000, 'linear')).toBe(3000);
  });

  it('exponential strategy doubles per attempt', () => {
    expect(computeBackoffMs(1, 1000, 'exponential')).toBe(1000);
    expect(computeBackoffMs(2, 1000, 'exponential')).toBe(2000);
    expect(computeBackoffMs(3, 1000, 'exponential')).toBe(4000);
  });
});

describe('shouldRetry', () => {
  const policy: RetryPolicy = { maxAttempts: 3, backoffMs: 0, strategy: 'fixed' };

  it('always retries when no retryOn filter', () => {
    expect(shouldRetry(new Error('anything'), policy)).toBe(true);
  });

  it('retries when error matches pattern', () => {
    const p: RetryPolicy = { ...policy, retryOn: ['timeout'] };
    expect(shouldRetry(new Error('connection timeout'), p)).toBe(true);
  });

  it('does not retry when error does not match', () => {
    const p: RetryPolicy = { ...policy, retryOn: ['timeout'] };
    expect(shouldRetry(new Error('validation error'), p)).toBe(false);
  });
});

describe('withRetry', () => {
  it('resolves on first attempt if no error', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, backoffMs: 0, strategy: 'fixed' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'success';
    });
    const result = await withRetry(fn, { maxAttempts: 3, backoffMs: 0, strategy: 'fixed' });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));
    await expect(
      withRetry(fn, { maxAttempts: 3, backoffMs: 0, strategy: 'fixed' })
    ).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onAttempt callback with attempt number and error', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('err1')).mockResolvedValue('ok');
    const onAttempt = vi.fn();
    await withRetry(fn, { maxAttempts: 3, backoffMs: 0, strategy: 'fixed' }, onAttempt);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0]![0]).toBe(1);
  });
});
