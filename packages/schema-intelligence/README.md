# @seltriva/schema-intelligence

Schema Intelligence Engine (SIE) — understands, normalizes, compares, and versions any data structure from any connector.

## Overview

SIE is a pure TypeScript interface library (no concrete implementations, no I/O). It defines the contracts that turn raw schema data — SQL DDL, OpenAPI specs, GraphQL SDL, CSV headers, JSON Schema, XSD — into a single, source-independent representation that can be diffed, versioned, fingerprinted, and learned from.

**What it does:**

- Parses any schema format into a canonical intermediate form
- Normalizes naming conventions, type systems, and relationship topologies
- Compares two versions of any schema and classifies breaking changes
- Detects structural renames (field disappeared + structurally similar field appeared)
- Versions every schema with delta patches and an immutable history
- Fingerprints schema structure for duplicate detection
- Measures structural similarity between schemas from different sources
- Learns structural patterns from schema metadata (never from data values)
- Classifies unknown schemas against known ERP product patterns (SAP, TOTVS, Oracle EBS)

**What it does NOT do:**

- Execute queries or read actual data
- Implement any UI
- Expose HTTP endpoints
- Store data in any specific database
- Contain business logic about what the data means

---

## Architecture

SIE is organized around the Hexagonal Architecture pattern. Every module is a set of interface contracts (ports). Concrete adapters are provided externally by the application or infrastructure layer.

```
Raw Input (SQL DDL / OpenAPI / CSV / ...)
         │
         ▼
   ┌─────────────┐
   │   Parser    │  format-specific → RawSchema
   └──────┬──────┘
          │ RawSchema
          ▼
   ┌─────────────┐
   │  Normalizer │  RawSchema → CanonicalSchema
   └──────┬──────┘
          │ CanonicalSchema  (single universal representation)
          ├──────────────────────────────────────────────────┐
          ▼                                                  │
   ┌─────────────┐     ┌────────────┐     ┌──────────────┐  │
   │  Comparator │     │ Versioning │     │  Fingerprint │  │
   └──────┬──────┘     └─────┬──────┘     └──────┬───────┘  │
          │                  │                    │          │
          ▼                  ▼                    ▼          │
   ┌─────────────┐     ┌────────────┐     ┌──────────────┐  │
   │  Detector   │     │  Registry  │     │  Similarity  │  │
   └─────────────┘     └────────────┘     └──────────────┘  │
          │                                                  │
          ▼                                                  │
   ┌─────────────┐                                          │
   │  Learning   │  ◄────────────────────────────────────── ┘
   └─────────────┘
```

### Two-Stage Pipeline

The core pipeline is intentionally two-staged:

1. **Parse** — format-specific. The SQL parser knows SQL; the OpenAPI parser knows OpenAPI. Each produces a `RawSchema` that still carries source-format artifacts.

2. **Normalize** — format-agnostic. The normalizer converts `RawSchema` to `CanonicalSchema`. All subsequent modules — comparator, fingerprint, similarity, learning — depend only on `CanonicalSchema`, never on source formats.

This decoupling means adding a new source format (e.g., Avro, Protobuf) requires only a new parser. The rest of the system needs no changes.

---

## Module Reference

### `models/`

Shared vocabulary. Branded TypeScript ID types, enumeration type aliases, and primitive domain types used by every other module.

```typescript
type SchemaId   = string & { readonly __brand: 'SchemaId' };
type CanonicalDataKind = 'string' | 'integer' | 'bigint' | 'boolean' | 'json' | ...;
type FieldRole  = 'primary-key' | 'created-at' | 'tenant-id' | 'soft-delete' | ...;
```

Branded IDs prevent accidentally passing an `EntityId` where a `SchemaId` is expected.

---

### `core/`

Base infrastructure: `SIEResult<T>`, `SIEError`, raw data types, and the `SchemaIntelligenceEngine` top-level facade.

`SIEResult<T>` is the never-throws result wrapper used throughout:

```typescript
interface SIEResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: SIEError;
  readonly durationMs?: number;
  readonly timestamp: Date;
}
```

---

### `canonical/`

The universal schema model. This is the contract every downstream module is written against.

Key types:

| Type                    | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `CanonicalSchema`       | Top-level schema with entities, relationships, enumerations, statistics |
| `CanonicalEntity`       | A table, collection, API resource, or file structure                    |
| `CanonicalField`        | A column, document field, or CSV column with inferred role and type     |
| `CanonicalType`         | Universal type with `kind: CanonicalDataKind` — maps every native type  |
| `CanonicalRelationship` | FK, $ref, or inferred relationship with cardinality and confidence      |
| `SchemaPatch`           | Ordered list of `PatchOperation` — used for delta versioning            |

---

### `parser/`

Format-specific parsers. Each implements `SchemaParser<TOptions>`.

