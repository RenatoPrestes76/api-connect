# @seltriva/core/drivers

Driver interfaces for external system integration — the **Port** side of Hexagonal Architecture.

## Purpose

Defines the contracts (ports) that adapters must implement to integrate external systems. No driver in this module contains any implementation — every concrete driver lives in `packages/drivers` or a dedicated workspace package.

## Driver Types

| Interface            | `type`         | External System                    |
| -------------------- | -------------- | ---------------------------------- |
| `DatabaseDriver`     | `database`     | PostgreSQL, MySQL, SQLite, MSSQL   |
| `ERPDriver`          | `erp`          | SAP, TOTVS, Dynamics, Oracle       |
| `CacheDriver`        | `cache`        | Redis, Memcached, in-memory        |
| `StorageDriver`      | `storage`      | S3, GCS, Azure Blob, local FS      |
| `NotificationDriver` | `notification` | SMTP, Twilio, FCM, Webhooks        |
| `AIProviderDriver`   | `ai`           | OpenAI, Anthropic, Gemini, Mistral |
| `AuthDriver`         | `auth`         | OAuth2, OIDC, LDAP, SAML           |

## Architecture

```
Application Core
      ↕  (Driver interfaces — ports)
  drivers/
      ↕  (Adapters in packages/drivers)
External Systems
```

## Base Contract

All drivers extend `Driver`:

- `initialize()` / `shutdown()` — lifecycle hooks
- `isReady()` — health status
- `getMetadata()` — name, version, capabilities
- `hasCapability(cap)` — feature negotiation

## Constraints

- No implementations in this module.
- Driver `type` discriminant must be a string literal for registry lookups.
- All I/O methods return Promises — no synchronous I/O in the port layer.
