import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../events/event-bus.js';

function makePayload() {
  return {
    connectorId: 'test-connector',
    version:     '1.0.0',
    startedAt:   new Date(),
  };
}

describe('EventBus.emit + on', () => {
  it('delivers payload to a registered handler', () => {
    const bus     = new EventBus();
    const handler = vi.fn();
    bus.on('connector.started', handler);

    const payload = makePayload();
    bus.emit('connector.started', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('delivers to multiple handlers in subscription order', () => {
    const bus    = new EventBus();
    const order: number[] = [];
    bus.on('connector.started', () => { order.push(1); });
    bus.on('connector.started', () => { order.push(2); });
    bus.emit('connector.started', makePayload());
    expect(order).toEqual([1, 2]);
  });

  it('does not deliver to handlers on other event types', () => {
    const bus     = new EventBus();
    const handler = vi.fn();
    bus.on('connector.stopped', handler);
    bus.emit('connector.started', makePayload());
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe function prevents future deliveries', () => {
    const bus     = new EventBus();
    const handler = vi.fn();
    const unsub   = bus.on('connector.started', handler);
    unsub();
    bus.emit('connector.started', makePayload());
    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler errors and forwards to onError', () => {
    const bus      = new EventBus();
    const errHandler = vi.fn();
    bus.onError(errHandler);
    bus.on('connector.started', () => { throw new Error('boom'); });

    expect(() => bus.emit('connector.started', makePayload())).not.toThrow();
    expect(errHandler).toHaveBeenCalledOnce();
  });
});

describe('EventBus.once', () => {
  it('fires once then auto-unsubscribes', () => {
    const bus     = new EventBus();
    const handler = vi.fn();
    bus.once('connector.started', handler);

    bus.emit('connector.started', makePayload());
    bus.emit('connector.started', makePayload());

    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('EventBus.removeAllListeners', () => {
  it('removes all listeners for a specific event', () => {
    const bus     = new EventBus();
    const handler = vi.fn();
    bus.on('connector.started', handler);
    bus.removeAllListeners('connector.started');
    bus.emit('connector.started', makePayload());
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes all listeners for all events when no argument', () => {
    const bus  = new EventBus();
    const h1   = vi.fn();
    const h2   = vi.fn();
    bus.on('connector.started', h1);
    bus.on('connector.stopped', h2);
    bus.removeAllListeners();
    bus.emit('connector.started', makePayload());
    expect(h1).not.toHaveBeenCalled();
  });
});

describe('EventBus.listenerCount', () => {
  it('reports the correct count', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('connector.started')).toBe(0);
    bus.on('connector.started', vi.fn());
    bus.on('connector.started', vi.fn());
    expect(bus.listenerCount('connector.started')).toBe(2);
  });
});
