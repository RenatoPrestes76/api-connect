# @seltriva/semantic-engine

Universal Semantic Mapping Engine (USME) — maps data structures to canonical business language.

## What it does

The USME understands the **business meaning** of data. Given a table named `B1_SB1` with columns `CODPROD`, `DESCRPROD`, `VLR_CUSTO`, `VLR_VENDA`, it determines:

- `B1_SB1` → `ENTITY_PRODUCT`
- `CODPROD` → `FIELD_PRODUCT_CODE` (100% confidence)
- `DESCRPROD` → `FIELD_PRODUCT_NAME` (98% confidence)
- `VLR_CUSTO` → `FIELD_COST_PRICE` (97% confidence)
- `VLR_VENDA` → `FIELD_SALE_PRICE` (99% confidence)

This works across any ERP, database, or connector — because the output is always in the **Canonical Business Language (CBL)**, not in the source system's terms.

## What it does NOT do

- Execute queries or read business data
- Design UI or expose API endpoints
- Store anything in a database
- Make autonomous decisions — all mappings go through human validation

---

## Architecture

```
Input (entity + field names from CanonicalSchema)
         │
         ▼
  ┌─────────────────┐
  │ SemanticAnalyzer│  ← NameAnalyzer + StructureAnalyzer
  │                 │    RelationshipAnalyzer + ContextAnalyzer
  └────────┬────────┘
           │ Candidates + Signals
           ▼
  ┌─────────────────┐
  │ConfidenceEngine │  ← Aggregates signals into 0–1 score
  └────────┬────────┘
           │ Scored candidates
           ▼
  ┌─────────────────┐
  │SuggestionSystem │  ← Packages suggestions for review
  └────────┬────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
  Auto-       Validation
  Approved     Queue
  (≥97%)    (< 97%)
    │             │
    │         Admin decision
    │           │   │
    │        Confirm Reject
    └──────┬──┘
           │
           ▼
   ┌──────────────┐
   │ LearningEngine│  ← Extracts patterns from confirmed mappings
   └──────┬───────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
  Registry   ERP Profile
  (global)   (per-ERP)
```

---

## Module Reference

### `business-language/`

The Canonical Business Language (CBL) — the universal business vocabulary.

**Entity Kinds** (62 total, grouped by domain):

| Domain      | Examples                                                             |
| ----------- | -------------------------------------------------------------------- |
| catalog     | `PRODUCT`, `PRODUCT_VARIANT`, `CATEGORY`, `BRAND`, `UNIT_OF_MEASURE` |
| commerce    | `ORDER`, `ORDER_LINE`, `QUOTE`, `PRICE_LIST`, `DISCOUNT`             |
| procurement | `SUPPLIER`, `PURCHASE_ORDER`, `RECEIPT`                              |
| crm         | `CUSTOMER`, `CUSTOMER_ADDRESS`, `CONTACT`                            |
| inventory   | `INVENTORY`, `INVENTORY_MOVEMENT`, `WAREHOUSE`, `STOCK_TRANSFER`     |
| finance     | `INVOICE`, `PAYMENT`, `ACCOUNT`, `COST_CENTER`, `CURRENCY`           |
| fiscal      | `TAX_CODE`, `INVOICE_TAX`, `FISCAL_CLASSIFICATION`                   |
| hr          | `EMPLOYEE`, `DEPARTMENT`, `EMPLOYEE_ROLE`                            |
| logistics   | `ADDRESS`, `CARRIER`, `DELIVERY`, `SHIPMENT`                         |
| audit       | `AUDIT_LOG`                                                          |

**Field Kinds** (110+ total):

| Category   | Examples                                                           |
| ---------- | ------------------------------------------------------------------ |
| Identity   | `CODE`, `EXTERNAL_CODE`, `PRODUCT_CODE`, `BARCODE`, `SKU`, `NCM`   |
| Pricing    | `COST_PRICE`, `SALE_PRICE`, `MINIMUM_PRICE`, `MARGIN`, `MARKUP`    |
| Quantity   | `QUANTITY`, `STOCK_BALANCE`, `REORDER_POINT`, `AVAILABLE_QUANTITY` |
| Dates      | `EXPIRATION_DATE`, `ISSUE_DATE`, `DUE_DATE`, `DELIVERY_DATE`       |
| Audit      | `CREATED_AT`, `UPDATED_AT`, `DELETED_AT`, `CREATED_BY`             |
| Status     | `STATUS`, `IS_ACTIVE`, `IS_DELETED`, `IS_SERVICE`                  |
| Address    | `ADDRESS_STREET`, `ADDRESS_CITY`, `ADDRESS_POSTAL_CODE`            |
| Tax        | `TAX_ID`, `COMPANY_REGISTRATION`, `TAX_RATE`, `CFOP`               |
| References | `SUPPLIER`, `CUSTOMER`, `CATEGORY`, `BRANCH`, `WAREHOUSE`          |

