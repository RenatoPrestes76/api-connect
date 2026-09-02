# Atlas Connect — Production Environment Contract

Written by ATLAS 46.38 (Production Infrastructure Handoff & Go-Live
Lock), consolidating the environment-variable classification already
established across 46.31–46.37 into one authoritative reference. Every
claim here is backed by a real, verified check — `services/
production-secrets.ts`'s fail-loud gate (verified via a real container
boot, 46.31–46.37), `packages/config`'s `validateEnv()`, and
`scripts/production/preflight.mjs`'s own environment check.

**Never put a real secret value in this file, in any commit, or in
`apps/api/.env.example`.** Every table below lists names and purposes
only.

## Required

The process refuses to boot without these, in every environment
(`packages/config`'s `getConfig()` throws immediately if either is
unset):

| Variable         | Purpose                           |
| ---------------- | --------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string      |
| `API_SECRET_KEY` | Generic API authentication secret |

Additionally required specifically when `NODE_ENV=production`
(`services/production-secrets.ts`'s `assertProductionSecretsConfigured`/
`assertProductionCorsConfigured` — verified via a real container boot to
refuse startup, not just a unit test, across 46.31–46.37):

| Variable                   | Purpose                                                        | Consumed by                                     |
| -------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `ADMIN_JWT_SECRET`         | Signs admin-identity session tokens                            | `modules/admin-identity/jwt.ts`                 |
| `PORTAL_JWT_SECRET`        | Signs portal-identity session tokens                           | `modules/portal-identity/jwt.ts`                |
| `RUNTIME_JWT_SECRET`       | Signs Runtime access tokens                                    | `modules/runtime-registration/runtime-jwt.ts`   |
| `RUNTIME_CERT_SECRET`      | Runtime certificate signing                                    | `modules/runtime-registration/certificate.ts`   |
| `CONNECTOR_PACKAGE_SECRET` | Connector package integrity signing                            | `modules/connectors/package-integrity.ts`       |
| `MESSAGE_DELIVERY_SECRET`  | Message delivery signing                                       | `modules/message-delivery/message-signature.ts` |
| `SUPABASE_JWT_SECRET`      | Generic Supabase-style session verification                    | `middleware/auth.ts`                            |
| `ATLAS_MASTER_KEY`         | ERP credential envelope encryption (64 hex chars)              | `@seltriva/aegis` crypto.ts                     |
| `CORS_ALLOWED_ORIGINS`     | CORS allowlist — refuses an empty/wildcard value in production | `http/router.ts`                                |

Each of the 8 secrets above must be a freshly **generated** value with no
identity of its own (e.g. `openssl rand -hex 32`) — never reused from
`.env.example`, never shared across environments, never the same value
twice.

## Required for Client Zero

Not required for the process to boot, but required for the first-client
onboarding flow (`pnpm production:client-zero`, or the manual equivalent
in `docs/deployment/production-first-deployment.md`) to run at all — an
operator needs an admin session to issue the first tenant and activation
key:

| Variable                                     | Purpose                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SEED_ADMIN_EMAIL`                           | Bootstrap admin identity email                                                                                                                                         |
| `SEED_ADMIN_PASSWORD`                        | Bootstrap admin identity password — `mustChangePassword` forces rotation on first real login regardless                                                                |
| `ATLAS_BASE_URL`                             | Target API URL for `production:client-zero`/`production:verify` — never defaults to a real domain                                                                      |
| `ATLAS_ADMIN_EMAIL` / `ATLAS_ADMIN_PASSWORD` | The real admin credentials `production:client-zero` logs in with (may be the same values as `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, or a rotated real admin account) |

## Optional

Real defaults exist; unset is a legitimate, safe state:

| Variable            | Purpose                                   | Default when unset                                                                          |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | Environment mode                          | `development`                                                                               |
| `API_PORT`          | HTTP listen port                          | `3001`                                                                                      |
| `LOG_LEVEL`         | Logger verbosity                          | `info`                                                                                      |
| `ANTHROPIC_API_KEY` | AI Copilot routes (`routes/v1/copilot/*`) | Falls back to a deterministic demo response — never required for the core operational cycle |

## External

Not application configuration — these depend on infrastructure that
does not exist inside this repository and cannot be generated by it:

| Item                                     | Depends on                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`'s real value              | A provisioned managed PostgreSQL instance                                                                 |
| Real values for all 8 production secrets | Generated once, then loaded into the hosting platform's own secret manager — never committed              |
| `CORS_ALLOWED_ORIGINS`'s real value      | The real frontend origin(s), which depend on the domain/hosting for `apps/admin`/`apps/web` being decided |
| A resolvable `ATLAS_BASE_URL`            | A real hosting deployment + (eventually) DNS                                                              |

## Explicitly not required — do not "fix" this by adding a dependency

| Variable    | Status                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REDIS_URL` | Provisioned in `docker-compose.yml` for local dev; read by **no** application code as of this sprint. Not promoted to Required — per 46.31–46.37's explicit instruction, do not wire up a dependency just to make an unused variable meaningful. |

## Fail-loud guarantee (verified, not assumed)

Confirmed via a real container boot (46.31, reconfirmed 46.32–46.37),
not just a unit test of the assertion function:

- `NODE_ENV=production` + any Required-in-production secret missing →
  process exits non-zero immediately, before opening the HTTP listener.
  Never a silent fallback to a hardcoded dev value in production.
- `NODE_ENV=production` + `CORS_ALLOWED_ORIGINS` empty or `*` → same
  refusal.
- `scripts/production/preflight.mjs --production` performs the
  equivalent check without booting a real process, and additionally
  refuses a `DATABASE_URL`/`--base-url` that resolves to a local/private
  address under `--production` — a local database or API can never be
  reported as production-ready.