| Parser                | Source type   | Key feature                                         |
| --------------------- | ------------- | --------------------------------------------------- |
| `SqlDdlParser`        | `sql-ddl`     | Detects dialect, parses single statements           |
| `OpenApiParser`       | `openapi`     | Supports v2/v3, resolves $ref                       |
| `GraphQLSchemaParser` | `graphql-sdl` | Parses types, infers relationships from directives  |
| `CsvSchemaParser`     | `csv-header`  | Parses header-only; type inference from sample rows |
| `JsonSchemaParser`    | `json-schema` | Supports all drafts, flattens $defs                 |
| `XmlSchemaParser`     | `xml-xsd`     | Parses XSD, resolves xs:import                      |

Auto-detection via `SchemaParserRegistry.detect(raw)` — returns the highest-confidence parser without manual configuration.

---

### `normalizer/`

Converts `RawSchema` → `CanonicalSchema` via a composable pipeline of `NormalizationStep` instances.

Key components:

- `NormalizationPipeline` — ordered chain; each step transforms `NormalizationState`
- `TypeNormalizer` — per-dialect; maps native type strings to `CanonicalType`
- `FieldRoleInferenceEngine` — infers field roles from name patterns, types, constraints
- `NamingConventionDetector` — detects and converts between snake_case, camelCase, PascalCase, etc.
- `RelationshipInferrer` — discovers implicit relationships from FK naming conventions

---

### `comparator/`

Point-in-time diff between two `CanonicalSchema` versions.

```
SchemaDiff
  ├── addedEntities / removedEntities / modifiedEntities / renamedEntities
  ├── EntityDiff[]
  │     ├── addedFields / removedFields / modifiedFields / renamedFields
  │     └── FieldDiff (TypeChange, NullabilityChange, RequiredChange, ...)
  └── breakingChanges: BreakingChange[]
```

`RenameDetection` — probabilistic rename: a field disappeared and a structurally similar one appeared with confidence derived from name similarity, type match, and position proximity.

`BreakingChangeClassifier` — configurable rule engine. Built-in categories: `entity-removed`, `field-removed`, `field-type-narrowed`, `field-made-required`, `primary-key-changed`, etc.

---

### `detector/`

Temporal change detection. Where `comparator` does a one-shot diff, `detector` tracks a schema over time.

`ChangeDetectionEngine.detect(schemaId, newSchema)` automatically fetches the previous version and:

1. Runs the comparator
2. Classifies breaking changes
3. Emits `EvolutionEvent[]` — 25 granular event kinds
4. Generates `MappingSuggestion[]` — field-rename / type-cast / use-default hints
5. Produces `ImpactAssessment` with `RiskLevel` and migration complexity

---

### `versioning/`

Immutable version history for any schema.

```
SchemaVersionStore   (save / get / getLatest / getAncestors / list)
SchemaVersionHistory (navigate versions, find by tag/label)
SchemaTimeline       (visual timeline of all events, supports branching)
VersionTagger        (human-readable tags and labels)
SnapshotReconstructor (rebuild any version from base + patch chain)
```

Versions use `SchemaPatch` (delta operations) for storage efficiency — only the base snapshot is stored in full; older versions are reconstructed on demand.

---

### `registry/`

Two concerns:

1. **Schema Registry** — central store of all processed schemas with metadata, tags, and version pointers. Supports fingerprint-based duplicate detection.

2. **ERP Pattern Registry** — a metadata-only library of known ERP and domain schema patterns. Used by the similarity engine to classify unknown schemas against SAP, TOTVS, Oracle EBS, and other known product schemas.

---

### `fingerprint/`

Generates deterministic structural hashes from schema structure — never from data values. Identical schemas (regardless of source format) produce identical fingerprints.

`SchemaFingerprint` contains:

- `hash` — full structural hash
- `structureHash` — type/constraint structure, ignoring names
- `nameHash` — names only
- `entityFingerprints[]` — per-entity hashes with `fieldTypeSignature`

`FingerprintDelta` — lightweight "has anything changed?" check between two fingerprints. Faster than a full diff.

---

### `similarity/`

Structural similarity scoring between schemas, entities, and fields.

```typescript
engine.compareSchemas(a, b) → SchemaSimilarityReport
engine.mapFields(source, target) → FieldMappingResult
engine.rankSchemas(query, candidates) → SchemaSimilarityRanking[]
```

`SimilarityVerdict`: `identical` | `very-similar` | `similar` | `partially-similar` | `different` | `unrelated`

Pluggable `SimilarityStrategy` — default combines name similarity (35%), type similarity (25%), field coverage (20%), role similarity (10%), constraint (5%), position (5%).

`NameSimilarityScorer` — handles snake_case vs camelCase, abbreviations (`cust` → `customer`), and user-registered synonyms.

---

### `learning/`

Discovers structural patterns from schema metadata. **Never inspects data values.**

What it learns:

| Pattern Kind              | Example                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `field-naming-convention` | `customer_id`, `created_at` follow snake_case                            |
| `field-role-indicator`    | Fields named `*_at` with TIMESTAMP type → `created-at` role              |
| `entity-structure`        | "address" entities typically have 5–8 fields: street, city, postal_code… |
| `relationship-topology`   | Star schema: one hub entity with many FK references                      |
| `type-evolution`          | INT → BIGINT is the most common widening pattern                         |
| `audit-fields`            | Most entities have `created_at` + `updated_at` + `deleted_at`            |