**Term construction:**

```typescript
import { cblEntityTerm, cblFieldTerm } from '@seltriva/semantic-engine/business-language';

cblEntityTerm('PRODUCT'); // → 'ENTITY_PRODUCT'
cblFieldTerm('COST_PRICE'); // → 'FIELD_COST_PRICE'
```

---

### `canonical-model/`

The output of the USME — a `CanonicalBusinessModel` (CBM). Every entity and field in the CBM carries its CBL term and a confidence score.

```typescript
interface CanonicalBusinessModel {
  entities: CBMEntity[]; // each entity has cblTerm + confidence + status
  relationships: CBMRelationship[];
  statistics: CBMStatistics; // % mapped, average confidence
}
```

`MappingStatus` values:

- `confirmed` — human-validated
- `auto-approved` — confidence ≥ threshold
- `pending-validation` — queued for review
- `rejected` — explicitly rejected
- `unmapped` — no candidate met minimum threshold

---

### `confidence-engine/`

Scores every semantic suggestion from 0 to 1.

**Confidence tiers:**

| Tier           | Range     | Behavior                          |
| -------------- | --------- | --------------------------------- |
| `certain`      | 0.97–1.00 | Auto-approved                     |
| `very-high`    | 0.90–0.96 | Suggested with high priority      |
| `high`         | 0.80–0.89 | Suggested                         |
| `medium`       | 0.65–0.79 | Suggested                         |
| `low`          | 0.45–0.64 | Shown with warning                |
| `very-low`     | 0.20–0.44 | Shown only if no better candidate |
| `insufficient` | < 0.20    | Suppressed                        |

**Default signal weights:**

| Signal                         | Weight |
| ------------------------------ | ------ |
| Name similarity to CBL aliases | 30%    |
| Alias exact match              | 20%    |
| Field type compatibility       | 10%    |
| Semantic role match            | 10%    |
| Structural pattern match       | 10%    |
| ERP profile match              | 8%     |
| Learning history               | 5%     |
| Knowledge graph coherence      | 4%     |
| Position context               | 2%     |
| Synonym match                  | 1%     |

---

### `semantic-analyzer/`

Four analysis strategies compose to produce candidates:

**NameAnalyzer** — analyzes the raw name:

- Strips ERP-specific prefixes/suffixes (`B1_`, `ZE_`, `T_`, etc.)
- Expands abbreviations: `COD` → `code`, `DESCR` → `description`
- Handles multilingual names: Portuguese `FORNECEDOR` → `SUPPLIER`, Spanish `PROVEEDOR` → `SUPPLIER`
- Detects naming conventions: `snake_case`, `PascalCase`, `SCREAMING_SNAKE`

**StructureAnalyzer** — analyzes the entity's field set:

- "Has fields CODPROD + DESCRPROD + VLR_CUSTO + VLR_VENDA" → ENTITY_PRODUCT structural signature

**RelationshipAnalyzer** — analyzes FK targets:

- "Has FK to ENTITY_PRODUCT + FK to ENTITY_WAREHOUSE" → suggests ENTITY_INVENTORY

**ContextAnalyzer** — analyzes neighboring entities:

- "Other entities in this schema are commerce/inventory" → boosts commerce/inventory candidates

---

### `knowledge-graph/`

Encodes what the USME knows about business concept relationships.

Examples:

```
ENTITY_PRODUCT
  ├── HAS_CATEGORY → ENTITY_CATEGORY (1:N, optional)
  ├── HAS_SUPPLIER → ENTITY_SUPPLIER (N:1, optional)
  ├── HAS_BRAND → ENTITY_BRAND (N:1, optional)
  └── HAS_INVENTORY → ENTITY_INVENTORY (1:N, optional)

ENTITY_ORDER
  ├── ORDERED_BY_CUSTOMER → ENTITY_CUSTOMER (N:1, mandatory)
  ├── ISSUED_BY_BRANCH → ENTITY_BRANCH (N:1, optional)
  └── BELONGS_TO_ORDER ← ENTITY_ORDER_LINE (1:N, optional)
```

