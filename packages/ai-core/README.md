# @seltriva/ai-core — ATHENA

Enterprise AI Core for Seltriva Connect. An AI Decision Platform specialized in enterprise integrations.

## What it does

ATHENA is the intelligence layer of Seltriva Connect. It answers questions like:

- "This table is named `B1_SB1` with columns `CODPROD`, `DESCRPROD`, `VLR_CUSTO` — is this SAP B1? Which entity is it?"
- "These two schemas have field `VALOR_UNIT` → `unit_price` — should this be a direct copy or does it need a transformation?"
- "This sync has been running for 40 minutes on 50,000 records — what's wrong?"
- "Field `CPF` in an order entity — what sensitivity level? Does it need masking?"

## What it does NOT do

- Execute queries or sync operations
- Store business data or personal data
- Make autonomous decisions — every recommendation goes through the Decision Engine
- Expose a UI or API

---

## Architecture

```
External Input (schema, mapping, sync telemetry)
         │
         ▼
  ┌──────────────────┐
  │  ContextBuilder  │  ← Assembles token-efficient AI context
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐    ┌─────────────────────┐
  │  Specialist Agent │◄──│   PromptRegistry    │  versioned prompts
  │  (one of 8)       │   └─────────────────────┘
  └────────┬──────────┘
           │
           ▼
  ┌──────────────────┐    ┌─────────────────────┐
  │   AI Provider    │◄──│  ProviderRegistry    │  OpenAI/Claude/Gemini/…
  └────────┬─────────┘   └─────────────────────┘
           │ raw response
           ▼
  ┌──────────────────┐    ┌─────────────────────┐
  │  ReasoningEngine │    │  ExplainabilityEngine│
  └────────┬─────────┘    └──────────┬───────────┘
           └──────────────┬──────────┘
                          │ AIRecommendation (with explanation)
                          ▼
                 ┌────────────────┐
                 │ DecisionEngine │  ← AI never executes; engine validates
                 └───────┬────────┘
                         │
              ┌──────────┴───────────┐
              │                      │
              ▼                      ▼
        Auto-Approved          Pending Review
        (≥ threshold)         (human required)
              │                      │
              │               Human Decision
              │                │         │
              │             Approve    Reject
              └──────┬───────┘
                     │ confirmed DecisionRecord
                     ▼
              ┌──────────────┐
              │  Learning    │  ← Learns from confirmations
              │  Engine      │
              └──────┬───────┘
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
            Memory      Feedback
           (patterns)   (signals)
```

---

## Modules

### `providers/`

AI provider abstraction. Register any LLM backend without changing business logic.

**Supported providers:**

| Provider     | ID                       | Models                                                     |
| ------------ | ------------------------ | ---------------------------------------------------------- |
| OpenAI       | `provider-openai`        | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`                     |
| Anthropic    | `provider-anthropic`     | `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| Google       | `provider-google-gemini` | `gemini-2.0-flash`, `gemini-1.5-pro`                       |
| Azure OpenAI | `provider-azure-openai`  | OpenAI models via Azure                                    |
| DeepSeek     | `provider-deepseek`      | `deepseek-r1`, `deepseek-chat`                             |
| Mistral      | `provider-mistral`       | `mistral-large-latest`                                     |
| Llama        | `provider-llama`         | `llama-3.1-70b-instruct`                                   |
| Local        | `provider-local`         | Ollama, LM Studio, llama.cpp                               |

New providers implement `AIProvider` and register with `AIProviderRegistry`.

---

### `agents/`

**8 Specialist Agents** — each is a stateless plugin implementing `AIAgent`.

| Agent               | ID                          | Specialization                              |
| ------------------- | --------------------------- | ------------------------------------------- |
| Schema Analyst      | `agent-schema-analyst`      | Entity/field CBL classification             |
| Mapping Analyst     | `agent-mapping-analyst`     | Field mapping conflicts and transformations |
| ERP Specialist      | `agent-erp-specialist`      | ERP system/module identification            |
| Performance Analyst | `agent-performance-analyst` | Bottlenecks, optimization                   |
| Sync Analyst        | `agent-sync-analyst`        | Sync strategy, conflict resolution          |
| Security Analyst    | `agent-security-analyst`    | Data sensitivity, risk assessment           |
| Change Analyst      | `agent-change-analyst`      | Schema change impact, migration             |
| Validation Analyst  | `agent-validation-analyst`  | Validation rules, anomaly detection         |

