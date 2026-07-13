# @seltriva/core/factories

Factory and Builder interfaces — abstractions for all object creation concerns.

## Purpose

Centralises creation logic so callers never `new` internal classes directly. Factories enable DI-friendly object construction; Builders enable step-by-step assembly of complex configurations.

## Interfaces

| Interface                 | Role                                            |
| ------------------------- | ----------------------------------------------- |
| `Factory<T>`              | Generic factory: `create(config)` → T           |
| `Builder<T>`              | Fluent builder: `.configure().build()`          |
| `DriverFactory`           | Creates any driver by type string               |
| `PluginFactory`           | Instantiates plugins by id or path              |
| `CommandHandlerFactory`   | Resolves handler for a command type             |
| `EventHandlerFactory`     | Resolves all handlers for an event type         |
| `RepositoryFactory`       | Creates typed repository for an entity          |
| `AbstractFactory<Family>` | Creates a coordinated family of related objects |

## Usage Patterns

### Generic Factory

```typescript
const driver = driverFactory.create('postgresql', { host: 'localhost' });
```

### Fluent Builder

```typescript
const config = syncConfigBuilder
  .configure({ mode: 'incremental', batchSize: 500 })
  .configure({ conflictResolution: 'source' })
  .build();
```

### Abstract Factory

```typescript
// Returns { driver, mapper, validator } all pre-configured for SAP
const erpFamily = erpAbstractFactory.createFamily({ system: 'sap', version: '2023' });
```

## Constraints

- No concrete implementations in this module.
- Factory return types are `unknown` where the concrete type requires a cross-module import — callers cast to the appropriate driver/plugin interface.
- `Builder.validate()` must be called before `build()` in implementations that enforce required fields.