Used by the confidence engine to score **coherence**: if an entity is mapped to `ENTITY_PRODUCT`, the graph expects certain field kinds and FK relationships. Missing expected fields lower coherence; unexpected FK targets flag possible misclassification.

---

### `dictionary/`

Authoritative human-readable definitions for every CBL concept. Shown to administrators during the validation workflow.

Each `FieldDefinition` contains:

| Field              | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `name`             | Human name: "Cost Price"                                                  |
| `description`      | Plain-language definition                                                 |
| `aliases`          | Column names this is known by: `VLR_CUSTO`, `PRECOCUSTO`, `COSTO`, `COST` |
| `examples`         | ERP-specific examples with sample values                                  |
| `typicalTypes`     | `decimal`, `numeric(15,4)`                                                |
| `businessRules`    | e.g., "Must be > 0 for active products"                                   |
| `relatedFields`    | `SALE_PRICE`, `MARGIN`, `MARKUP`                                          |
| `commonInEntities` | `PRODUCT`, `PRODUCT_VARIANT`, `PRICE_LIST_ITEM`                           |

---

### `confidence-engine/` — auto-approval

The `autoApprove` threshold (default: 0.97) determines when a mapping is confirmed without human review. This threshold is configurable per session:

```typescript
engine.beginSession({
  options: {
    autoApproveThreshold: 0.95, // lower = more auto-approvals
  },
});
```

Even auto-approved mappings are tracked in the registry and can be revoked.

---

### `validation/`

The human review workflow. **Nothing is learned until a human confirms it.**

Lifecycle:

1. `SuggestionEngine.generateEntityBundle()` → `SuggestionBundle`
2. `ValidationWorkflow.submit(bundle)` → `ValidationRequest` (queued)
3. Administrator reviews via the application layer
4. `ValidationWorkflow.decide(requestId, { action: 'confirm', reviewer: 'admin@company.com' })`
5. `LearningEngine.learn(mapping)` is triggered automatically

Administrators can also:

- `decide(..., { action: 'modify', correctedTerm: 'FIELD_COST_PRICE' })` — fix the proposed term
- `decide(..., { action: 'reject', feedback: { reason: 'wrong-concept' } })` — reject with feedback
- `confirmAllAboveThreshold(bundleId, 0.85, 'admin@company.com')` — bulk approve high-confidence suggestions

---

### `learning/`

Extracts learnable patterns from every confirmed mapping. **Never processes business data.**

Pattern types learned:

| Pattern                  | Example                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `exact-name-match`       | `CODPROD` → `FIELD_PRODUCT_CODE` (exact)                             |
| `name-prefix-match`      | Columns starting with `VLR_` in SAP B1 → pricing fields              |
| `abbreviation-expansion` | `COD` → `code`, `DESCR` → `description`                              |
| `multilingual-synonym`   | Portuguese `FORNECEDOR` → `SUPPLIER`                                 |
| `structural-signature`   | Entity with `CODPROD + DESCRPROD + VLR_CUSTO` → PRODUCT              |
| `erp-convention`         | In SAP B1, `B1_` prefix is stripped before analysis                  |
| `field-cooccurrence`     | `FIELD_COST_PRICE` and `FIELD_SALE_PRICE` co-occur in ENTITY_PRODUCT |

---

### `profiles/`

ERP-specific semantic knowledge accumulated over time.

**Built-in profile IDs:**

```
erp-sap-ecc           erp-sap-s4hana         erp-sap-b1
erp-totvs-protheus    erp-totvs-rm
erp-oracle-ebs        erp-oracle-fusion
erp-ms-dynamics-365   erp-ms-dynamics-nav
erp-netsuite          erp-sage-x3
erp-linx              erp-senior             erp-omie   erp-bling
```

When a schema is identified as SAP B1, the confidence engine boosts scores for known SAP B1 mappings to near-certainty.

---

### `rules/`

Business rule constraints on semantic mappings.

Built-in rule examples:

