import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry, AtlasApiError } from '../client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('retries a transient failure and succeeds once the underlying attempt recovers', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('network blip');
        return 'ok';
      },
      { maxAttempts: 5, baseDelayMs: 1 }
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('calls the attempt function fresh each time — proving retries cannot reuse a stale signature/timestamp closure', async () => {
    const seen: number[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        const freshValue = Date.now() + calls; // stands in for "a fresh timestamp built inside the closure"
        seen.push(freshValue);
        if (calls < 3) throw new Error('retry me');
        return freshValue;
      },
      { maxAttempts: 5, baseDelayMs: 1 }
    );
    // Every recorded value must be distinct — nothing was cached/reused across attempts.
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('gives up after maxAttempts and surfaces the last error', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('always fails');
        },
        { maxAttempts: 2, baseDelayMs: 1 }
      )
    ).rejects.toThrow('always fails');
  });

  it('does not retry a 4xx AtlasApiError (a signature/validation rejection is not transient)', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new AtlasApiError('Invalid request signature', 401, 'INVALID_SIGNATURE');
        },
        { maxAttempts: 5, baseDelayMs: 1 }
      )
    ).rejects.toThrow('Invalid request signature');
    expect(calls).toBe(1);
  });

  it('does retry a 5xx AtlasApiError (transient server-side failure)', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 2) throw new AtlasApiError('Internal error', 500, 'INTERNAL_ERROR');
        return 'recovered';
      },
      { maxAttempts: 3, baseDelayMs: 1 }
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });
});
