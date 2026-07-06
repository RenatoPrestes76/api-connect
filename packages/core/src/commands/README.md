# @seltriva/core/commands

Command Bus and Query Bus interfaces — CQRS (Command Query Responsibility Segregation) pattern.

## Purpose

Separates write operations (Commands) from read operations (Queries). All state mutations are expressed as commands dispatched through the `CommandBus`. Read operations use the `QueryBus`.

## Interfaces

| Interface | Role |
|-----------|------|
| `Command` | Base contract for all write operations |
| `CommandResult<T>` | Typed result after command execution |
| `CommandHandler<C, R>` | Handles a single command type |
| `CommandPublisher` | Dispatches commands (single or batch) |
| `CommandHandlerRegistry` | Maps command types → handlers |
| `CommandBus` | Central hub — Publisher + Registry |
| `CommandValidator<C>` | Pre-dispatch validation |
| `CommandValidationResult` | Validation outcome with field errors |
| `ValidationRule<C>` | Single validation rule composable |
| `CommandMiddleware<C, R>` | Pipeline step (logging, auth, tracing) |
| `Query` | Base contract for all read operations |
| `QueryHandler<Q, R>` | Handles a single query type |
| `QueryBus` | Dispatches queries to their handlers |

## Architecture

```
Caller → CommandBus → CommandMiddleware[] → CommandHandler → CommandResult
Caller → QueryBus  → QueryHandler → TResult
```

## Constraints

- No concrete implementations in this module.
- Commands and queries must be immutable (`readonly` fields).
- One handler per command/query type (enforced by registry).
- Handlers must not call other handlers directly — use events for cross-domain side-effects.
