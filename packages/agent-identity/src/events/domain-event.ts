/**
 * DomainEvent — base type for all domain events emitted by AtlasAgent.
 * Follows the same structure as @seltriva/core/events but is self-contained
 * so this package has zero external dependencies.
 */
import { randomUUID } from 'crypto';

export interface DomainEvent {
  /** Unique event id (UUID v4) */
  readonly eventId:      string;
  /** Discriminant type string (e.g. 'AtlasAgent.Registered') */
  readonly type:         string;
  /** The aggregate (entity) this event belongs to */
  readonly aggregateId:  string;
  /** When the event occurred */
  readonly occurredAt:   Date;
  /** Monotonically increasing within the aggregate's lifetime */
  readonly version:      number;
}

/** Convenience factory — fills boilerplate fields. */
export function createDomainEvent<T extends DomainEvent>(
  partial: Omit<T, 'eventId' | 'occurredAt'>,
): T {
  return {
    ...partial,
    eventId:    randomUUID(),
    occurredAt: new Date(),
  } as T;
}
