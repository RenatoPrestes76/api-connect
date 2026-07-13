import type { ConnectorEventMap, ConnectorEventType } from './connector-events.js';

type Handler<T> = (payload: T) => void;
type Unsubscribe = () => void;

/**
 * Typed synchronous event bus.
 * Handlers are called in subscription order.
 * Errors in handlers are caught and forwarded to the optional error handler.
 */
export class EventBus {
  private readonly _handlers = new Map<string, Set<Handler<unknown>>>();
  private _onError?: (event: string, error: unknown) => void;

  /** Emit a typed event to all registered handlers. */
  emit<K extends ConnectorEventType>(event: K, payload: ConnectorEventMap[K]): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        this._onError?.(event, err);
      }
    }
  }

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends ConnectorEventType>(event: K, handler: Handler<ConnectorEventMap[K]>): Unsubscribe {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    const handlers = this._handlers.get(event)!;
    handlers.add(handler as Handler<unknown>);
    return () => {
      handlers.delete(handler as Handler<unknown>);
    };
  }

  /** Subscribe to an event and automatically unsubscribe after the first call. */
  once<K extends ConnectorEventType>(
    event: K,
    handler: Handler<ConnectorEventMap[K]>
  ): Unsubscribe {
    const unsub = this.on(event, (payload) => {
      unsub();
      handler(payload);
    });
    return unsub;
  }

  /** Register a global error handler for handler exceptions. */
  onError(handler: (event: string, error: unknown) => void): void {
    this._onError = handler;
  }

  /** Remove all handlers for a specific event, or all events if none specified. */
  removeAllListeners(event?: ConnectorEventType): void {
    if (event) {
      this._handlers.delete(event);
    } else {
      this._handlers.clear();
    }
  }

  /** Number of handlers registered for a given event. */
  listenerCount(event: ConnectorEventType): number {
    return this._handlers.get(event)?.size ?? 0;
  }
}