Agents are orchestrated by `AIAgentOrchestrator` — run single, parallel, or pipeline.

---

### `decision-engine/`

**The boundary between AI and execution.**

```
Recommendation → DecisionEngine.evaluate()
  ├── if confidence ≥ 0.92 AND no blocking rules → auto-approved
  ├── if confidence ≥ 0.55 → pending-review (human required)
  └── if confidence < 0.20 → blocked
```

**Built-in decision rules:**

| Rule                               | Effect                                            |
| ---------------------------------- | ------------------------------------------------- |
| `rule-require-review-destructive`  | Remove-entity/remove-field always requires review |
| `rule-min-confidence`              | Block if confidence below 0.20                    |
| `rule-require-reasoning-confirmed` | Confirmed mapping changes need reasoning chain    |
| `rule-require-review-security`     | Security reclassification always requires review  |
| `rule-reject-expired`              | Block expired recommendations                     |

No action is taken without a signed `DecisionRecord`.

---

### `prompt-registry/`

All prompts are independent versioned modules — never hardcoded in business logic.

**21 built-in prompt IDs** across schema, mapping, ERP, sync, security, validation, and performance domains.

```typescript
// Get and render a prompt
const rendered = await promptRegistry.render(PROMPT_IDS.SCHEMA_ENTITY_CLASSIFICATION, {
  entityName: 'B1_SB1',
  fieldNames: ['CODPROD', 'DESCRPROD', 'VLR_CUSTO', 'VLR_VENDA'],
  erpContext: 'SAP B1',
});
```

Prompts can be loaded from files, directories, or remote sources.

---

### `reasoning/`

Structured chain-of-thought that makes AI decisions transparent and auditable.

**Strategies:** `chain-of-thought`, `tree-of-thought`, `decomposition`, `analogical`, `elimination`

Every `ReasoningChain` has typed steps: `observation → inference → hypothesis → evaluation → elimination → conclusion`. The `ReasoningEvaluator` detects circular reasoning and unsupported conclusions before recommendations are emitted.

---

### `explainability/`

Enforces that every recommendation is explainable.

Every `Explanation<T>` contains:

- `reason` — WHY was this recommended?
- `confidence` + `confidenceRationale` — HOW certain?
- `evidence[]` — WHAT data supports this?
- `alternatives[]` — WHAT else was considered and why it ranked lower?

Output formats: `brief` (1–2 sentences), `standard`, `detailed`, `technical`.
Target audiences: `administrator`, `integrator`, `developer`, `auditor`.

---

### `memory/`

Persistent knowledge store. **Never stores business data.**

| Memory Kind               | Example                                                |
| ------------------------- | ------------------------------------------------------ |
| `schema-structure`        | Entity "B1_SB1" has fields CODPROD, DESCRPROD          |
| `semantic-mapping`        | CODPROD → FIELD_PRODUCT_CODE (confirmed by admin)      |
| `erp-pattern`             | In SAP B1, prefix "B1\_" is stripped before analysis   |
| `performance-baseline`    | Avg sync duration for ENTITY_PRODUCT: 2,400ms          |
| `sync-pattern`            | ENTITY_INVOICE: incremental strategy, 2% conflict rate |
| `security-classification` | FIELD_TAX_ID → restricted, LGPD applicable             |

Memory is reinforced by confirmations, contradicted by corrections, and consolidated periodically.

---

### `learning/`

Learns from every confirmed decision. **Never reads business data values.**

**9 pattern types:**

