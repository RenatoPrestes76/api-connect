/**
 * @seltriva/runtime/event-bus
 * Event Bus — async, typed, platform-wide event pub/sub
 *
 * The event bus enables loose coupling between modules.
 * Modules publish domain events; other modules subscribe to patterns.
 *
 * Design choices:
 *   - Events are immutable value objects
 *   - Delivery is at-least-once by default
 *   - Dead-letter queue for failed handlers
 *   - Subscriptions can be namespaced for isolation
 *   - Events carry correlation and trace IDs for observability
 */

import type {
  RuntimeResult, ModuleId, EventId, CorrelationId,
  SpanContext, Priority, Disposable,
} from '../kernel/index';

// ─── Event Bus ────────────────────────────────────────────────────────────

export interface EventBus {
  /**
   * Publish an event to all matching subscribers
   */
  publish<T extends DomainEvent>(event: T): Promise<RuntimeResult<EventPublishResult>>;

  /**
   * Publish multiple events atomically (all or none)
   */
  publishBatch<T extends DomainEvent>(events: T[]): Promise<RuntimeResult<EventPublishResult[]>>;

  /**
   * Subscribe to events matching a topic pattern
   */
  subscribe<T extends DomainEvent>(
    pattern: EventTopicPattern,
    handler: EventHandler<T>,
    options?: SubscriptionOptions,
  ): Disposable;

  /**
   * Subscribe once — automatically unsubscribes after first delivery
   */
  subscribeOnce<T extends DomainEvent>(
    pattern: EventTopicPattern,
    handler: EventHandler<T>,
  ): Disposable;

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): EventSubscription[];

  /**
   * Get dead-letter queue entries
   */
  getDeadLetters(filter?: DeadLetterFilter): EventDeadLetter[];

  /**
   * Replay a dead-letter event
   */
  replay(deadLetterId: string): Promise<RuntimeResult<void>>;

  /**
   * Get event bus statistics
   */
  getStats(): EventBusStats;
}

// ─── Domain Event ─────────────────────────────────────────────────────────

export interface DomainEvent {
  readonly id: EventId;
  readonly topic: EventTopic;
  readonly version: number;
  readonly payload: Record<string, unknown>;
  readonly metadata: EventMetadata;
}

export interface EventMetadata {
  readonly sourceModuleId: ModuleId;
  readonly correlationId: CorrelationId;
  readonly causationId?: EventId;
  readonly spanContext?: SpanContext;
  readonly priority: Priority;
  readonly publishedAt: Date;
  readonly ttlMs?: number;
  readonly tags?: string[];
}

// ─── Topic ────────────────────────────────────────────────────────────────

export type EventTopic = string;
export type EventTopicPattern = string;

/**
 * Topic naming convention: {domain}.{aggregate}.{verb}
 * Examples:
 *   connector.schema.registered
 *   mapping.field.confirmed
 *   sync.job.completed
 *   platform.module.started
 *
 * Patterns support wildcards:
 *   connector.*           — all connector events
 *   *.schema.*            — all schema events in any domain
 *   sync.#                — all events under sync (multi-level)
 */
export const EVENT_TOPICS = {
  // Platform
  PLATFORM_READY:               'platform.kernel.ready',
  MODULE_STARTED:               'platform.module.started',
  MODULE_STOPPED:               'platform.module.stopped',
  MODULE_FAULTED:               'platform.module.faulted',
  PLUGIN_LOADED:                'platform.plugin.loaded',
  PLUGIN_UNLOADED:              'platform.plugin.unloaded',

  // Connector
  CONNECTOR_REGISTERED:         'connector.connector.registered',
  CONNECTOR_CONNECTED:          'connector.connector.connected',
  CONNECTOR_DISCONNECTED:       'connector.connector.disconnected',

  // Schema
  SCHEMA_REGISTERED:            'schema.schema.registered',
  SCHEMA_UPDATED:               'schema.schema.updated',
  SCHEMA_DELETED:               'schema.schema.deleted',
  SCHEMA_ANALYZED:              'schema.schema.analyzed',

  // Mapping
  MAPPING_CONFIRMED:            'mapping.field.confirmed',
  MAPPING_REJECTED:             'mapping.field.rejected',
  MAPPING_CONFLICT_DETECTED:    'mapping.conflict.detected',

  // Sync
  SYNC_STARTED:                 'sync.job.started',
  SYNC_COMPLETED:               'sync.job.completed',
  SYNC_FAILED:                  'sync.job.failed',
  SYNC_CONFLICT_DETECTED:       'sync.conflict.detected',
  SYNC_CONFLICT_RESOLVED:       'sync.conflict.resolved',

  // AI
  AI_RECOMMENDATION_GENERATED:  'ai.recommendation.generated',
  AI_DECISION_MADE:             'ai.decision.made',
} as const;

export type BuiltInEventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS];

// ─── Handler ──────────────────────────────────────────────────────────────

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: EventEnvelope<T>) => Promise<void>;

export interface EventEnvelope<T extends DomainEvent = DomainEvent> {
  readonly event: T;
  readonly deliveryAttempt: number;
  readonly deliveredAt: Date;
  readonly subscriptionId: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────

export interface SubscriptionOptions {
  readonly subscriptionId?: string;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly concurrency?: number;
  readonly dlqEnabled?: boolean;
  readonly filterFn?: (event: DomainEvent) => boolean;
  readonly deserializeFn?: (raw: Record<string, unknown>) => DomainEvent;
}

export interface EventSubscription {
  readonly id: string;
  readonly pattern: EventTopicPattern;
  readonly subscriberModuleId?: ModuleId;
  readonly createdAt: Date;
  readonly deliveredCount: number;
  readonly failedCount: number;
  readonly isActive: boolean;
}

// ─── Publish Result ───────────────────────────────────────────────────────

export interface EventPublishResult {
  readonly eventId: EventId;
  readonly topic: EventTopic;
  readonly subscriberCount: number;
  readonly publishedAt: Date;
}

// ─── Dead-Letter Queue ────────────────────────────────────────────────────

export interface EventDeadLetter {
  readonly id: string;
  readonly event: DomainEvent;
  readonly subscriptionId: string;
  readonly failureReason: string;
  readonly failedAt: Date;
  readonly attemptCount: number;
  readonly lastError?: string;
}

export interface DeadLetterFilter {
  readonly topic?: EventTopicPattern;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface EventBusStats {
  readonly publishedTotal: number;
  readonly deliveredTotal: number;
  readonly failedTotal: number;
  readonly deadLetterTotal: number;
  readonly activeSubscriptions: number;
  readonly byTopic: Record<EventTopic, { published: number; delivered: number; failed: number }>;
}

// ─── Event Store (optional persistence) ──────────────────────────────────

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  getById(id: EventId): Promise<DomainEvent | null>;
  queryByTopic(topic: EventTopic, since?: Date, limit?: number): Promise<DomainEvent[]>;
  getSequence(from: number, limit?: number): Promise<DomainEvent[]>;
  getLatestSequenceNumber(): Promise<number>;
}
