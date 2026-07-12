import { describe, it, expect } from 'vitest';
import { withExponentialBackoff } from '../retry.js';

function instantSleep(): (ms: number) => Promise<void> {
  return () => Promise.resolve();
}

describe('withExponentialBackoff', () => {
  it('returns the value and attempt count on first-try success', async () => {
    const result = await withExponentialBackoff(async () => 42, { sleep: instantSleep() });
    expect(result).toEqual({ value: 42, attempts: 1 });
  });

  it('retries until success within maxAttempts', async () => {
    let calls = 0;
    const result = await withExponentialBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error('transient');
        return 'ok';
      },
      { maxAttempts: 5, sleep: instantSleep() }
    );
    expect(result).toEqual({ value: 'ok', attempts: 3 });
  });

  it('throws the last error once maxAttempts is exhausted', async () => {
    let calls = 0;
    await expect(
      withExponentialBackoff(
        async () => {
          calls++;
          throw new Error(`fail-${calls}`);
        },
        { maxAttempts: 3, sleep: instantSleep() }
      )
    ).rejects.toThrow('fail-3');
    expect(calls).toBe(3);
  });

  it('does not retry when retryable() returns false', async () => {
    let calls = 0;
    await expect(
      withExponentialBackoff(
        async () => {
          calls++;
          throw new Error('permanent');
        },
        { maxAttempts: 5, retryable: () => false, sleep: instantSleep() }
      )
    ).rejects.toThrow('permanent');
    expect(calls).toBe(1);
  });

  it('computes exponentially increasing raw delay, capped at maxDelayMs', async () => {
    const delays: number[] = [];
    let calls = 0;
    await withExponentialBackoff(
      async () => {
        calls++;
        if (calls < 4) throw new Error('retry me');
        return 'done';
      },
      {
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 300,
        jitter: 'none',
        sleep: instantSleep(),
        onAttempt: (_attempt, delayMs) => delays.push(delayMs),
      }
    );
    // 100, 200, 300 (capped from 400)
    expect(delays).toEqual([100, 200, 300]);
  });

  it('full jitter keeps delay within [0, rawDelay]', async () => {
    const delays: number[] = [];
    let calls = 0;
    await withExponentialBackoff(
      async () => {
        calls++;
        if (calls < 2) throw new Error('retry me');
        return 'done';
      },
      {
        baseDelayMs: 100,
        jitter: 'full',
        sleep: instantSleep(),
        onAttempt: (_a, d) => delays.push(d),
      }
    );
    expect(delays[0]).toBeGreaterThanOrEqual(0);
    expect(delays[0]).toBeLessThanOrEqual(100);
  });
});