| Rule                              | Description                                                              |
| --------------------------------- | ------------------------------------------------------------------------ |
| `rule-product-requires-code`      | `ENTITY_PRODUCT` must have `FIELD_PRODUCT_CODE`                          |
| `rule-price-numeric`              | `FIELD_COST_PRICE` / `FIELD_SALE_PRICE` must have numeric type           |
| `rule-cost-sale-price-coexist`    | If entity has `FIELD_COST_PRICE`, it should also have `FIELD_SALE_PRICE` |
| `rule-expiration-product-context` | `FIELD_EXPIRATION_DATE` only makes sense in PRODUCT/INVENTORY context    |
| `rule-no-dual-entity-mapping`     | An entity cannot simultaneously be two different CBL entity kinds        |

---

### `registry/`

The single source of truth for all confirmed mappings. Append-only with revocation support.

Lookups:

```typescript
await registry.resolveEntity('B1_SB1');
// → { term: 'ENTITY_PRODUCT', confidence: 0.99, confirmedAt: ... }

await registry.resolveField('CODPROD', 'B1_SB1');
// → { term: 'FIELD_PRODUCT_CODE', confidence: 1.0, confirmedAt: ... }

await registry.reverseFieldLookup('FIELD_COST_PRICE');
// → ['VLR_CUSTO', 'PRECO_CUSTO', 'COST', 'COSTO', 'PRECOCUSTO']
```

---

## Importing

**Root import (convenience):**

```typescript
import type {
  CBLEntityKind,
  SemanticMapping,
  CanonicalBusinessModel,
  SuggestionBundle,
} from '@seltriva/semantic-engine';
```

**Sub-path import (tree-shaking):**

```typescript
import type { CBLEntityKind } from '@seltriva/semantic-engine/business-language';
import type { ConfidenceEngine } from '@seltriva/semantic-engine/confidence-engine';
import type { SemanticAnalyzer } from '@seltriva/semantic-engine/semantic-analyzer';
import type { ValidationWorkflow } from '@seltriva/semantic-engine/validation';
import type { SemanticLearner } from '@seltriva/semantic-engine/learning';
```

Available sub-paths: `business-language`, `canonical-model`, `semantic-analyzer`, `mapping-engine`, `knowledge-graph`, `confidence-engine`, `learning`, `validation`, `dictionary`, `profiles`, `registry`, `rules`, `suggestions`.

---

## Extension Guide

### Adding a custom CBL term

```typescript
import { CBLRegistry, CBLConcept } from '@seltriva/semantic-engine/business-language';

const myConcept: CBLConcept = {
  term: 'ENTITY_FISCAL_DOCUMENT' as CBLTerm,
  kind: 'entity',
  domain: 'fiscal',
  aliases: ['nota_fiscal', 'nf', 'nota', 'tax_document'],
  description: 'Brazilian fiscal document (Nota Fiscal)',
  isBuiltIn: false,
};

cblRegistry.register(myConcept);
```

### Adding a custom confidence signal

```typescript
const mySignal: ConfidenceSignalProvider = {
  id: 'my-org-signal',
  name: 'My Org Naming Convention',
  defaultWeight: 0.15,
  evaluate(input) {
    const isMatch = input.sourceName.startsWith('MY_');
    return { providerId: 'my-org-signal', value: isMatch ? 0.9 : 0.0, detail: '...' };
  },
};
confidenceEngine.registerSignal(mySignal);
```

### Adding a custom business rule

```typescript
const myRule: BusinessRule = {
  id: 'my-rule-001',
  name: 'Product requires barcode',
  severity: 'warning',
  scope: 'entity',
  appliesTo: { entityKinds: ['PRODUCT'] },
  evaluate(ctx) {
    const hasBarcode = ctx.entity?.fields.some((f) => f.fieldKind === 'BARCODE');
    if (!hasBarcode) {
      return [
        {
          ruleId: 'my-rule-001',
          severity: 'warning',
          message: 'ENTITY_PRODUCT should have FIELD_BARCODE',
        },
      ];
    }
    return [];
  },
};
ruleEngine.register(myRule);
```

---

## Package Info

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Package      | `@seltriva/semantic-engine`                                          |
| Version      | `0.1.0`                                                              |
| Runtime      | Node.js 18+, browser-compatible                                      |
| TypeScript   | `strict: true`, `moduleResolution: "bundler"`                        |
| Dependencies | `@seltriva/core`, `@seltriva/types`, `@seltriva/schema-intelligence` |
| Side effects | None                                                                 |
