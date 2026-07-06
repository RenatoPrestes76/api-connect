# @seltriva/connectors/metadata

Metadata Engine — rich structural and schema information from any connected data source.

## Purpose

Provides a unified metadata model that describes what exists in a connected source: databases, schemas, tables, columns, indexes, constraints, relationships, stored procedures, views, triggers, API endpoints, and file structures.

The same `MetadataEngine` interface works regardless of whether the source is PostgreSQL, a REST API, an Excel file, or a Kafka topic.

## Object Hierarchy

```
SourceMetadata
  ├─ DatabaseMetadata[]
  │    └─ SchemaMetadata[]
  │         ├─ TableMetadata[]
  │         │    ├─ ColumnMetadata[]
  │         │    ├─ IndexMetadata[]
  │         │    ├─ ConstraintMetadata[]
  │         │    └─ ForeignKeyMetadata[]
  │         ├─ ViewMetadata[]
  │         ├─ ProcedureMetadata[]
  │         ├─ FunctionMetadata[]
  │         ├─ TriggerMetadata[]
  │         └─ SequenceMetadata[]
  ├─ EntityMetadata[]       ← generic (document stores, queues)
  │    └─ FieldMetadata[]
  │    └─ RelationshipMetadata[]
  ├─ ApiEndpointMetadata[]  ← REST / GraphQL / gRPC / SOAP
  │    ├─ ApiParameterMetadata[]
  │    ├─ ApiBodyMetadata
  │    └─ ApiResponseMetadata[]
  └─ FileStructureMetadata[] ← CSV / Excel / XML / JSON / TXT / ODS
       └─ FieldMetadata[]
```

## MetadataEngine Methods

| Method | Description |
|--------|-------------|
| `getMetadata(options?)` | Full source snapshot |
| `getEntityMetadata(path)` | Single entity details |
| `getRelationships(path)` | Relationships of an entity |
| `exists(path)` | Path existence check |
| `refresh(options?)` | Re-fetch from live source |
| `diff(prev, curr)` | Schema change detection |

## Usage Pattern

```typescript
const engine: MetadataEngine = connector.getMetadataEngine();
const source = await engine.getMetadata({ depth: 'deep' });

for (const db of source.databases ?? []) {
  for (const schema of db.schemas) {
    for (const table of schema.tables) {
      console.log(`${db.name}.${schema.name}.${table.name}`);
      console.log(`  columns: ${table.columns.map(c => c.name).join(', ')}`);
    }
  }
}
```

## Schema Change Detection

```typescript
const v1 = await engine.getMetadata();
// ... time passes ...
const v2 = await engine.refresh();
const diff = engine.diff(v1, v2);

if (diff.hasChanges) {
  console.log('Added:', diff.addedEntities);
  console.log('Removed:', diff.removedEntities);
}
```

## Interfaces

| Interface | Describes |
|-----------|-----------|
| `MetadataEngine` | The primary metadata retrieval API |
| `SourceMetadata` | Full top-level snapshot |
| `DatabaseMetadata` | A database / catalog |
| `SchemaMetadata` | A schema within a database |
| `TableMetadata` | A table (or view, temp table, external table) |
| `ColumnMetadata` | A table column with full type info |
| `IndexMetadata` | An index with column ordering |
| `ConstraintMetadata` | PK, unique, check, not-null constraints |
| `ForeignKeyMetadata` | FK with cascade rules |
| `RelationshipMetadata` | Logical 1:1, 1:N, N:M relationships |
| `EntityMetadata` | Generic entity for NoSQL / queues |
| `FieldMetadata` | Generic field for any entity type |
| `ViewMetadata` | View definition and columns |
| `ProcedureMetadata` | Stored procedure signature |
| `FunctionMetadata` | Function (aggregate, window, strict) |
| `TriggerMetadata` | Trigger event, timing, target |
| `SequenceMetadata` | Auto-increment sequence definition |
| `ApiEndpointMetadata` | REST/GraphQL endpoint descriptor |
| `FileStructureMetadata` | CSV/Excel/JSON file shape |
| `MetadataDiff` | Added/removed/changed entities |

## Constraints

- No implementations in this module.
- All metadata objects are fully `readonly` — metadata is never mutated through these interfaces.
- `SourceMetadata.checksum` can be used to detect changes without a full diff.
