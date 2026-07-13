import { describe, it, expect, vi } from 'vitest';
import { HealthChecker } from '../health.js';
import { makeContext } from './helpers.js';

function makeChecker(id = 'test-erp') {
  const ctx = makeContext(id);
  const checker = new HealthChecker(id, ctx);
  return { checker, ctx };
}

describe('HealthChecker', () => {
  it('returns healthy when connected', async () => {
    const { checker } = makeChecker();
    checker.onConnected();
    const result = await checker.check();
    expect(result.ok).toBe(true);
    expect(result.data!.status).toBe('healthy');
  });

  it('returns unhealthy when not connected', async () => {
    const { checker } = makeChecker();
    const result = await checker.check();
    expect(result.data!.status).toBe('unhealthy');
  });

  it('message is defined when unhealthy', async () => {
    const { checker } = makeChecker();
    const result = await checker.check();
    expect(typeof result.data!.message).toBe('string');
    expect(result.data!.message!.length).toBeGreaterThan(0);
  });

  it('message is undefined when healthy', async () => {
    const { checker } = makeChecker();
    checker.onConnected();
    const result = await checker.check();
    expect(result.data!.message).toBeUndefined();
  });

  it('emits health.changed when status transitions from unhealthy to healthy', async () => {
    const { checker, ctx } = makeChecker();
    const changed = vi.fn();
    ctx.eventBus.on('health.changed', changed);

    await checker.check(); // first check: unhealthy — no prior status, no event
    checker.onConnected();
    await checker.check(); // transitions to healthy → event

    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0][0].previousStatus).toBe('unhealthy');
    expect(changed.mock.calls[0][0].currentStatus).toBe('healthy');
  });

  it('emits health.changed when status transitions from healthy to unhealthy', async () => {
    const { checker, ctx } = makeChecker();
    const changed = vi.fn();
    checker.onConnected();
    await checker.check(); // healthy (sets lastStatus)
    ctx.eventBus.on('health.changed', changed);
    checker.onDisconnected();
    await checker.check(); // transitions to unhealthy → event
    expect(changed).toHaveBeenCalledOnce();
  });

  it('does not emit health.changed on the first check', async () => {
    const { checker, ctx } = makeChecker();
    const changed = vi.fn();
    ctx.eventBus.on('health.changed', changed);
    await checker.check();
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not emit health.changed when status stays the same', async () => {
    const { checker, ctx } = makeChecker();
    checker.onConnected();
    const changed = vi.fn();
    ctx.eventBus.on('health.changed', changed);
    await checker.check();
    await checker.check();
    expect(changed).not.toHaveBeenCalled();
  });

  it('uptimeSince is a Date after onConnected', async () => {
    const { checker } = makeChecker();
    checker.onConnected();
    const result = await checker.check();
    expect(result.data!.uptimeSince).toBeInstanceOf(Date);
  });

  it('uptimeSince is undefined after onDisconnected', async () => {
    const { checker } = makeChecker();
    checker.onConnected();
    checker.onDisconnected();
    const result = await checker.check();
    expect(result.data!.uptimeSince).toBeUndefined();
  });

  it('lastSync is set after onSyncCompleted', async () => {
    const { checker } = makeChecker();
    checker.onConnected();
    checker.onSyncCompleted();
    const result = await checker.check();
    expect(result.data!.lastSync).toBeInstanceOf(Date);
  });
});
