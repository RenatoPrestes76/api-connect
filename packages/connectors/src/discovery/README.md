# @seltriva/connectors/discovery

Discovery Engine — introspects any connected source and maps its full structure.

## Purpose

Answers the question: _"What exists in this data source?"_ without requiring the developer to know the source in advance. The Discovery Engine is the foundation of Seltriva Connect's auto-mapping and visual schema editor features.

## Core Interface

```typescript
interface DiscoveryEngine {
  discover(options?)           → DiscoveryReport
  discoverChildren(parentId)   → DiscoveredItem[]
  search(query)                → DiscoverySearchResult
  getCached()                  → DiscoveryReport | null
  invalidate()                 → void
}
```

## Discovery Report Structure

```
DiscoveryReport
  ├─ items[]          flat list of all discovered items
  ├─ tree             hierarchical tree for UI rendering
  │    └─ root → DiscoveryTreeNode[]
  ├─ stats
  │    ├─ totalItems
  │    ├─ byType      { table: 42, view: 5, procedure: 8 }
  │    ├─ maxDepth
  │    └─ truncated
  └─ warnings[]
```

## Specialized Engines

Each connector type extends `DiscoveryEngine` with domain-specific methods:

| Engine                      | Extra Methods                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RelationalDiscoveryEngine` | `discoverDatabases`, `discoverSchemas`, `discoverTables`, `discoverColumns`, `discoverIndexes`, `discoverProcedures`, `discoverViews`, `discoverTriggers`, `discoverRelationships` |
| `DocumentDiscoveryEngine`   | `discoverCollections`, `discoverDocumentShape`, `discoverIndexes`                                                                                                                  |
| `ApiDiscoveryEngine`        | `discoverEndpoints`, `discoverOperations`, `discoverSchemas`, `loadOpenApiSpec`                                                                                                    |
| `FileDiscoveryEngine`       | `discoverFiles`, `discoverStructure`                                                                                                                                               |
| `CloudDiscoveryEngine`      | `discoverBuckets`, `discoverObjects`                                                                                                                                               |
| `QueueDiscoveryEngine`      | `discoverQueues`, `discoverTopics`, `discoverConsumerGroups`, `discoverMessageSchema`                                                                                              |

## Discovery Strategies

The `DiscoveryStrategy` interface allows pluggable discovery algorithms per connector:

```typescript
class PostgreSQLDiscoveryStrategy implements DiscoveryStrategy {
  getStrategyName() {
    return 'postgresql';
  }
  getSupportedTypes() {
    return ['table', 'view', 'procedure', 'trigger'];
  }
  async discover(context) {
    /* query information_schema */
  }
}
```

## Lazy Tree Traversal

For large sources, use `discoverChildren()` to lazy-load:

```typescript
const report = await engine.discover({ depth: 'shallow' });
const tables = await engine.discoverChildren('schema:public');
const columns = await engine.discoverChildren('table:users');
```

## Constraints

- No implementations in this module.
- Engines must implement caching: `getCached()` returns the last report without a network call.
- `discover({ depth: 'shallow' })` must complete quickly (no recursion) for large sources.
- All methods must return empty arrays (not throw) when no items are found.
