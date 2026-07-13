# Atlas Forge — Developer Platform

**Codename:** Atlas Forge | **Version:** 0.1.0 | **Sprint:** ES-0010

Atlas Forge is the official developer platform for building enterprise plugins,
connectors, ERP integrations, AI providers, and extensions for Seltriva Connect.

---

## What You Can Build

| Plugin Type         | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `connector`         | Database / API connectors (read-only schema discovery) |
| `erp-profile`       | ERP system profiles with entity mappings               |
| `ai-provider`       | AI/LLM completion and embedding providers              |
| `notification`      | Notification delivery channels                         |
| `storage`           | S3-compatible blob storage backends                    |
| `transformation`    | Field and record transformation pipelines              |
| `validator`         | Data quality and business rule validators              |
| `sync-strategy`     | Full / incremental / CDC sync strategies               |
| `mapping-strategy`  | Intelligent field mapping engines                      |
| `security-provider` | OAuth2 / SSO / MFA security providers                  |
| `license-provider`  | License validation and feature gating                  |
| `export-provider`   | CSV / Excel / JSON / custom export formats             |

## Quick Start

```bash
# 1. Install the CLI
npm install -g @seltriva/cli

# 2. Login
atlas login

# 3. Create a plugin
atlas create my-connector --type connector

# 4. Build
cd my-connector
atlas build

# 5. Test
atlas test

# 6. Package and publish
atlas package
atlas publish
```

## Platform Packages

| Package                     | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `@seltriva/plugin-sdk`      | Plugin interfaces, manifest spec, types |
| `@seltriva/sdk`             | Atlas Cloud client SDK                  |
| `@seltriva/cli`             | Developer CLI (`atlas` command)         |
| `@seltriva/generator`       | Project scaffolding engine              |
| `@seltriva/testing`         | Test harness + mock plugin context      |
| `@seltriva/templates`       | 17 ready-to-use project templates       |
| `@seltriva/validator`       | Plugin validator (6 categories)         |
| `@seltriva/marketplace-api` | Marketplace publish/consume contracts   |

## Plugin Manifest Spec

Every plugin must include an `atlas-plugin.json` file:

```json
{
  "id": "com.acme.my-connector",
  "name": "my-connector",
  "displayName": "My Connector",
  "version": "1.0.0",
  "type": "connector",
  "description": "Connect to ACME's proprietary database",
  "author": { "name": "ACME Inc.", "email": "dev@acme.com" },
  "license": "MIT",
  "runtime": { "nodeVersion": ">=20.0.0" },
  "capabilities": ["database-read", "network-outbound"],
  "permissions": ["read:schema", "read:credentials"],
  "entryPoint": "dist/index.js",
  "platformVersion": ">=0.1.0",
  "sdkVersion": ">=0.1.0"
}
```

## Documentation

- [SDK Guide](docs/sdk-guide.md) — Atlas Cloud SDK usage
- [CLI Guide](docs/cli-guide.md) — `atlas` CLI reference
- [Plugin Guide](docs/plugin-guide.md) — Building plugins
- [Marketplace Guide](docs/marketplace-guide.md) — Publishing to marketplace
- [Developer Handbook](docs/developer-handbook.md) — Complete reference
- [Architecture](docs/architecture.md) — Platform architecture

## License

Copyright © 2024 Seltriva. All rights reserved.
