# @seltriva/core/exceptions

Core exception interfaces — typed error contracts for every infrastructure concern.

## Purpose

Provides a hierarchy of typed exception interfaces so catch blocks can discriminate error types without `instanceof` on concrete classes.

## Exception Hierarchy

```
CoreException (base)
  ├─ ConfigurationException   (CONFIG_ERROR, CONFIG_VALIDATION_ERROR, CONFIG_NOT_FOUND)
  ├─ DIException               (DI_NOT_FOUND, DI_ALREADY_REGISTERED, DI_CIRCULAR_DEPENDENCY, DI_RESOLUTION_ERROR)
  ├─ RegistryException         (REGISTRY_NOT_FOUND, REGISTRY_ALREADY_REGISTERED, REGISTRY_INVALID_TYPE)
  ├─ PluginException           (PLUGIN_NOT_FOUND, PLUGIN_INIT_ERROR, PLUGIN_LOAD_ERROR, PLUGIN_INVALID)
  ├─ EventBusException         (EVENT_HANDLER_ERROR, EVENT_LISTENER_ERROR, EVENT_INVALID)
  ├─ CommandBusException       (COMMAND_NOT_FOUND, COMMAND_HANDLER_ERROR, COMMAND_INVALID)
  ├─ DiscoveryException        (DISCOVERY_ERROR, DISCOVERY_NOT_FOUND, DISCOVERY_INVALID)
  ├─ DriverException           (DRIVER_NOT_FOUND, DRIVER_NOT_COMPATIBLE, DRIVER_ERROR)
  ├─ MappingException          (MAPPING_NOT_FOUND, MAPPING_ERROR, MAPPING_INVALID_SCHEMA)
  └─ SyncException             (SYNC_ERROR, SYNC_CONFLICT, SYNC_TIMEOUT)
```

## Base Contract

```typescript
interface CoreException extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;
  readonly originalError?: Error;
}
```

## Usage

```typescript
try {
  await driverRegistry.get('unknown-driver');
} catch (err) {
  const ex = err as DriverException;
  if (ex.code === 'DRIVER_NOT_FOUND') {
    // handle specifically
  }
}
```

## Constraints

- All exceptions are interfaces (not classes) — concrete error classes live in feature packages.
- `code` is a string literal union narrowed per exception type.
- `originalError` preserves the wrapped cause for logging.
