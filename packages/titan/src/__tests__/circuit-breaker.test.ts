import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError, CircuitBreakerRegistry } from '../circuit-breaker.js';

function makeCb(opts = {}) {
  let now = 1_700_000_000_000;
  const clock = () => now;
  const advanceMs = (ms: number) => {
    now += ms;
  };
  const cb = new CircuitBreaker('test', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5_000,
    clock,
    ...opts,
  });
  return { cb, clock, advanceMs };
}

describe('CircuitBreaker — CLOSED state', () => {
  it('starts CLOSED', () => {
    const { cb } = makeCb();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('passes through successful calls', async () => {
    const { cb } = makeCb();
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('does not open below failure threshold', async () => {
    const { cb } = makeCb();
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after failureThreshold consecutive failures', async () => {
    const { cb } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets failure count on success', async () => {
    const { cb } = makeCb();
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    await cb.execute(() => Promise.resolve('ok')); // success resets count
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED'); // only 1 failure after reset
  });
});

describe('CircuitBreaker — OPEN state', () => {
  it('rejects immediately when OPEN', async () => {
    const { cb } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    await expect(cb.execute(() => Promise.resolve('x'))).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('increments rejectedRequests when OPEN', async () => {
    const { cb } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    await expect(cb.execute(() => Promise.resolve())).rejects.toThrow();
    expect(cb.getMetrics().rejectedRequests).toBe(1);
  });
});

describe('CircuitBreaker — HALF_OPEN transition', () => {
  it('transitions to HALF_OPEN after timeout', async () => {
    const { cb, advanceMs } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    advanceMs(6_000);
    // Next execution should enter HALF_OPEN
    await cb.execute(() => Promise.resolve('probe'));
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('closes after successThreshold successes in HALF_OPEN', async () => {
    const { cb, advanceMs } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    advanceMs(6_000);
    await cb.execute(() => Promise.resolve()); // first success in HALF_OPEN
    expect(cb.getState()).toBe('HALF_OPEN');
    await cb.execute(() => Promise.resolve()); // second — closes
    expect(cb.getState()).toBe('CLOSED');
  });

  it('re-opens on failure in HALF_OPEN', async () => {
    const { cb, advanceMs } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    advanceMs(6_000);
    await expect(cb.execute(() => Promise.reject(new Error('probe fail')))).rejects.toThrow(
      'probe fail'
    );
    expect(cb.getState()).toBe('OPEN');
  });
});

describe('CircuitBreaker — Metrics', () => {
  it('tracks totalRequests and failures', async () => {
    const { cb } = makeCb();
    await cb.execute(() => Promise.resolve());
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    const m = cb.getMetrics();
    expect(m.totalRequests).toBe(2);
    expect(m.failures).toBe(1);
    expect(m.lastFailureTime).not.toBeNull();
  });

  it('reset() clears all state', async () => {
    const { cb } = makeCb();
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    }
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getMetrics().failures).toBe(0);
    expect(cb.getMetrics().openedAt).toBeNull();
  });
});

describe('CircuitBreakerRegistry', () => {
  it('registers and retrieves circuits by name', () => {
    const reg = new CircuitBreakerRegistry();
    reg.register('db', { failureThreshold: 5 });
    const cb = reg.get('db');
    expect(cb?.name).toBe('db');
  });

  it('list() returns metrics for all registered circuits', async () => {
    const reg = new CircuitBreakerRegistry();
    reg.register('svc-a');
    reg.register('svc-b');
    const list = reg.list();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.name).sort()).toEqual(['svc-a', 'svc-b']);
  });

  it('reset() via registry resets the circuit', async () => {
    const reg = new CircuitBreakerRegistry();
    const cb = reg.register('svc', { failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
    reg.reset('svc');
    expect(cb.getState()).toBe('CLOSED');
  });
});
