# @seltriva/core/registry

Provider and driver registries — central catalog of all registered external system adapters.

## Purpose

Gives the application a single place to look up any driver or provider by key, type, or capability — without hard-coded imports. The `RegistryManager` owns all six canonical registries plus any custom ones.

## Registries

| Interface | Registered Type | Lookup Methods |
|-----------|----------------|----------------|
| `DatabaseDriverRegistry` | Database drivers | by dialect, by capability |
| `ERPDriverRegistry` | ERP system drivers | by system name/version, by capability |
| `AIProviderRegistry` | AI model providers | by capability, by model name |
| `AuthenticationProviderRegistry` | Auth strategies | by strategy, enabled only |
| `StorageProviderRegistry` | Object/file storage | by storage type, by location |
| `NotificationProviderRegistry` | Notification channels | by channel, enabled only |

## Generic Base

All registries extend `Registry<T>`:

```typescript
interface Registry<T> {
  register(key, item): void
  get(key): T | null
  has(key): boolean
  getAll(): Record<string, T>
  keys(): string[]
  count(): number
  clear(): void
  unregister(key): boolean
}
```

## Registry Manager

```typescript
const dbRegistry = registryManager.getDatabaseDriverRegistry();
const pgDriver   = dbRegistry.get('postgresql');

const aiRegistry = registryManager.getAIProviderRegistry();
const bestAI     = aiRegistry.getDefault();
```

## Constraints

- No concrete implementations in this module.
- Registry entries hold `unknown`-typed driver/provider references to avoid circular dependencies — concrete entry points cast to the correct driver interface.
- The `RegistryManager` is a singleton, resolved via the DI container.