`PatternApplicator.enrich(schema, patterns)` — applies learned patterns to fill in missing roles, detect missing audit fields, and surface naming inconsistencies.

---

### `adapters/`

Bridges the connector world to the SIE world. Each adapter converts connector-provided metadata (not schema strings — already-parsed metadata objects) into `SchemaSource` / `RawSchema` inputs.

No connector package is imported — adapters receive plain data shapes to avoid circular dependencies.

| Adapter                 | Connector category                                              |
| ----------------------- | --------------------------------------------------------------- |
| `DatabaseSchemaAdapter` | relational databases (tables, columns, FK constraints)          |
| `ApiSchemaAdapter`      | REST / GraphQL / gRPC (endpoints, parameters, response schemas) |
| `FileSchemaAdapter`     | CSV, Excel, XML, JSON files                                     |
| `CloudSchemaAdapter`    | S3, Azure Blob, GCS, Supabase storage                           |

---

### `transformers/`

Stateless transformation functions:

- `TypeTransformer` — maps native type string → `CanonicalType` (one per dialect)
- `NamingConventionTransformer` — tokenize → assemble in target convention
- `FieldTransformer` / `EntityTransformer` — composable field/entity transforms
- `TransformationPipeline<TInput, TContext>` — ordered chain with conditional application
- `TypeCompatibilityMatrix` — defines widening (INT→BIGINT) vs narrowing (BIGINT→INT) rules

---

### `validators/`

Structural integrity checks on `CanonicalSchema`. All validators are rule-based and independently configurable.

Built-in rule categories:

| Scope        | Example                                                   |
| ------------ | --------------------------------------------------------- |
| Schema       | No two entities share the same name in the same namespace |
| Entity       | Every entity has at least one field and a primary key     |
| Field        | Enum fields reference declared enumerations               |
| Relationship | FK targets exist and their types match the referenced PK  |
| Cross-entity | No circular required FK references                        |

`ValidationRuleRegistry` — dynamic rule map. Add custom rules with `register(rule)`.

---

## Extension Guide

### Adding a new source format

1. Implement `SchemaParser<TOptions>` in a new file
2. Register it: `parserRegistry.register(myParser)`
3. The rest of the pipeline requires no changes

### Adding a new TypeNormalizer

1. Implement `TypeNormalizer` for the new dialect
2. Register: `typeNormalizerRegistry.register(myNormalizer)`

### Adding a custom validation rule

```typescript
const myRule: ValidationRule = {
  id: 'my-org-no-varchar-max',
  name: 'No unbounded VARCHAR',
  description: 'All string fields must have an explicit max length',
  severity: 'warning',
  scope: 'field',
  code: 'MY-001',
  evaluate(schema: CanonicalSchema): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const entity of schema.entities) {
      for (const field of entity.fields) {
        if (field.type.kind === 'string' && !field.type.length) {
          issues.push({
            code: 'MY-001',
            severity: 'warning',
            ruleId: 'my-org-no-varchar-max',
            message: `Field ${entity.name}.${field.name} has no length limit`,
            entityName: entity.name,
            fieldName: field.name,
          });
        }
      }
    }
    return issues;
  },
};
schemaValidator.addRule(myRule);
```

### Adding an ERP pattern

```typescript
erpRegistry.registerPattern({
  id: 'my-erp-001' as PatternId,
  vendor: 'Acme ERP',
  product: 'Core Finance',
  module: 'Accounts Payable',
  description: 'Acme AP module standard table set',
  entityPatterns: [
    { name: 'AP_VENDOR', typicalFields: [{ name: 'VENDOR_ID', isCommon: true }, ...] },
    { name: 'AP_INVOICE', typicalFields: [{ name: 'INVOICE_NUM', isCommon: true }, ...] },
  ],
});
```

---

## Importing

**Root import (convenience):**

```typescript
import type {
  CanonicalSchema,
  SIEResult,
  SchemaComparator,
  BreakingChange,
} from '@seltriva/schema-intelligence';
```

**Sub-path import (tree-shaking):**

```typescript
import type { CanonicalSchema } from '@seltriva/schema-intelligence/canonical';
import type { SchemaParser } from '@seltriva/schema-intelligence/parser';
import type { SchemaDiff } from '@seltriva/schema-intelligence/comparator';
import type { LearnedPattern } from '@seltriva/schema-intelligence/learning';
```

Available sub-paths: `models`, `core`, `canonical`, `parser`, `normalizer`, `comparator`, `detector`, `versioning`, `registry`, `fingerprint`, `similarity`, `learning`, `adapters`, `transformers`, `validators`.

---

## Package Info

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Package      | `@seltriva/schema-intelligence`                                        |
| Version      | `0.1.0`                                                                |
| Runtime      | Node.js 18+, browser-compatible (no Node.js built-ins)                 |
| TypeScript   | `strict: true`, `moduleResolution: "bundler"`, `isolatedModules: true` |
| Dependencies | `@seltriva/core`, `@seltriva/types`                                    |
| Side effects | None                                                                   |