| Pattern                  | Example                                                 |
| ------------------------ | ------------------------------------------------------- |
| `naming-convention`      | SAP B1 uses `B1_` prefix                                |
| `structural-signature`   | CODPROD + DESCRPROD + VLR_CUSTO = ENTITY_PRODUCT        |
| `type-heuristic`         | `NUMERIC(15,4)` → pricing field                         |
| `erp-prefix-stripping`   | Strip `B1_` before CBL matching                         |
| `abbreviation-expansion` | `COD` → `code`, `DESCR` → `description`                 |
| `multilingual-synonym`   | Portuguese `FORNECEDOR` → SUPPLIER                      |
| `confidence-calibration` | Schema Analyst overestimates SAP B1 by 5%               |
| `conflict-resolution`    | Concurrent-update in ENTITY_ORDER → latest-timestamp    |
| `rejection-pattern`      | "B1_ZXX" pattern consistently rejected as system tables |

---

### `feedback/`

Captures human signals (approve/reject/modify) and feeds them to the learning engine.

Feedback kinds: `positive`, `negative`, `corrective`, `implicit`  
Correction types: `wrong-cbl-term`, `wrong-entity-kind`, `wrong-erp-identification`, `wrong-sync-strategy`, etc.

---

### `validation/`

Two roles:

1. **AI output validation** — ensures every recommendation has explanation, evidence, alternatives, calibrated confidence before it leaves ATHENA.
2. **AI-assisted integration validation** — detects anomalies and suggests validation rules (powered by `ValidationAnalystAgent`).

**Detected anomaly kinds:** `missing-primary-key`, `duplicate-field-role`, `missing-audit-fields`, `suspicious-nullable`, `orphaned-foreign-key`, etc.

---

### `security/`

Data sensitivity classification by structural metadata — never reads values.

**Sensitivity levels:** `public` → `internal` → `confidential` → `restricted` → `critical`

**Regulatory frameworks:** `LGPD`, `GDPR`, `CCPA`, `PCI-DSS`, `HIPAA`, `SOX`, `BACEN`

Pre-classified sensitive CBL field kinds:

```
FIELD_TAX_ID        → restricted
FIELD_BANK_ACCOUNT  → critical
FIELD_CREDIT_CARD   → critical
FIELD_EMAIL         → confidential
FIELD_COST_PRICE    → confidential
FIELD_MARGIN        → confidential
FIELD_SALARY        → restricted
```

---

### `performance/`

Two roles:

1. **ATHENA's own performance** — latency, token usage, cost per agent, SLO compliance.
2. **Integration performance analysis** — the `PerformanceAnalystAgent` uses `IntegrationPerformanceAnalyst` to detect bottlenecks in sync configuration.

Default SLOs: p95 latency < 15s, success rate ≥ 98%, auto-approval rate ≥ 70%.

---

### `erp-recognition/`

Identifies ERP systems from schema metadata.

**Signals used:** entity-name-pattern, field-name-pattern, prefix/suffix-pattern, structural-signature, module-indicator, version-indicator.

Recognition results include: primary candidate, alternatives ranked by confidence, identifying signals, and module identification.

---

### `schema-analysis/`

Full pipeline from raw schema to CBL-labeled recommendations:

```
SchemaAnalysisInput → analyze each entity → classify each field
                   → detect anomalies → assess changes
                   → produce SchemaAnalysisReport + AIRecommendation[]
```

---

### `mapping-analysis/`

AI-powered field mapping with conflict resolution:

- **Match types:** `exact-term`, `compatible-term`, `name-similarity`, `type-match`, `structural-match`, `fuzzy`
- **Conflict kinds:** `multiple-candidates`, `type-mismatch`, `semantic-mismatch`, `precision-loss`, `nullability-conflict`
- **Transformation kinds:** `type-cast`, `format-conversion`, `unit-conversion`, `enum-mapping`, `date-format`, `decimal-scale`, `conditional`, `lookup`

---

### `sync-analysis/`

Sync strategy recommendation and conflict resolution:

- **Strategies:** `full-sync`, `incremental`, `delta`, `event-driven`, `scheduled-batch`, `real-time-stream`
- **Conflict types:** `concurrent-update`, `delete-update`, `orphaned-reference`, `duplicate-insert`, `type-conversion-fail`
- **Risk kinds:** `data-loss`, `data-duplication`, `infinite-loop`, `race-condition`, `cascade-delete`

---

## Importing

**Root import:**

```typescript
import type { AIRecommendation, DecisionRecord, AIAgent, AIProvider } from '@seltriva/ai-core';
```

**Sub-path import (tree-shaking):**

