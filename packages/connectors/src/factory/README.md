# @seltriva/connectors/factory

Connector Factory — creates, configures, and connects connector instances with no direct imports.

## Purpose

Encapsulates all connector creation logic. Callers request a connector by type id; the factory resolves the implementation through the registry and returns a ready `Connector` instance.

## Connector Factory

```typescript
// Create a connector
const result = await factory.create('postgresql', config);

// Create and connect in one step
const result = await factory.createAndConnect('postgresql', config);

// From a serialized config (stored in DB)
const result = await factory.createFromSerialized(serialized);
```

## Fluent Builder

For complex configurations, use `ConnectorBuilder`:

```typescript
const config = builder
  .forType('postgresql')
  .withName('Production DB')
  .withHost('db.example.com', 5432)
  .withCredentials({ username: 'app', password: '...' })
  .withDatabase('seltriva_prod')
  .withPool({ min: 2, max: 20, idleTimeoutMs: 10_000 })
  .withTimeout(30_000)
  .withRetry({ maxAttempts: 3, delayMs: 1_000, backoffMultiplier: 2 })
  .withSsl({ enabled: true, rejectUnauthorized: true })
  .build();

const { isValid, errors } = builder.validate();
if (isValid) {
  const result = await builder.buildAndCreate();
}
```

## Category Factories

For type-safe creation within a category:

```typescript
// Database factory
const result = await dbFactory.createRelational('postgresql', config);
const result = await dbFactory.createDocument('mongodb', config);

// API factory
const result = await apiFactory.createRest(config);
const result = await apiFactory.createGraphQL(config);

// Queue factory
const result = await queueFactory.createKafka(config);
```

## Factory Registry (no switch/if)

```typescript
const factoryRegistry: ConnectorFactoryRegistry = ...;

// Register category factories
factoryRegistry.registerFactory('database', databaseFactory);
factoryRegistry.registerFactory('queue', queueFactory);

// Resolve at runtime — no switch
const factory = factoryRegistry.getFactory(connectorType);
const result = await factory.create(typeId, config);
```

## Interfaces

| Interface | Role |
|-----------|------|
| `ConnectorFactory` | Primary creation interface |
| `ConnectorBuilder` | Fluent step-by-step config assembler |
| `PoolConfig` | Connection pool settings |
| `RetryConfig` | Retry strategy (backoff, max attempts) |
| `SslConfig` | TLS/SSL certificate config |
| `SerializedConnectorConfig` | Portable config for DB storage |
| `DatabaseConnectorFactory` | DB-specific factory |
| `ApiConnectorFactory` | API-specific factory |
| `FileConnectorFactory` | File-specific factory |
| `CloudConnectorFactory` | Cloud-specific factory |
| `QueueConnectorFactory` | Queue-specific factory |
| `ConnectorFactoryRegistry` | Routes creation to the right category factory |

## Constraints

- No implementations in this module.
- `create()` does NOT connect — call `createAndConnect()` or connect manually.
- `ConnectorBuilder.validate()` must be called before `build()` in strict mode.
- Encrypted fields in `SerializedConnectorConfig` must be decrypted by the caller before passing to `create()`.
