# @seltriva/connectors/capabilities

Capability System — runtime feature detection without `instanceof` checks or switch chains.

## Purpose

Replaces conditional logic (`if connector is PostgreSQL then...`) with data-driven capability negotiation. Callers declare what they need; the framework checks whether the connector can satisfy it.

## CAPABILITIES Constants

```typescript
import { CAPABILITIES } from '@seltriva/connectors/capabilities';

connector.capabilities().has(CAPABILITIES.TRANSACTIONS);    // true/false
connector.capabilities().has(CAPABILITIES.STREAMING);       // true/false
connector.capabilities().hasAll([CAPABILITIES.READ, CAPABILITIES.WRITE]);
```

## Capability Categories

| Category | Examples |
|----------|---------|
| `data-access` | `read`, `write` |
| `schema` | `schema-discovery`, `indexes`, `views` |
| `transactional` | `transactions`, `atomic-writes`, `batch-operations` |
| `streaming` | `streaming`, `realtime`, `change-data-capture` |
| `data-movement` | `import`, `export`, `bulk-import`, `bulk-export` |
| `query` | `pagination`, `filtering`, `sorting`, `aggregation` |
| `security` | `authentication`, `field-encryption`, `row-level-security` |
| `connectivity` | `connection-pooling`, `reconnection`, `ssl-tls` |
| `protocol` | `stored-procedures`, `webhooks`, `rate-limiting` |

## Capability Negotiation

```typescript
const negotiator: CapabilityNegotiator = ...;
const required = [CAPABILITIES.TRANSACTIONS, CAPABILITIES.BULK_IMPORT];
const report = negotiator.report(required, connector.capabilities());

if (!report.satisfied) {
  throw new Error(`Missing: ${report.missing.join(', ')}`);
}
```

## Custom Capabilities

Connector plugins can register custom capabilities:

```typescript
capabilityRegistry.register({
  id: 'my-connector:time-travel',
  label: 'Time Travel Queries',
  description: 'Query data at a specific point in time',
  category: 'query',
  requires: [CAPABILITIES.READ],
});
```

## Interfaces

| Interface | Role |
|-----------|------|
| `CAPABILITIES` | Canonical constant map for all built-in capabilities |
| `Capability` | Union type of all built-in capability strings |
| `CapabilityDescriptor` | Rich metadata for a single capability |
| `CapabilitySet` | Immutable set returned by `connector.capabilities()` |
| `CapabilityRegistry` | Stores canonical capability descriptors |
| `CapabilitySetBuilder` | Fluent builder for constructing a CapabilitySet |
| `CapabilityNegotiator` | Compares required vs supported capabilities |
| `CapabilityNegotiationReport` | Outcome: present, missing, optional |

## Constraints

- No implementations in this module.
- Capability ids are lowercase kebab-case strings.
- Custom capability ids must be namespaced: `my-connector:custom-cap`.
