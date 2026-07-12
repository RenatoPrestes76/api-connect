import { describe, it, expect, vi } from 'vitest';
import {
  Bulkhead,
  BulkheadRejectedError,
  BulkheadTimeoutError,
  BulkheadRegistry,
} from '../bulkhead.js';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('Bulkhead — concurrency limiting', () => {
  it('allows calls up to maxConcurrent to run immediately', async () => {
    const bh = new Bulkhead('test', { maxConcurrent: 2, maxQueue: 5 });
    const d1 = deferred<number>();
    const d2 = deferred<number>();

    const p1 = bh.execute(() => d1.promise);
    const p2 = bh.execute(() => d2.promise);
    expect(bh.getMetrics().active).toBe(2);

    d1.resolve(1);
    d2.resolve(2);
    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    expect(bh.getMetrics().active).toBe(0);
  });

  it('queues calls beyond maxConcurrent and runs them once a slot frees up', async () => {
    const bh = new Bulkhead('test', { maxConcurrent: 1, maxQueue: 2 });
    const d1 = deferred<string>();
    const order: string[] = [];

    const p1 = bh.execute(async () => {
      await d1.promise;
      order.push('first');
      return 'first';
    });
    const p2 = bh.execute(async () => {
      order.push('second');
      return 'second';
    });

    expect(bh.getMetrics().active).toBe(1);
    expect(bh.getMetrics().queued).toBe(1);

    d1.resolve('go');
    await p1;
    await p2;
    expect(order).toEqual(['first', 'second']);
  });

  it('rejects immediately once both concurrency and queue are saturated', async () => {
    const bh = new Bulkhead('test', { maxConcurrent: 1, maxQueue: 1 });
    const d1 = deferred<void>();
    void bh.execute(() => d1.promise); // occupies the 1 concurrent slot
    void bh.execute(() => Promise.resolve()).catch(() => undefined); // occupies the 1 queue slot

    await expect(bh.execute(() => Promise.resolve())).rejects.toThrow(BulkheadRejectedError);
    expect(bh.getMetrics().totalRejected).toBe(1);
    d1.resolve();
  });

  it('times out a queued call that waits too long', async () => {
    vi.useFakeTimers();
    try {
      const bh = new Bulkhead('test', { maxConcurrent: 1, maxQueue: 1, queueTimeoutMs: 100 });
      const d1 = deferred<void>();
      void bh.execute(() => d1.promise);

      const queuedResult = bh.execute(() => Promise.resolve()).catch((e) => e);
      await vi.advanceTimersByTimeAsync(150);
      const err = await queuedResult;
      expect(err).toBeInstanceOf(BulkheadTimeoutError);
      d1.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the slot even when the wrapped function throws', async () => {
    const bh = new Bulkhead('test', { maxConcurrent: 1, maxQueue: 1 });
    await expect(bh.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(bh.getMetrics().active).toBe(0);
    const result = await bh.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });
});

describe('BulkheadRegistry', () => {
  it('registers and reuses named bulkheads', () => {
    const registry = new BulkheadRegistry();
    const a = registry.register('db', { maxConcurrent: 5 });
    const b = registry.register('db');
    expect(a).toBe(b);
    expect(registry.get('db')).toBe(a);
  });

  it('lists metrics for all registered bulkheads', () => {
    const registry = new BulkheadRegistry();
    registry.register('db');
    registry.register('http');
    expect(
      registry
        .list()
        .map((m) => m.name)
        .sort()
    ).toEqual(['db', 'http']);
  });

  it('resets a named bulkhead', async () => {
    const registry = new BulkheadRegistry();
    const bh = registry.register('db', { maxConcurrent: 1 });
    await bh.execute(() => Promise.resolve());
    expect(registry.reset('db')).toBe(true);
    expect(bh.getMetrics().totalAccepted).toBe(0);
    expect(registry.reset('nonexistent')).toBe(false);
  });
});
