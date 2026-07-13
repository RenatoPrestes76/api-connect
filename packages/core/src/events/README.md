# @seltriva/core/events

Event-Driven Architecture (EDA) interfaces for the Seltriva Connect platform.

## Purpose

Decouples producers from consumers of domain events. All cross-module communication flows through the `EventBus` — no direct imports between business modules.

## Interfaces

| Interface          | Role                                                |
| ------------------ | --------------------------------------------------- |
| `Event`            | Base contract for all domain and integration events |
| `EventHandler<T>`  | Async handler for a specific typed event            |
| `EventListener<T>` | Fire-and-forget listener (synchronous)              |
| `EventPublisher`   | Publishes one or many events                        |
| `EventSubscriber`  | Subscribes handlers to event types                  |
| `EventBus`         | Central hub — combines Publisher + Subscriber       |
| `EventInterceptor` | Cross-cutting: logging, tracing, auth per event     |
| `EventReplayer`    | Replays historical events (Event Sourcing)          |
| `EventStore`       | Append-only log of events per aggregate stream      |

## Architecture

```
Producer → EventBus → EventHandler[]
                   ↘ EventInterceptor[] (pre/post hooks)
EventStore (persists events for replay / audit)
```

## Usage Pattern

```typescript
// Subscribe
eventBus.subscribe<UserCreated>('user.created', handler);

// Publish
await eventBus.publish({ id: uuid(), type: 'user.created', ... });
```

## Constraints

- No concrete implementations in this module.
- All events must be immutable (`readonly` fields).
- Handlers must be idempotent (events may be delivered more than once).