```typescript
import type { AIProvider } from '@seltriva/ai-core/providers';
import type { AIAgent } from '@seltriva/ai-core/agents';
import type { DecisionEngine } from '@seltriva/ai-core/decision-engine';
import type { PromptRegistry } from '@seltriva/ai-core/prompt-registry';
import type { AIMemory } from '@seltriva/ai-core/memory';
import type { AILearningEngine } from '@seltriva/ai-core/learning';
import type { SchemaAnalysisEngine } from '@seltriva/ai-core/schema-analysis';
```

Available sub-paths: `providers`, `agents`, `decision-engine`, `context-builder`, `memory`, `learning`, `prompt-registry`, `feedback`, `reasoning`, `explainability`, `recommendations`, `validation`, `security`, `performance`, `erp-recognition`, `schema-analysis`, `mapping-analysis`, `sync-analysis`.

---

## Extension Guide

### Registering a new AI provider

```typescript
const myProvider: AIProvider = {
  id: 'provider-my-llm' as AIProviderId,
  name: 'My LLM',
  model: 'my-model-v1' as AIModelId,
  capabilities: { supportsStreaming: true, supportsEmbeddings: false, ... },
  async complete(request) { /* call my LLM SDK */ },
  stream(request) { /* return AsyncIterable<CompletionChunk> */ },
  async embed(text) { return { success: false, error: { code: 'PROVIDER_UNAVAILABLE', ... } } },
  countTokens(text) { return Math.ceil(text.length / 4) },
  async isAvailable() { return true },
  estimateCost(request) { return { estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalCostUsd: 0, pricingModel: 'free' } },
};
providerRegistry.register(myProvider);
```

### Registering a custom agent

```typescript
const myAgent: AIAgent = {
  id: 'agent-custom-001' as AgentId,
  name: 'Custom Domain Expert',
  specialization: 'schema-analysis',
  description: 'Specialized for our industry domain',
  supportedTaskTypes: ['schema-analysis'],
  capabilities: { supportsStreaming: false, ... },
  async analyze(context, session) { /* ... */ },
  canHandle(taskType) { return taskType === 'schema-analysis' },
  estimateConfidence(context) { return 0.75 },
  async isHealthy() { return true },
};
agentRegistry.register(myAgent);
```

### Adding a custom decision rule

```typescript
const myRule: DecisionRule = {
  id: 'my-rule-no-fiscal-auto',
  name: 'Fiscal fields always require review',
  description: 'LGPD compliance: fiscal field changes need human sign-off',
  priority: 100,
  evaluate(recommendation) {
    const isFiscal =
      recommendation.payload?.fieldKind?.toString().includes('TAX') ||
      recommendation.payload?.fieldKind?.toString().includes('FISCAL');
    if (isFiscal) {
      return {
        applies: true,
        action: 'require-review',
        reason: 'Fiscal field — LGPD compliance',
        overridesConfidence: true,
      };
    }
    return { applies: false, action: 'allow' };
  },
};
decisionEngine.registerRule(myRule);
```

### Versioning a prompt

```typescript
const v2: PromptTemplate = {
  id: PROMPT_IDS.SCHEMA_ENTITY_CLASSIFICATION,
  name: 'Entity Classification',
  version: '2.0.0',
  changeLog: 'Added Portuguese business term examples',
  // ...
};
promptRegistry.registerVersion(PROMPT_IDS.SCHEMA_ENTITY_CLASSIFICATION, v2);
promptRegistry.setActive(PROMPT_IDS.SCHEMA_ENTITY_CLASSIFICATION, '2.0.0');
```

---

## Package Info

| Field        | Value                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Package      | `@seltriva/ai-core`                                                                               |
| Version      | `0.1.0`                                                                                           |
| Runtime      | Node.js 18+, browser-compatible                                                                   |
| TypeScript   | `strict: true`, `moduleResolution: "bundler"`                                                     |
| Dependencies | `@seltriva/core`, `@seltriva/types`, `@seltriva/schema-intelligence`, `@seltriva/semantic-engine` |
| Side effects | None                                                                                              |
| Architecture | Hexagonal, DDD, Plugin, DI, Provider Pattern                                                      |
