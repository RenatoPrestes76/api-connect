import { describe, it, expect } from 'vitest';
import { withTimeout, TimeoutError } from '../timeout.js';

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe('withTimeout', () => {
  it('resolves with the value when the function finishes before the timeout', async () => {
    const result = await withTimeout(() => delay(10, 'ok'), 200);
    expect(result).toBe('ok');
  });

  it('rejects with TimeoutError when the function is slower than the timeout', async () => {
    await expect(withTimeout(() => delay(200, 'ok'), 20, 'slow-op')).rejects.toThrow(TimeoutError);
  });

  it('propagates the original rejection when the function fails before the timeout', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('boom')), 200)).rejects.toThrow('boom');
  });
});
