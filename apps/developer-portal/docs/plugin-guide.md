# Plugin Development Guide

## 1. Create a New Plugin

```bash
atlas create my-connector --type connector
cd my-connector
pnpm install
```

This generates:

```
my-connector/
├── atlas-plugin.json     # Plugin manifest
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts          # Plugin entry point
└── tests/
    └── index.test.ts
```

## 2. Plugin Manifest (atlas-plugin.json)

Every field is documented and validated by `@seltriva/validator`.

### Required Fields

| Field             | Type     | Description                                    |
| ----------------- | -------- | ---------------------------------------------- |
| `id`              | string   | Reverse-domain ID: `com.vendor.plugin-name`    |
| `name`            | string   | Kebab-case machine name                        |
| `displayName`     | string   | Human-readable title                           |
| `version`         | semver   | Semantic version `x.y.z`                       |
| `type`            | enum     | One of 12 plugin types                         |
| `description`     | string   | One-sentence description                       |
| `author`          | object   | `{ name, email?, organization? }`              |
| `license`         | string   | SPDX identifier (e.g. `MIT`, `Apache-2.0`)     |
| `runtime`         | object   | `{ nodeVersion: ">=20.0.0" }`                  |
| `capabilities`    | string[] | What the plugin can access (coarse-grained)    |
| `permissions`     | string[] | Fine-grained API permissions                   |
| `entryPoint`      | string   | Relative path to compiled JS (`dist/index.js`) |
| `platformVersion` | semver   | Required platform version range                |
| `sdkVersion`      | semver   | Required SDK version range                     |

### Optional Fields

| Field             | Type       | Description                   |
| ----------------- | ---------- | ----------------------------- |
| `longDescription` | markdown   | Rich marketplace description  |
| `homepage`        | URL        | Plugin website                |
| `repository`      | URL        | Source code repository        |
| `keywords`        | string[]   | For marketplace search        |
| `icon`            | URL/base64 | Plugin icon (PNG, 256×256)    |
| `screenshots`     | URL[]      | Marketplace screenshots       |
| `configSchema`    | object     | JSON Schema for plugin config |

## 3. Plugin Lifecycle

```
Platform loads atlas-plugin.json
       │
       ▼
plugin.init(context)     ← inject PluginContext, validate config
       │
       ▼
plugin.start()           ← open connections, register handlers
       │
   [running]
       │
       ▼
plugin.stop()            ← close connections, drain queues
       │
       ▼
plugin.destroy()         ← release all resources
```

### Minimal Implementation

```typescript
import type { Plugin, PluginContext, PluginResult, PluginHealthStatus } from '@seltriva/plugin-sdk';
import manifest from '../atlas-plugin.json' assert { type: 'json' };

export class MyConnector implements Plugin {
  readonly manifest = manifest;
  private ctx!: PluginContext;

  async init(context: PluginContext): Promise<PluginResult<void>> {
    this.ctx = context;
    const host = context.config.getRequired<string>('host');
    this.ctx.logger.info('Connector initializing', { host });
    return { ok: true, value: undefined };
  }

  async start(): Promise<PluginResult<void>> {
    this.ctx.logger.info('Connector starting');
    return { ok: true, value: undefined };
  }

  async stop(): Promise<PluginResult<void>> {
    return { ok: true, value: undefined };
  }

  async destroy(): Promise<PluginResult<void>> {
    return { ok: true, value: undefined };
  }

  async health(): Promise<PluginHealthStatus> {
    return { status: 'healthy' };
  }
}

export default new MyConnector();
```

## 4. Plugin Context API

The `PluginContext` is the only API surface available to your plugin.

```typescript
context.logger.info('message', { key: 'value' }); // Structured logging
context.config.getRequired('apiKey'); // Validated config
context.credentials.get('db-password'); // Secure credential access
context.http.post('https://api.example.com/data', body); // Sandboxed HTTP
context.storage.set('cache-key', buffer); // Isolated key-value storage
context.events.emit('entity.synced', { id: '123' }); // Platform event bus
context.metrics.increment('records.processed'); // Metrics export
```

## 5. Capabilities and Permissions

Declare only what you need — the platform enforces the minimum principle.

### Capabilities (coarse-grained resource access)

```json
"capabilities": [
  "database-read",      // may read from databases via connectors
  "network-outbound",   // may make outbound HTTP requests
  "credential-access",  // may read credentials from the credential store
  "notification-send",  // may send notifications
  "storage-read",       // may read blobs from storage
  "storage-write",      // may write blobs to storage
  "ai-inference"        // may call AI provider inference endpoints
]
```

### Permissions (fine-grained API access)

```json
"permissions": [
  "read:schema",        // discover source schema
  "read:credentials",   // retrieve stored credentials
  "read:config",        // read runtime configuration
  "send:notification",  // send notification events
  "access:storage",     // use blob storage
  "read:metrics",       // read platform metrics
  "write:metrics"       // write custom metrics
]
```

## 6. Configuration Schema

Define your config structure in `configSchema` — the platform renders a UI automatically:

```json
"configSchema": {
  "type": "object",
  "required": ["host", "port", "database"],
  "properties": {
    "host": {
      "type": "string",
      "title": "Host",
      "description": "Database host or IP address"
    },
    "port": {
      "type": "number",
      "title": "Port",
      "default": 5432
    },
    "password": {
      "type": "string",
      "title": "Password",
      "secret": true
    }
  }
}
```

## 7. Testing Your Plugin

```typescript
import { createTestHarness, assertOk, assertLogContains } from '@seltriva/testing';
import { MyConnector } from '../src/index';

const harness = createTestHarness(new MyConnector(), {
  config: { host: 'localhost', port: 5432, database: 'testdb' },
  credentials: { 'db-password': 'secret' },
});

test('initializes successfully', async () => {
  const result = await harness.init();
  assertOk(result);
  assertLogContains(harness.context.logs, 'info', 'initializing');
});
```

## 8. Plugin Types Reference

### Connector Plugin

Must implement: `IConnectorPlugin`

```typescript
import type { IConnectorPlugin } from '@seltriva/plugin-sdk';

export class MyConnector implements IConnectorPlugin {
  readonly type = 'connector' as const;
  // ... Plugin base methods ...
  async connect(config): Promise<PluginResult<ConnectorHandle>> { ... }
  async disconnect(handle): Promise<PluginResult<void>> { ... }
  async test(config): Promise<PluginResult<ConnectorTestResult>> { ... }
  getCapabilities(): ConnectorCapabilities { ... }
}
```

### ERP Profile Plugin

Must implement: `IERPProfilePlugin`

```typescript
export class SAPProfile implements IERPProfilePlugin {
  readonly type = 'erp-profile' as const;
  getSystem(): ERPSystemDescriptor { ... }
  getModules(): ERPModule[] { ... }
  getEntityMappings(): ERPEntityMapping[] { ... }
  getAuthFlow(): ERPAuthFlow { ... }
}
```

## 9. Build and Package

```bash
# Build
atlas build --production

# Validate before packaging
atlas doctor

# Package (creates .atlasp signed package)
atlas package --sign --key-file ~/.atlas/signing.key

# Publish to marketplace
atlas publish --channel stable
```

## 10. Versioning Rules

- Follow semantic versioning: `MAJOR.MINOR.PATCH`
- `MAJOR` — breaking API changes (new required methods, removed capabilities)
- `MINOR` — new optional features, new capabilities added
- `PATCH` — bug fixes, performance improvements, documentation
- Versions are immutable once published — you cannot overwrite a published version
