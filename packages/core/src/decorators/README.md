# @seltriva/core/decorators

TypeScript decorator interfaces, option shapes, and reflect-metadata key contracts.

## Purpose

Defines the metadata structures that TypeScript decorators attach to classes, methods, and properties across the platform. Concrete decorator implementations (functions annotated with `@`) live in each feature package — this module only defines **what** they store, not **how** they do it.

## Interfaces

| Interface                                            | Attached By         | Stored On             |
| ---------------------------------------------------- | ------------------- | --------------------- |
| `InjectableOptions` / `InjectableMetadata`           | `@Injectable`       | class                 |
| `InjectOptions`                                      | `@Inject`           | constructor parameter |
| `SubscribeToOptions` / `EventHandlerMetadata`        | `@SubscribeTo`      | method                |
| `HandleCommandOptions` / `CommandHandlerMetadata`    | `@HandleCommand`    | method                |
| `ValidateOptions` / `PropertyValidationMetadata`     | `@Validate`         | property              |
| `RepositoryOptions` / `RepositoryMetadata`           | `@Repository`       | class                 |
| `DriverDecoratorOptions` / `DriverDecoratorMetadata` | `@Driver`           | class                 |
| `PluginDecoratorOptions`                             | `@PluginDescriptor` | class                 |

## Metadata Keys

All reflect-metadata keys are defined as `Symbol`s in `METADATA_KEYS`:

```typescript
import { METADATA_KEYS } from '@seltriva/core/decorators';

// Read metadata in a factory
const meta = Reflect.getMetadata(METADATA_KEYS.INJECTABLE, TargetClass);
```

## Usage Pattern (in a feature package)

```typescript
// packages/drivers/src/decorators.ts
import { METADATA_KEYS, DriverDecoratorOptions } from '@seltriva/core/decorators';

export function Driver(options: DriverDecoratorOptions) {
  return (target: unknown) => {
    Reflect.defineMetadata(METADATA_KEYS.DRIVER, options, target);
  };
}
```

## Constraints

- No concrete decorator functions in this module — only option shapes and metadata contracts.
- `METADATA_KEYS` values are `Symbol`s to prevent collisions with external libraries.
- Implementations must use `reflect-metadata` and require `emitDecoratorMetadata: true` in their tsconfig.
