# @seltriva/connectors/registry

Connector Registry — dynamic, Map-based connector registration. No switch. No if. No hardcoded implementations.

## Purpose

Decouples connector consumers from connector implementations. Any part of the system that needs a connector calls `registry.get('postgresql')` — it never imports the PostgreSQL connector directly. New connectors plug in without touching existing code.

## Two Registries

```
ConnectorRegistryManager
  ├─ typeRegistry      ← what connector TYPES exist (by id → factory)
  └─ instanceRegistry  ← what connector INSTANCES are live (by instanceId → Connector)
```

## Type Registry

```typescript
// Register a new connector type
typeRegistry.register(
  { id: 'postgresql', name: 'PostgreSQL', type: 'database', ... },
  async (config) => new PostgreSQLConnector(config),
  { tags: ['relational', 'sql', 'open-source'] }
);

// Lookup — no switch/if
const entry = typeRegistry.get('postgresql');
const connector = await entry.factory(config);

// Filter by type
const dbConnectors = typeRegistry.getByType('database');
const queueConnectors = typeRegistry.getByType('queue');

// Search
const awsConnectors = typeRegistry.find({ vendor: 'AWS', enabledOnly: true });
```

## Instance Registry

```typescript
// Create a live instance
const conn = await manager.createInstance('postgresql', 'pg-prod', config);

// Retrieve later — no need to pass the instance around
const conn = instanceRegistry.get('pg-prod');

// Cleanup
await manager.disposeInstance('pg-prod');
await instanceRegistry.disposeAll(); // shutdown
```

## Config Schema

Each registered connector can expose its configuration schema:

```typescript
{
  properties: {
    host:     { type: 'string', label: 'Host', required: true },
    port:     { type: 'number', label: 'Port', default: 5432 },
    password: { type: 'string', label: 'Password', secret: true },
  },
  required: ['host', 'port'],
}
```

This schema is used by the Studio UI to render configuration forms dynamically.

## Registry Events

```typescript
typeRegistry.onChange((event) => {
  console.log(`${event.action}: ${event.connectorId}`);
  // 'registered', 'unregistered', 'enabled', 'disabled'
});
```

## Interfaces

| Interface | Role |
|-----------|------|
| `ConnectorRegistry` | Type registry — maps id → factory |
| `ConnectorRegistryEntry` | Entry: descriptor + factory + schema |
| `ConnectorFactory` | Factory function signature |
| `ConnectorConfigSchema` | JSON Schema-like config descriptor |
| `ConnectorInstanceRegistry` | Instance registry — maps instanceId → Connector |
| `ConnectorRegistryManager` | Combined manager |
| `ConnectorSearchCriteria` | Filter for `registry.find()` |
| `RegistryChangeEvent` | Emitted on register/unregister/enable/disable |

## Constraints

- No implementations in this module.
- Connector ids must be globally unique kebab-case strings (`postgresql`, `rabbitmq`, `amazon-s3`).
- `registry.clear()` is for testing only — never call in production.
- The instance registry must call `connector.disconnect()` before removing an instance.
