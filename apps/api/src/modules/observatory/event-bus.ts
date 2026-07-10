/**
 * Sprint 30 — OBSERVATORY
 * Simple in-process event bus for distributing system events.
 * Used by SSE endpoints to forward events to connected clients.
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { SystemEvent, SystemEventType } from './types.js';

class ObservatoryEventBus extends EventEmitter {
  private readonly EVENT = 'system-event';

  emit_event(type: SystemEventType, payload: Record<string, unknown> = {}): void {
    const event: SystemEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.emit(this.EVENT, event);
  }

  subscribe(listener: (event: SystemEvent) => void): () => void {
    this.on(this.EVENT, listener);
    return () => this.off(this.EVENT, listener);
  }
}

export const eventBus = new ObservatoryEventBus();
eventBus.setMaxListeners(500); // support many concurrent SSE clients

// ─── Background heartbeat + synthetic demo events ─────────────────────────────

let _demoInterval: ReturnType<typeof setInterval> | null = null;
let _listenerCount = 0;

export function startDemoEvents(): void {
  if (_demoInterval) return;
  _demoInterval = setInterval(() => {
    if (_listenerCount === 0) return;
    eventBus.emit_event('HeartBeat', { ts: new Date().toISOString() });

    // Occasionally emit workflow events
    if (Math.random() < 0.4) {
      const events: SystemEventType[] = ['WorkflowStarted', 'WorkflowFinished', 'MetricSampled'];
      const type = events[Math.floor(Math.random() * events.length)]!;
      eventBus.emit_event(type, { synthetic: true, ts: new Date().toISOString() });
    }
  }, 8_000);
}

export function trackListeners(delta: 1 | -1): void {
  _listenerCount = Math.max(0, _listenerCount + delta);
}
