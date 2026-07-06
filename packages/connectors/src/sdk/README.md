# @seltriva/connectors/sdk

Connector Plugin SDK — the developer guide and contracts for building and distributing new connectors.

## Purpose

The SDK defines the boundary between Seltriva Connect and third-party connector authors. Every connector distributed as an npm package implements `ConnectorPlugin`. The framework calls the plugin; the plugin never calls the framework directly.

## Quick Start

```typescript
import type {
  ConnectorPlugin,
  PluginAuthor,
  PluginLifecycle,
  PluginRegistry,
  PluginConfigValidationResult,
} from '@seltriva/connectors/sdk';
import type { Connector, ConnectorConfig, ConnectorResult } from '@seltriva/connectors/core';
import type { CapabilitySet } from '@seltriva/connectors/capabilities';

export const snowflakePlugin: ConnectorPlugin = {
  id: 'seltriva-connector-snowflake',
  name: 'Snowflake',
  version: '1.0.0',
  sdkVersion: '0.1.0',
  description: 'Snowflake Data Cloud connector',
  connectorType: 'database',

  configSchema: {
    properties: {
      account:    { type: 'string', required: true, label: 'Account' },
      username:   { type: 'string', required: true, label: 'Username' },
      password:   { type: 'string', required: true, label: 'Password', secret: true },
      database:   { type: 'string', required: true, label: 'Database' },
      schema:     { type: 'string', required: false, label: 'Schema', default: 'PUBLIC' },
      warehouse:  { type: 'string', required: true, label: 'Warehouse' },
    },
  },

  author: { name: 'Seltriva', email: 'dev@seltriva.com' },
  lifecycle: {
    onInstall: async (registry: PluginRegistry) => { /* optional setup */ },
  },

  async createConnector(config: ConnectorConfig): Promise<Connector> {
    // Return your implementation here
    return new SnowflakeConnectorImpl(config);
  },

  async validateConfig(config: ConnectorConfig): Promise<ConnectorResult<PluginConfigValidationResult>> {
    const errors = [];
    if (!config.account) errors.push({ field: 'account', message: 'Account is required', code: 'REQUIRED' });
    return {
      success: errors.length === 0,
      data: { isValid: errors.length === 0, errors, warnings: [] },
      timestamp: new Date(),
    };
  },

  describeCapabilities(config: ConnectorConfig): CapabilitySet {
    // Return a CapabilitySet describing what this connector can do
    return capabilitySetBuilder.build(['read', 'write', 'schema-discovery', 'transactions']);
  },

  getDescriptor() {
    return { id: 'snowflake', name: 'Snowflake', type: 'database', version: '1.0.0' };
  },
};
```

## Plugin Manifest

Add to `package.json`:

```json
{
  "name": "seltriva-connector-snowflake",
  "version": "1.0.0",
  "seltrivaConnector": {
    "pluginId": "seltriva-connector-snowflake",
    "connectorType": "database",
    "sdkVersion": "0.1.0",
    "entryPoint": "./dist/index.js"
  }
}
```

Or as `connector.manifest.json`:

```json
{
  "pluginId": "seltriva-connector-snowflake",
  "name": "Snowflake",
  "version": "1.0.0",
  "sdkVersion": "0.1.0",
  "description": "Snowflake Data Cloud connector",
  "connectorType": "database",
  "capabilities": ["read", "write", "schema-discovery", "transactions"],
  "entryPoint": "./dist/index.js",
  "author": { "name": "Seltriva" },
  "configSchema": { "properties": { ... } }
}
```

## Installing a Plugin

```typescript
const loader: PluginLoader = ...;
const registry: PluginRegistry = ...;

// From npm package
const plugin = await loader.loadFromPackage('seltriva-connector-snowflake');
await registry.install(plugin);

// From local path
const plugin = await loader.loadFromPath('./my-connector/dist/index.js');
await registry.install(plugin);
```

## Compliance Testing

The SDK ships a `PluginTestHarness` so plugin authors can verify their implementation before publishing:

```typescript
const harness: PluginTestHarness = ...;

const report = await harness.runComplianceSuite(myPlugin, {
  account: 'myaccount',
  username: 'user',
  password: 'secret',
  database: 'PROD',
  warehouse: 'COMPUTE_WH',
});

console.log(`Grade: ${report.grade} — Score: ${report.score}%`);
report.results.forEach(r => {
  console.log(`${r.passed ? '✓' : '✗'} ${r.test}`);
});
```

## Interfaces

| Interface | Role |
|-----------|------|
| `ConnectorPlugin` | Root contract — every distributable connector implements this |
| `PluginAuthor` | Author metadata |
| `PluginLifecycle` | Install / uninstall / upgrade hooks |
| `PluginRegistry` | Manages loaded plugins at runtime |
| `PluginRegistryEvent` | Change notifications from the plugin registry |
| `ConnectorManifest` | Static discovery declaration |
| `PluginLoader` | Loads plugins from paths, packages, or directories |
| `PluginTestHarness` | UDCF compliance suite for plugin authors |
| `ComplianceReport` | Full test run results with grade |
| `AbstractConnectorContract` | Expected shape for concrete connector classes |
| `SdkVersionInfo` | Runtime SDK version negotiation |

## Constraints

- No implementations in this module except `getSdkVersionInfo()` (pure value function).
- `createConnector()` must NOT connect — return an unconnected instance; the framework calls `connect()`.
- `validateConfig()` must never throw — return `ConnectorResult` with `success: false` on errors.
- The compliance test harness requires a real connection; it does not mock.
- `CONNECTOR_SDK_VERSION` is the source of truth for version negotiation between SDK and plugins.
