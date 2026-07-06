# @seltriva/core/interfaces

Core domain interfaces — Domain-Driven Design (DDD) primitives and Dependency Injection (DI) container contracts.

## Purpose

Defines the foundational building blocks for every bounded context in the platform: entities, value objects, aggregate roots, domain events, repositories, specifications, and the DI container that wires them together.

## DDD Interfaces

| Interface | DDD Concept |
|-----------|-------------|
| `ValueObject<T>` | Immutable — equality by attribute values |
| `Entity<TId>` | Has a unique, persistent identity |
| `AggregateRoot<TId>` | Consistency boundary; owns domain events |
| `DomainEvent` | Something that happened within the domain |
| `Repository<E, Id>` | Collection-like persistence abstraction |
| `RepositoryCriteria` | Filter / sort / paginate options |
| `UnitOfWork` | Atomic transaction boundary |
| `Specification<T>` | Composable business rule predicate |
| `DomainService` | Stateless operation spanning multiple entities |

## DI Interfaces

| Interface | Role |
|-----------|------|
| `DIContainer` | IoC container — register, resolve, scope |
| `DIRegistrationOptions` | Scope (singleton/transient/request) + tags |
| `ServiceLocator` | Last-resort lookup at composition root |

## Architecture

```
AggregateRoot
  └─ raises DomainEvents
       └─ dispatched via EventBus (see events/)

Repository<Entity>
  └─ bounded by UnitOfWork
       └─ wired by DIContainer
```

## Specification Composition

```typescript
const activeAndVerified = active.and(emailVerified);
const eligible = activeAndVerified.and(premiumPlan.or(trialPlan));
eligible.isSatisfiedBy(user); // true / false
```

## Constraints

- No concrete implementations in this module.
- `AggregateRoot.domainEvents` is collected during the transaction and dispatched after `UnitOfWork.commit()`.
- `ServiceLocator` is available only as an escape hatch — prefer constructor injection.
