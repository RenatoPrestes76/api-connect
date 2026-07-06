# Developer Handbook — Atlas Forge

Complete reference for building enterprise plugins on Seltriva Connect.

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Getting Started](#2-getting-started)
3. [Plugin Types](#3-plugin-types)
4. [Plugin Manifest Spec](#4-plugin-manifest-spec)
5. [Plugin Context API](#5-plugin-context-api)
6. [Security Model](#6-security-model)
7. [Testing Strategy](#7-testing-strategy)
8. [Build and Packaging](#8-build-and-packaging)
9. [Performance Guidelines](#9-performance-guidelines)
10. [Migration and Versioning](#10-migration-and-versioning)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Platform Overview

```
Developer                 Atlas Forge              Seltriva Connect
   │                          │                          │
   │ atlas create             │                          │
   │─────────────────────────►│                          │
   │ atlas build + test        │                          │
   │─────────────────────────►│                          │
   │ atlas package --sign      │                          │
   │─────────────────────────►│                          │
   │ atlas publish             │                          │
   │──────────────────────────────────────────────────►  │
   │                          │      Review + approve     │
   │                          │◄──────────────────────── │
   │                          │      Plugin available     │
   │                          │      in Marketplace       │
   │                                                      │
Enterprise Customer ──────── installs plugin ──────────►  │
                                                          │
                     Agent loads and runs plugin ─────────┤
```

## 2. Getting Started

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0
- An Atlas Cloud account (free tier available)

### First Plugin in 5 Minutes

```bash
npm install -g @seltriva/cli
atlas login
atlas create hello-connector --type connector --yes
cd hello-connector
atlas build
atlas test
```

---

## 3. Plugin Types

### Connector (type: `connector`)

Establishes connections to data sources (databases, APIs, file systems).
Never writes to customer data — read-only invariant enforced by platform.

**Required:** `IConnectorPlugin`
**Use when:** Connecting to a new database engine, SaaS API, or data protocol

### ERP Profile (type: `erp-profile`)

Describes an ERP system's structure, authentication flow, modules, and entity mappings.
Enables the platform to integrate with any ERP without business-logic code.

**Required:** `IERPProfilePlugin`
**Use when:** Adding support for a new ERP, CRM, HRIS, or WMS system

### AI Provider (type: `ai-provider`)

Plugs a new LLM or AI service into the platform's inference layer.

**Required:** `IAIProviderPlugin`
**Use when:** Connecting OpenAI alternatives, private models, Azure OpenAI, etc.

### Notification (type: `notification`)

Delivers notifications through a new channel (Slack, Teams, PagerDuty, SMS, etc.)

**Required:** `INotificationPlugin`
**Use when:** Adding a new notification delivery channel

### Storage (type: `storage`)

Provides blob/object storage through a new backend.

**Required:** `IStoragePlugin`
**Use when:** Using Google Cloud Storage, Azure Blob, MinIO, or custom backends

### Transformation (type: `transformation`)

Applies deterministic transformations to records (format conversion, enrichment, cleaning).

**Required:** `ITransformationPlugin`
**Use when:** Custom data transformation logic, enrichment pipelines

### Validator (type: `validator`)

Validates records against business rules before sync or export.

**Required:** `IValidatorPlugin`
**Use when:** Custom data quality rules, cross-field validation

### Sync Strategy (type: `sync-strategy`)

Defines how data is synchronized (full, incremental, CDC, event-driven).

**Required:** `ISyncStrategyPlugin`
**Use when:** Implementing a non-standard sync algorithm or optimization

### Mapping Strategy (type: `mapping-strategy`)

Maps fields between source and target schemas intelligently.

**Required:** `IMappingStrategyPlugin`
**Use when:** Fuzzy mapping, AI-assisted mapping, domain-specific mapping logic

### Security Provider (type: `security-provider`)

Integrates a new identity provider or security system.

**Required:** `ISecurityProviderPlugin`
**Use when:** Custom SSO, Okta, Auth0, Azure AD, SAML 2.0, custom PKI

### License Provider (type: `license-provider`)

Validates licenses for custom commercial plugins or integrations.

**Required:** `ILicenseProviderPlugin`
**Use when:** Building commercial plugins with custom licensing schemes

### Export Provider (type: `export-provider`)

Exports data to a specific format or destination.

**Required:** `IExportProviderPlugin`
**Use when:** Custom PDF reports, SAP IDoc, EDI, XLSX, domain-specific formats

---

## 4. Plugin Manifest Spec

See [Plugin Guide: Plugin Manifest](./plugin-guide.md#2-plugin-manifest-atlas-pluginjson) for the complete spec.

Key rules:
- `id` must be globally unique in reverse-domain format
- `version` is immutable after publish
- `capabilities` and `permissions` must be the minimum required
- `entryPoint` must point to an ESModule-compatible compiled JS file

---

## 5. Plugin Context API

The `PluginContext` is the complete API surface available to plugins.
Nothing outside this interface is accessible.

| API                         | Purpose                                   | Permission Required      |
|-----------------------------|-------------------------------------------|--------------------------|
| `context.logger`            | Structured logging (pino-compatible)      | None                     |
| `context.config.get(key)`   | Read plugin configuration                 | `read:config`            |
| `context.config.getRequired`| Read required config (throws if missing)  | `read:config`            |
| `context.credentials.get`   | Read stored credentials                   | `read:credentials`       |
| `context.credentials.set`   | Store credentials                         | `write:credentials`      |
| `context.http.get/post/...` | Sandboxed HTTP client                     | `network-outbound` cap   |
| `context.storage.get/set`   | Plugin-isolated key-value storage         | `storage-read/write` cap |
| `context.events.emit`       | Publish events to the platform            | None                     |
| `context.events.on`         | Subscribe to platform events              | None                     |
| `context.metrics.increment` | Record counter metrics                    | `write:metrics`          |
| `context.metrics.gauge`     | Record gauge metrics                      | `write:metrics`          |
| `context.metrics.timing`    | Record timing metrics                     | `write:metrics`          |

---

## 6. Security Model

### Minimum Privilege Principle

Declare only the capabilities and permissions your plugin actually uses.
The validator rejects any package where permissions exceed declared capabilities.

### No Direct I/O

Plugins cannot:
- Access the filesystem directly (only via `context.storage`)
- Open raw sockets (only via `context.http`)
- Spawn child processes (requires `process-spawn` capability — rarely approved)
- Access environment variables (only via `context.config` / `context.credentials`)

### Credential Storage

Always use `context.credentials` for sensitive values:
```typescript
// BAD — hardcoded secret in code
const apiKey = 'sk-1234567890abcdef';

// BAD — reading from env directly
const apiKey = process.env.API_KEY;

// GOOD — credentials store
const apiKey = await context.credentials.get('api-key');
```

### No Data Exfiltration

The platform monitors outbound HTTP calls made via `context.http`.
Any call to an unexpected endpoint triggers an alert.
Plugins that attempt to exfiltrate data are immediately suspended.

---

## 7. Testing Strategy

### Unit Tests (required for publish)

```typescript
import { createTestHarness, assertOk } from '@seltriva/testing';

describe('MyConnector', () => {
  let harness: IPluginTestHarness<MyConnector>;

  beforeEach(() => {
    harness = createTestHarness(new MyConnector(), {
      config: { host: 'localhost' },
    });
  });

  it('initializes without errors', async () => {
    const result = await harness.init();
    assertOk(result);
  });

  it('returns healthy status', async () => {
    await harness.init();
    const status = await harness.plugin.health();
    expect(status.status).toBe('healthy');
  });
});
```

### Integration Tests (recommended)

Run against a real (dev) instance of the connected system:
```typescript
// Only runs in CI with integration test secrets
it.skipIf(!process.env.DB_HOST)('connects to real database', async () => {
  const harness = createTestHarness(new MyConnector(), {
    config: { host: process.env.DB_HOST! },
    credentials: { 'db-password': process.env.DB_PASS! },
  });
  const result = await harness.init();
  assertOk(result);
});
```

---

## 8. Build and Packaging

### Build Requirements

- Target: `ES2022` minimum
- Format: `ESModule` (type: "module" in package.json)
- No CommonJS `require()` — use dynamic `import()` if needed
- All dependencies bundled (no `node_modules` in package)
- Exception: `@seltriva/plugin-sdk` is provided by the platform — mark as external

### Bundle Size Limits

| Threshold       | Action                                   |
|-----------------|------------------------------------------|
| > 5 MB          | Blocked — cannot publish                 |
| > 1 MB          | Warning — review necessity               |
| 100 KB–1 MB     | Acceptable for complex connectors        |
| < 100 KB        | Ideal for most plugin types              |

### Signing Keys

```bash
# Generate Ed25519 key pair (done automatically on first atlas publish)
# Or manually:
openssl genpkey -algorithm Ed25519 -out ~/.atlas/signing.key
openssl pkey -in ~/.atlas/signing.key -pubout -out ~/.atlas/signing.pub
```

---

## 9. Performance Guidelines

### Startup Time

- `init()` must complete in < 5 seconds
- `start()` must complete in < 5 seconds
- Use lazy initialization for expensive resources

### Memory

- Peak memory < 256 MB
- Release resources in `stop()` and `destroy()`
- Do not keep large in-memory caches

### Connection Management

```typescript
private pool?: ConnectionPool;

async init(ctx) {
  this.ctx = ctx;
  return { ok: true, value: undefined };
}

async start() {
  // Open connection pool here, not in init()
  this.pool = await createPool(this.ctx.config.getAll());
  return { ok: true, value: undefined };
}

async stop() {
  await this.pool?.end();
  this.pool = undefined;
  return { ok: true, value: undefined };
}
```

---

## 10. Migration and Versioning

### Breaking Changes (MAJOR)

- Removing exported classes or functions
- Removing or renaming capabilities
- Changing config schema to remove required fields
- Dropping platformVersion compatibility

### Non-Breaking Changes (MINOR / PATCH)

- Adding optional config fields
- Adding new capabilities
- Performance improvements
- Bug fixes

### Communicating Changes

Always include a `changelog` when publishing:
```bash
atlas publish --channel stable
# Prompts for changelog text if not set in atlas.yaml
```

---

## 11. Troubleshooting

### "Manifest validation failed"

```bash
atlas doctor
# Shows exact validation errors with hints
```

### "Permission denied: spawn:process"

You declared `spawn:process` capability. This requires manual approval.
Most plugins do not need this — use `context.http` instead.

### "Bundle size exceeds 5 MB"

Check for accidentally bundled large modules:
```bash
npx vite-bundle-visualizer  # or
npx source-map-explorer dist/index.js
```

Mark large deps as external in tsconfig/build config if the platform provides them.

### "Signing key not found"

```bash
atlas login
# Checks for key at ~/.atlas/signing.key
# Run atlas doctor to verify
```
