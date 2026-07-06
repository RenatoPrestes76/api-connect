# @seltriva/connectors/core

Universal Connector base interfaces — the single foundation every connector type builds on.

## Purpose

Defines the contracts that make the UDCF universal. Regardless of whether a connector integrates PostgreSQL, a REST API, an S3 bucket, or a Kafka topic — it implements `Connector` and returns `ConnectorResult<T>`. The framework never needs to know which type it's working with.

## The Universal Connector Interface

```
Connector
  ├─ connect(config)       → ConnectorResult<void>
  ├─ disconnect()          → ConnectorResult<void>
  ├─ health()              → ConnectorResult<HealthReport>
  ├─ discover(options?)    → ConnectorResult<DiscoveryResult>
  ├─ metadata(target?)     → ConnectorResult<ConnectorMetadata>
  ├─ validate(config)      → ConnectorResult<ValidationReport>
  ├─ authenticate(creds)   → ConnectorResult<AuthResult>
  └─ capabilities()        → CapabilitySet
```

## Key Design Decisions

### ConnectorResult<T> — Never Throws
Every method returns `ConnectorResult<T>`. Errors are data, not exceptions.
This makes the entire framework composable and safe for pipeline use.

```typescript
const result = await connector.health();
if (!result.success) {
  log.warn('unhealthy', result.error);
  return;
}
const { latencyMs } = result.data!;
```

### ConnectorType Discriminant
Connectors are tagged with `type: ConnectorType` so the registry can group and
look them up without switch/if chains.

### Idempotent Lifecycle
`connect()` and `disconnect()` are idempotent by contract. Calling them on an
already-connected / already-disconnected connector must be a safe no-op.

### CapabilitySet — Runtime Feature Detection
Instead of `instanceof` checks, callers use:
```typescript
if (connector.capabilities().has(CAPABILITIES.TRANSACTIONS)) {
  await connector.beginTransaction();
}
```

## Connector States

```
disconnected → connecting → authenticating → ready
                                           ↓
                               error ← connected
                                           ↓
                                        closing → disconnected
```

## Interfaces

| Interface | Role |
|-----------|------|
| `Connector` | Universal base — every connector implements this |
| `ConnectorDescriptor` | Immutable identity (id, name, type, vendor) |
| `ConnectorConfig` | Base configuration (timeout, pool, credentials) |
| `ConnectorCredentials` | Authentication material |
| `ConnectorLifecycle` | Optional lifecycle hooks |
| `ConnectorState` | Typed connection state |
| `ConnectorResult<T>` | Typed result — never throws |
| `ConnectorError` | Structured error with retryable flag |
| `ConnectorErrorCode` | Enumerated error codes |
| `HealthReport` | Full health status from health() |
| `DiscoveryResult` | Tree of discovered items |
| `ValidationReport` | Config validation with field-level issues |
| `AuthResult` | Authentication outcome |
| `CapabilitySet` | Runtime feature-detection API |
| `ConnectorContext` | Runtime services injected by the framework |

## Constraints

- No implementations in this module.
- All connector methods must complete within the configured `timeout`.
- `ConnectorResult.success = false` is ALWAYS accompanied by a `ConnectorError`.
