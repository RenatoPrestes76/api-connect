# @seltriva/core/mapping

Data mapping and transformation interfaces — object-to-object mapping, schema validation, and pipeline transformations.

## Purpose

Provides the contracts for translating data between external system shapes (ERP fields, API payloads) and platform domain objects. All field-level transformations are expressed through these interfaces.

## Interfaces

| Interface | Role |
|-----------|------|
| `Mapper` | Maps typed objects using registered `MappingDefinition`s |
| `MappingDefinition<S, T>` | Full spec for transforming S into T |
| `PropertyMapping<S, T>` | Single field mapping with optional transformer |
| `SchemaMapper` | Maps arbitrary data against a `SchemaDefinition` |
| `SchemaDefinition` | Named, versioned field schema |
| `FieldDefinition` | Per-field type, nullability, nesting |
| `FieldTransform` | Conditional field-level transformer |
| `FieldValidation` | Field-level validator with message |
| `MappingValidationResult` | Outcome of schema validation |
| `TransformationPipeline` | Composable sequential data pipeline |
| `TransformationStep` | Single reversible pipeline step |
| `FieldMappingRegistry` | Stores canonical ERP↔platform field maps |
| `FieldMapping` | One field mapping entry with transformer |

## Architecture

```
ERP Data
   ↓ SchemaMapper (raw → canonical schema)
   ↓ TransformationPipeline (enrich, sanitize, normalize)
   ↓ Mapper (canonical → domain object)
Domain Entity
```

## Constraints

- No concrete implementations in this module.
- `Mapper` works with constructor types; `SchemaMapper` works with plain objects.
- All transformers must be pure functions (no side effects).
