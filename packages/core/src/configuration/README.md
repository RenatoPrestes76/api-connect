# @seltriva/core/configuration

Configuration management interfaces — Strategy Pattern for multiple configuration sources.

## Purpose

Abstracts where configuration comes from (files, environment, remote services, secrets backends) behind a single `ConfigurationManager`. Consumers always call `config.get('key')` regardless of the underlying source.

## Interfaces

| Interface                          | Role                                       |
| ---------------------------------- | ------------------------------------------ |
| `ConfigurationManager`             | Central facade — get, set, watch, validate |
| `ConfigurationSchema`              | JSON Schema-like descriptor for validation |
| `ConfigValidationResult`           | Validation output with per-field errors    |
| `ConfigurationProvider`            | Strategy: single config source             |
| `EnvironmentConfigurationProvider` | Reads from env vars with prefix stripping  |
| `FileConfigurationProvider`        | Reads from `.json`, `.yaml`, `.env` files  |
| `RemoteConfigurationProvider`      | Polls Consul, Vault, AWS SSM, etc.         |
| `SecretProvider`                   | Retrieves secrets from a secure backend    |
| `ConfigurationLoader`              | Merges multiple providers by priority      |

## Architecture

```
ConfigurationLoader
  ├── EnvironmentConfigurationProvider (priority: 100)
  ├── RemoteConfigurationProvider      (priority: 75)
  └── FileConfigurationProvider        (priority: 50)
          ↓ merged result
    ConfigurationManager
          ↓ .get('db.host')
    Application Code
```

## Constraints

- No concrete implementations in this module.
- Providers are merged in ascending priority order (higher number wins).
- `ConfigurationManager.watch()` must support hot-reload without restart.
- Secrets must never be logged — `SecretProvider` is intentionally separate from `ConfigurationProvider`.
