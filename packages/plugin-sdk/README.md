# @seltriva/plugin-sdk

Official Plugin SDK for building enterprise plugins on Seltriva Connect.

## Installation

```bash
npm install @seltriva/plugin-sdk
```

## Quick Start

```typescript
import type { Plugin, PluginContext, PluginResult, PluginHealthStatus } from '@seltriva/plugin-sdk';
import manifest from '../atlas-plugin.json' assert { type: 'json' };

export class MyPlugin implements Plugin {
  readonly manifest = manifest;
  private ctx!: PluginContext;

  async init(context: PluginContext): Promise<PluginResult<void>> {
    this.ctx = context;
    return { ok: true, value: undefined };
  }

  async start(): Promise<PluginResult<void>> {
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

export default new MyPlugin();
```

## Plugin Types

12 plugin type interfaces: `connector` · `erp-profile` · `ai-provider` · `notification` ·
`storage` · `transformation` · `validator` · `sync-strategy` · `mapping-strategy` ·
`security-provider` · `license-provider` · `export-provider`

## Plugin Manifest

Every plugin must have an `atlas-plugin.json`:

```json
{
  "id": "com.vendor.plugin-name",
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.0.0",
  "type": "connector",
  "description": "Short description",
  "author": { "name": "Vendor Inc." },
  "license": "MIT",
  "runtime": { "nodeVersion": ">=20.0.0" },
  "capabilities": [],
  "permissions": [],
  "entryPoint": "dist/index.js",
  "platformVersion": ">=0.1.0",
  "sdkVersion": ">=0.1.0"
}
```

## PluginContext API

| API                   | Purpose                   |
| --------------------- | ------------------------- |
| `context.logger`      | Structured logging        |
| `context.config`      | Runtime configuration     |
| `context.credentials` | Secure credential storage |
| `context.http`        | Sandboxed HTTP client     |
| `context.storage`     | Isolated KV storage       |
| `context.events`      | Platform event bus        |
| `context.metrics`     | Metrics export            |

## Constants

- `PLUGIN_SDK_VERSION = '0.1.0'`
- `MANIFEST_FILE_NAME = 'atlas-plugin.json'`
- `PACKAGE_EXTENSION  = '.atlasp'`
- `PLUGIN_TYPES` — array of all 12 types
