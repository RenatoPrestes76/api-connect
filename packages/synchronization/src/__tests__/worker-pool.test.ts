import { describe, it, expect, vi } from 'vitest';
import { WorkerPool, pMap } from '../workers/worker-pool.js';

describe('WorkerPool', () => {
  it('processes all items', async () => {
    const pool = new WorkerPool<number, number>(2, async (n) => n * 2);
    const results = await pool.runAll([1, 2, 3, 4, 5]);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const pool = new WorkerPool<number, number>(2, async (n) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return n;
    });

    await pool.runAll([1, 2, 3, 4, 5]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('runAllSettled returns null for failed items', async () => {
    const pool = new WorkerPool<number, number>(2, async (n) => {
      if (n === 2) throw new Error('fail');
      return n;
    });

    const results = await pool.runAllSettled([1, 2, 3]);
    expect(results[0]).toBe(1);
    expect(results[1]).toBeNull();
    expect(results[2]).toBe(3);
  });

  it('rejects new work when aborted', async () => {
    const ctrl = new AbortController();
    const pool = new WorkerPool<number, number>(1, async (n) => n, ctrl.signal);
    ctrl.abort();
    await expect(pool.submit(1)).rejects.toThrow('aborted');
  });

  it('stats tracks active and completed counts', async () => {
    const pool = new WorkerPool<number, number>(5, async (n) => {
      await new Promise((r) => setTimeout(r, 5));
      return n;
    });

    const promise = pool.runAll([1, 2, 3]);
    // During execution
    expect(pool.stats().active).toBeGreaterThanOrEqual(0);
    await promise;
    expect(pool.stats().completed).toBe(3);
    expect(pool.stats().active).toBe(0);
    expect(pool.isIdle).toBe(true);
  });

  it('tracks failure count', async () => {
    const pool = new WorkerPool<number, number>(2, async (n) => {
      if (n === 1) throw new Error('fail');
      return n;
    });
    await pool.runAllSettled([1, 2]);
    expect(pool.stats().failed).toBe(1);
  });
});

describe('pMap', () => {
  it('maps items with bounded concurrency', async () => {
    let concurrent = 0;
    let peak = 0;

    const results = await pMap(
      [1, 2, 3, 4, 5],
      async (n) => {
        concurrent++;
        peak = Math.max(peak, concurrent);
        await new Promise((r) => setTimeout(r, 5));
        concurrent--;
        return n * 3;
      },
      2,
    );

    expect(results).toEqual([3, 6, 9, 12, 15]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles empty array', async () => {
    const results = await pMap([], async (n: number) => n, 5);
    expect(results).toHaveLength(0);
  });
});
