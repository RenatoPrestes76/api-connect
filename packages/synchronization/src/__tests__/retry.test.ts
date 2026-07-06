import { describe, it, expect, vi } from 'vitest';
import { RetryEngine } from '../retry/retry-engine.js';

const FAST_CONFIG = {
  maxAttempts:       3,
  initialDelayMs:    10,
  maxDelayMs:        50,
  backoffMultiplier: 2,
  jitterMs:          0,
  retryableErrors:   ['ECONNRESET', 'NETWORK_ERROR'],
};

describe('RetryEngine', () => {
  it('succeeds on first attempt', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const fn = vi.fn().mockResolvedValue(42);
    const result = await engine.execute(fn);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error then succeeds', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET: connection reset'))
      .mockResolvedValue('ok');

    const result = await engine.execute(fn);
    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on non-retryable error', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const fn = vi.fn().mockRejectedValue(new Error('FATAL: something broke'));
    const result = await engine.execute(fn);
    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts all attempts and returns SyncError', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const fn = vi.fn().mockRejectedValue(new Error('NETWORK_ERROR: timeout'));
    const result = await engine.execute(fn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RETRY_EXHAUSTED');
      expect(result.error.retryable).toBe(false);
    }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('notifies observer on each attempt', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const attempts: number[] = [];
    engine.onAttempt(({ attempt }) => attempts.push(attempt));

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockResolvedValue('done');

    await engine.execute(fn);
    expect(attempts).toContain(1);
  });

  it('respects observer unsubscribe', async () => {
    const engine = new RetryEngine(FAST_CONFIG);
    const calls: number[] = [];
    const unsub = engine.onAttempt(({ attempt }) => calls.push(attempt));
    unsub();

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockResolvedValue('done');
    await engine.execute(fn);
    expect(calls).toHaveLength(0);
  });

  it('calculates exponential backoff', () => {
    const engine = new RetryEngine({
      ...FAST_CONFIG,
      initialDelayMs: 1000,
      backoffMultiplier: 3,
      maxDelayMs: 100_000,
      jitterMs: 0,
    });
    // Access private for test via cast
    const calc = (engine as unknown as { _calculateDelay: (n: number) => number })._calculateDelay.bind(engine);
    expect(calc(1)).toBe(1000);   // 1000 * 3^0
    expect(calc(2)).toBe(3000);   // 1000 * 3^1
    expect(calc(3)).toBe(9000);   // 1000 * 3^2
  });

  it('caps delay at maxDelayMs', () => {
    const engine = new RetryEngine({
      ...FAST_CONFIG,
      initialDelayMs:    10_000,
      backoffMultiplier: 10,
      maxDelayMs:        15_000,
      jitterMs:          0,
    });
    const calc = (engine as unknown as { _calculateDelay: (n: number) => number })._calculateDelay.bind(engine);
    expect(calc(3)).toBe(15_000);
  });
});
