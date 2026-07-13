# @seltriva/core/abstractions

Generic design pattern abstractions — language-agnostic patterns implemented as TypeScript interfaces.

## Purpose

Provides reusable, typed abstractions for the classic GoF design patterns. These generics are used across all modules and serve as the building blocks for concrete implementations elsewhere in the platform.

## Interfaces

| Interface                | Pattern                                          |
| ------------------------ | ------------------------------------------------ |
| `Strategy<I, O>`         | Strategy — encapsulates a swappable algorithm    |
| `StrategySelector<I, O>` | Strategy — runtime selection by applicability    |
| `ChainHandler<T>`        | Chain of Responsibility                          |
| `Observer<T>`            | Observer — reacts to subject changes             |
| `Observable<T>`          | Observer — notifies attached observers           |
| `Decorator<T>`           | Decorator — wraps a component to extend behavior |
| `Adapter<S, T>`          | Adapter — bridges incompatible interfaces        |
| `TemplateMethod`         | Template Method — fixed skeleton, variable steps |
| `TemplateStep`           | Template Method — one step in the skeleton       |
| `Proxy<T>`               | Proxy — intercepts access to a subject           |
| `ProxyInterceptor`       | Proxy — before/after/error hooks                 |
| `ProxyContext`           | Proxy — context passed to interceptors           |
| `Specification<T>`       | Specification — composable boolean predicate     |
| `UnitOfWork`             | Unit of Work — atomic transaction boundary       |
| `RepositoryCriteria`     | Repository — query filter/sort/page criteria     |

## Composition

```typescript
// Specifications compose:
const active = new ActiveSpec();
const premium = new PremiumSpec();
const eligible = active.and(premium).and(new AgeSpec(18));
eligible.isSatisfiedBy(user); // true/false

// Strategies are selected and executed:
const strategy = selector.select(input);
const result = await strategy?.execute(input);
```

## Constraints

- No concrete implementations in this module.
- Generics default to strict types — avoid `any` in implementations.
- `Specification<T>` must be composable without mutation.
