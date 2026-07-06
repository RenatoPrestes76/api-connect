/**
 * @seltriva/core/events
 * Event Bus interfaces — Event-Driven Architecture (EDA)
 */

/**
 * Base event contract
 */
export interface Event {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly version: number;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly causationId?: string;
}

/**
 * Typed event handler
 */
export interface EventHandler<TEvent extends Event = Event> {
  handle(event: TEvent): Promise<void>;
  getHandledEventType(): string;
}

/**
 * Event listener (simpler handler for fire-and-forget use)
 */
export interface EventListener<TEvent extends Event = Event> {
  onEvent(event: TEvent): void;
  getEventType(): string;
}

/**
 * Publishes events to the bus
 */
export interface EventPublisher {
  publish(event: Event): Promise<void>;
  publishBatch(events: Event[]): Promise<void>;
}

/**
 * Subscribes to events from the bus
 */
export interface EventSubscriber {
  subscribe<TEvent extends Event>(eventType: string, handler: EventHandler<TEvent>): string;
  unsubscribe(subscriptionId: string): void;
  unsubscribeAll(eventType: string): void;
}

/**
 * Central event bus — combines publisher + subscriber
 */
export interface EventBus extends EventPublisher, EventSubscriber {
  getSubscriberCount(eventType: string): number;
  getRegisteredEventTypes(): string[];
  clear(): void;
}

/**
 * Intercepts events before/after dispatch
 */
export interface EventInterceptor {
  beforePublish?(event: Event): Promise<Event>;
  afterPublish?(event: Event): Promise<void>;
  onError?(event: Event, error: Error): Promise<void>;
  getPriority(): number;
}

/**
 * Replays historical events (Event Sourcing)
 */
export interface EventReplayer {
  replay(eventType: string, fromTimestamp: Date, toTimestamp?: Date): Promise<void>;
  replayForAggregate(aggregateId: string, fromVersion?: number): Promise<void>;
  getReplayStatus(): EventReplayStatus;
}

/**
 * Status of an in-progress replay
 */
export interface EventReplayStatus {
  readonly isReplaying: boolean;
  readonly totalEvents: number;
  readonly processedEvents: number;
  readonly startedAt?: Date;
}

/**
 * Stores and retrieves events (Event Store for Event Sourcing)
 */
export interface EventStore {
  append(streamId: string, events: Event[], expectedVersion?: number): Promise<void>;
  load(streamId: string, fromVersion?: number): Promise<Event[]>;
  loadAll(fromTimestamp?: Date): Promise<Event[]>;
  getStreamVersion(streamId: string): Promise<number>;
}
