# Atlas Connect — First Real Production Deployment

Written by ATLAS 46.33 (Real Deployment Preparation & Production
Infrastructure Gate). This is the operational reference for the **first**
real deployment of Atlas Connect to production infrastructure — it
assumes no hosting, database, or domain exists yet.

Everything in this document that depends on infrastructure this
repository does not control is marked `EXTERNAL/DEFERRED`. Nothing here
was invented — every claim is backed by a real, verified test or audit
from ATLAS 46.30–46.33. See `docs/ATLAS-PRODUCTION-RUNBOOK.md` for the
full history and evidence behind each item.

**Never put real secret values in this file, in commits, or in any
`.env.example`.**

## Deployment Status (as of ATLAS 46.35)

Checked directly — not assumed — via `docs/ATLAS-PRODUCTION-DOMAIN.md`'s
own status line, a search for any real `.onrender.com` reference in this
repository, and `render.yaml`'s content. Result: **no real cloud
deployment exists yet** — unchanged since 46.34; no external action
occurred between these two sprints that could have changed it.

```text
Deployment date:      N/A — no deployment has occurred
Deployment commit:    N/A
Production URL:       EXTERNAL/DEFERRED — none exists
Official API domain:  EXTERNAL/DEFERRED — atlasappruntime.com.br unregistered
Health result:        EXTERNAL/DEFERRED — no URL to check
Readiness result:     EXTERNAL/DEFERRED — no URL to check
Smoke test result:    EXTERNAL/DEFERRED — no URL to point ATLAS_BASE_URL at
Client Zero result:   EXTERNAL/DEFERRED — no URL to run it against
Backup status:        EXTERNAL/DEFERRED — no database provider chosen
Monitoring status:    EXTERNAL/DEFERRED — no platform chosen
Rollback status:      Documented below (conceptual); undrillable without production
```

Every item above will be updated with real, observed values the moment a
real deployment exists — see `docs/ATLAS-PRODUCTION-RUNBOOK.md`'s ATLAS
46.34/46.35 sections for the full evidence trail behind this status.

## Production Deployment Contract — Repository vs. External Infrastructure

A single, explicit split, so the next action is never ambiguous about
whose responsibility it is:

**REPOSITORY CONTROLLED — already done, verified repeatedly (46.30–46.35),
not this sprint's work to redo:**

- Application code, build (`pnpm build`), and the production Docker image
  (`docker/Dockerfile.api`) — reproducible from a genuinely clean
  `--no-cache` build.
- Prisma schema and both migrations (additive-only).
- Fail-loud startup validation (`services/production-secrets.ts`) —
  refuses to boot in `NODE_ENV=production` with any required secret or
  an unsafe CORS config missing.
- Health/readiness semantics (`/health`, `/ready`) — including detecting
  a real, mid-life database outage, not just a cold-start failure.
- Graceful shutdown (real `SIGTERM` → clean exit, verified via a real
  container and `docker stop`).
- Authentication, authorization, tenant isolation, runtime authorization
  — proven via the full test suite and the local/containerized Client
  Zero acceptance flow.
- The deployment procedure itself (this document) and the smoke-test
  harness (`scripts/atlas-production-readiness.mjs`, `ATLAS_BASE_URL`-
  driven).

**EXTERNAL INFRASTRUCTURE CONTROLLED — genuinely outside this
repository's reach, requires a human with account/billing/registrar
access:**

- A hosting platform account and an actual provisioned service (Render
  or otherwise) — `render.yaml` is a specification a provider would
  build from, not evidence one exists.
- A real, managed PostgreSQL instance and its `DATABASE_URL`.
- Domain registration for `atlasappruntime.com.br` and DNS records
  pointing its subdomains at whatever the hosting/frontend platforms
  assign.
- TLS/HTTPS certificates (typically automatic once a real domain is
  attached to a real platform service — not something this repository
  configures).
- Real secret values loaded into the platform's own secret manager.
- A managed backup/restore offering, a monitoring/alerting platform, and
  a live rollback drill — all meaningless without the above existing
  first.

Nothing in the second list can be provisioned from within this
repository. Per this sprint's own governing principle, none of it was
fabricated, simulated, or marked `PASS` in its absence.

## Automation Commands (ATLAS 46.37)

Every command below is real, tested against a real local/containerized
environment as part of building it, and fail-loud by design: a missing
external requirement is reported as `EXTERNAL/DEFERRED` or `BLOCKED`,
never silently as `PASS`. None fabricates a provider, URL, or credential.

| Command                                                                                                             | Purpose                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm production:preflight [-- --production] [-- --base-url=<url>]`                                                 | Checks repository/build/environment/database/hosting/domain/HTTPS/application readiness before any deploy is attempted. `--production` additionally refuses a local database or base URL.                                                                                                                      |
| `pnpm production:deploy -- --production`                                                                            | Orchestrates preflight → build → deploy (via the active `ProductionProvider`) → health/readiness → smoke test. Stops at the first failed step; never proceeds to Client Zero automatically.                                                                                                                    |
| `pnpm production:migrate -- --production --yes`                                                                     | Safety-gated `prisma migrate deploy` wrapper — requires both flags explicitly, refuses a local `DATABASE_URL`, never exposes `reset`/destructive commands.                                                                                                                                                     |
| `pnpm production:domain`                                                                                            | DNS resolution check for `atlasappruntime.com.br` / `api.atlasappruntime.com.br` — a real lookup, never `/etc/hosts` or an assumed result.                                                                                                                                                                     |
| `pnpm production:client-zero -- --production` (needs `ATLAS_BASE_URL`, `ATLAS_ADMIN_EMAIL`, `ATLAS_ADMIN_PASSWORD`) | Automates signup → tenant → activation key (plain HTTP) → runtime registration/heartbeat/discovery/job (via the existing, unmodified `runAtlasRuntimeClient` orchestrator in `apps/agent`, invoked through a thin CLI wrapper — no signing logic duplicated). Refuses a local base URL or missing credentials. |
| `pnpm production:verify [-- --base-url=<url>]`                                                                      | The final gate — runs every check above and prints the Go-Live decision table (see below). Only ever prints `GO-LIVE READY` when every critical gate is genuinely `PASS`.                                                                                                                                      |
| `pnpm production:rollback -- --production --yes`                                                                    | Identifies current/previous deployment via `ProductionProvider.rollback()`; reports `EXTERNAL/DEFERRED` honestly when no provider exists rather than simulating.                                                                                                                                               |
| `pnpm production:dry-run` (ATLAS 46.38)                                                                             | Validates the whole pipeline's structure and fail-loud protections — command existence/order, precondition consistency, local-DB/localhost/missing-secret refusal, mutation-confirmation gates — without contacting real infrastructure. Always reports `DRY_RUN_ONLY`, never `PRODUCTION_READY`.              |

**`ProductionProvider`** (`scripts/production/provider.mjs`) is the
interface (`validate`/`deploy`/`getDeploymentUrl`/`getDeploymentStatus`/
`rollback`) the commands above program against. Today only `NullProvider`
exists — it answers every method honestly with `EXTERNAL/DEFERRED`
rather than simulating a provider. A real implementation (e.g. for
Render) can be added later without changing any of the orchestration
scripts above.

## Production Infrastructure Handoff (ATLAS 46.38)

Three artifacts produced by ATLAS 46.38 supersede/consolidate parts of
the sections below and should be read alongside them:

- [`production-environment-contract.md`](production-environment-contract.md)
  — the authoritative environment-variable classification (Required /
  Required for Client Zero / Optional / External).
- [`production-readiness-inventory.md`](production-readiness-inventory.md)
  — a verifiable inventory of Aplicação/Segurança/Operação (all READY)
  vs. Infraestrutura externa (all honestly `EXTERNAL_REQUIRED`).
- [`go-live-checklist.json`](go-live-checklist.json) — the same gates as
  the table below, in a machine-readable form.
- [`external-infrastructure-handoff.md`](external-infrastructure-handoff.md)
  — the operational handoff: exactly what Hosting/PostgreSQL/Domain/DNS/
  TLS/Secrets/Monitoring/Alerting must look like before the first real
  deploy.

## Pré-requisitos

- **GitHub**: this repository, `master` branch, CI configured
  (`.github/workflows/ci.yml`) — already in place.
- **Plataforma de hospedagem**: `render.yaml` targets Render
  (`docker/Dockerfile.api`, `runtime: docker`) — **EXTERNAL/DEFERRED**,
  no Render account/service is provisioned as of this sprint.
- **Banco de produção**: a managed Postgres instance reachable via
  `DATABASE_URL` — **EXTERNAL/DEFERRED**, not provisioned. Schema is
  ready: 2 migrations, both additive, verified to apply cleanly to a
  genuinely empty database (46.31).
- **Domínio**: `atlasappruntime.com.br` / `api.atlasappruntime.com.br` —
  **EXTERNAL/DEFERRED**, confirmed unregistered via a real DNS lookup as
  of this sprint (`getaddrinfo ENOTFOUND`, both hosts).
- **Secrets**: the 8 entries in `services/production-secrets.ts`'s
  `REQUIRED_IN_PRODUCTION` (`ADMIN_JWT_SECRET`, `PORTAL_JWT_SECRET`,
  `RUNTIME_JWT_SECRET`, `RUNTIME_CERT_SECRET`, `CONNECTOR_PACKAGE_SECRET`,
  `MESSAGE_DELIVERY_SECRET`, `SUPABASE_JWT_SECRET`, `ATLAS_MASTER_KEY`)
  plus `DATABASE_URL`/`API_SECRET_KEY`/`CORS_ALLOWED_ORIGINS` — real
  values generated and stored in the hosting platform's secret manager,
  never committed. `apps/api/.env.example` documents every name (no
  values) and which module consumes each one.
- **CORS**: `CORS_ALLOWED_ORIGINS` set to the real frontend origin(s)
  once they exist — the process refuses to boot in production with this
  unset or `*` (verified, 46.31).
- **Runtime enrollment**: no additional configuration beyond the secrets
  above — activation keys are issued per-organization through the admin
  API at runtime, not provisioned ahead of time.

### Environment variable classification

| Variable                                   | Class                                   | Required?                          | Consumed by                                      |
| ------------------------------------------ | --------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                             | SECRET, PROVIDER-SPECIFIC               | Required (all envs)                | `packages/config`                                |
| `API_SECRET_KEY`                           | SECRET                                  | Required (all envs)                | `packages/config`                                |
| `NODE_ENV`                                 | PUBLIC                                  | Optional (default `development`)   | everywhere                                       |
| `API_PORT`                                 | PUBLIC                                  | Optional (default `3001`)          | `packages/config`                                |
| `LOG_LEVEL`                                | PUBLIC                                  | Optional (default `info`)          | `@seltriva/logger`                               |
| `CORS_ALLOWED_ORIGINS`                     | PUBLIC (values are origins, not secret) | Required in production (fail-loud) | `http/router.ts`                                 |
| `ADMIN_JWT_SECRET`                         | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/admin-identity/jwt.ts`                  |
| `PORTAL_JWT_SECRET`                        | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/portal-identity/jwt.ts`                 |
| `RUNTIME_JWT_SECRET`                       | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/runtime-registration/runtime-jwt.ts`    |
| `RUNTIME_CERT_SECRET`                      | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/runtime-registration/certificate.ts`    |
| `CONNECTOR_PACKAGE_SECRET`                 | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/connectors/package-integrity.ts`        |
| `MESSAGE_DELIVERY_SECRET`                  | SECRET, GENERATED                       | Required in production (fail-loud) | `modules/message-delivery/message-signature.ts`  |
| `SUPABASE_JWT_SECRET`                      | SECRET, GENERATED                       | Required in production (fail-loud) | `middleware/auth.ts`                             |
| `ATLAS_MASTER_KEY`                         | SECRET, GENERATED (64 hex chars)        | Required in production (fail-loud) | `@seltriva/aegis` crypto.ts                      |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | SECRET (password), PUBLIC (email)       | Optional (dev-only defaults)       | `modules/admin-identity/admin-identity-store.ts` |
| `ANTHROPIC_API_KEY`                        | SECRET, PROVIDER-SPECIFIC (Anthropic)   | Optional (demo fallback if unset)  | `routes/v1/copilot/*`                            |
| `REDIS_URL`                                | PUBLIC/PROVIDER-SPECIFIC                | Not read by any application code   | provisioned in `docker-compose.yml` only         |

`GENERATED` means the value has no external identity of its own —
generate a fresh, random one per environment (e.g.
`openssl rand -hex 32` for the 64-hex-char ones) rather than reusing the
value from `.env.example` or any other environment. None of the above
have real values anywhere in this repository — `apps/api/.env.example`
documents names only.

## Ordem recomendada

1. **Provisionar database** — a managed Postgres instance. `EXTERNAL/DEFERRED`.
2. **Provisionar service** — the hosting platform's container/web service
   pointed at `docker/Dockerfile.api`. `EXTERNAL/DEFERRED`.
3. **Configurar environment variables** — every entry in the
   Pré-requisitos list above, real values, in the platform's dashboard
   (`render.yaml` marks every secret `sync: false` specifically so it's
   never asked to hold a real value).
4. **Configurar domínio** — point the platform's assigned hostname at
   `api.atlasappruntime.com.br` once the domain is registered.
   `EXTERNAL/DEFERRED`.
5. **Configurar HTTPS** — typically automatic/managed by the hosting
   platform once the domain is attached; not something this repository
   configures directly. `EXTERNAL/DEFERRED`.
6. **Deploy** — trigger the platform's build from `master`
   (`docker/Dockerfile.api`). Verified reproducible from a genuinely
   clean, `--no-cache` build through 46.31–46.33.
7. **Migration procedure** — **no automated migration step exists in
   this pipeline** (the container's `CMD` is `node dist/index.js`, not a
   migration runner; `render.yaml` has no pre-deploy hook). Apply
   manually, before or during the first boot:
   ```
   cd packages/database && npx prisma migrate deploy
   ```
   run with `DATABASE_URL` pointed at the real production database. This
   is a known, accepted gap (documented since 46.31/46.32) — not solved
   here with an unverified, platform-specific YAML feature.
8. **Health** — `GET /health` → expect `200 {"status":"healthy",...}`.
9. **Readiness** — `GET /ready` → expect `200 {"status":"ready",...}`.
10. **Smoke test** —
    ```
    ATLAS_BASE_URL=https://<real-url> node scripts/atlas-production-readiness.mjs
    ```
    Expect `ATLAS PRODUCTION READINESS: PASS`. Self-cleaning (creates and
    deletes its own tenants/organizations); never touches real client
    data.
11. **Client Zero** — a real signup through the canonical onboarding flow
    (`POST /api/v1/portal/auth/register` → tenant → runtime → heartbeat →
    discovery → job), following the First Client Operating Procedure in
    `docs/ATLAS-PRODUCTION-RUNBOOK.md`'s ATLAS 46.31 section. Never with
    real client data before this checklist is otherwise complete.
12. **Monitoring** — `EXTERNAL/DEFERRED`. No monitoring/alerting platform
    integration exists in this repository; a choice (and its
    integration) is a platform decision, not made by this sprint.
13. **Backup** — `EXTERNAL/DEFERRED`. See Backup below.
14. **Rollback** — see Rollback below; know the procedure before
    deploying, not after an incident.

## Rollback

Conceptual, platform-agnostic — no specific Render command is assumed
without evidence:

- **Application**: redeploy the previous known-good build/image. Every
  container platform with a deploy history supports this natively; this
  repository does not implement custom rollback logic, and doesn't need
  to.
- **Source**: `git revert` the offending commit(s) on `master` rather
  than force-pushing, then redeploy from the reverted commit.
- **Database**: both existing migrations are additive-only — a rollback
  of application code alone is safe. Before any future _destructive_
  migration ships, a tested down-migration or backup/restore procedure
  must exist first; none was needed or created as of this sprint.
- **Config-only incidents**: the API refuses to boot in production with
  an incomplete secret/CORS configuration (verified via a real container
  boot, 46.31–46.33) — a bad config deploy fails at startup rather than
  serving degraded traffic. Roll back the deploy, not the database, for
  this class of incident.

## Backup

```text
Real backup/restore depends on hosting/database provider.
```

The only backup/restore code in this repository
(`routes/v1/ha/backups.ts`, `restore.ts`, `modules/ha/backup-service.ts`)
is an in-memory DR-dashboard simulation — not real `pg_dump`/`pg_restore`
against the actual database. To validate once a real production database
exists (not before, and not simulated in its place):

- Automated backup schedule and retention policy, from the managed
  Postgres provider's own offering.
- A real restore actually executed against a non-production copy.
- Point-in-time recovery, if the provider offers it.
- Documented, dated evidence of at least one successful test restore
  before it's trusted for a real incident.

## Monitoring

```text
EXTERNAL / DEFERRED
```

No monitoring/alerting platform is integrated in this repository.
`GET /health` and `GET /ready` are real, tested, and safe to poll from an
external uptime monitor once one is chosen — that choice and its wiring
are not part of this sprint.

## First Deployment Checklist

Items outside this repository's control stay unchecked here by design —
checking them prematurely would be exactly the inaccuracy this gate
exists to prevent.

```text
[ ] Repository clean
[x] Correct commit (ATLAS 46.35, local == origin/master)
[x] Tests green (91 files / 1802 tests, 0 failures, 0 flakes, x2)
[x] Build green
[x] Docker build green (--no-cache, genuinely clean)
[x] Production configuration reviewed (render.yaml / .env.example /
    validate-env.js / production-secrets.ts consistent)
[ ] Database provisioned (managed Postgres, not the local dev container)
[ ] Secrets provisioned (real production values, in the platform's
    secret manager, never committed)
[ ] CORS configured (CORS_ALLOWED_ORIGINS set to the real frontend
    origin(s))
[ ] DNS configured (atlasappruntime.com.br / api.atlasappruntime.com.br
    — confirmed unregistered as of this sprint)
[ ] HTTPS active
[ ] Deployment successful
[ ] /health OK (against the real deployed URL)
[ ] /ready OK (against the real deployed URL)
[ ] Smoke test OK (ATLAS_BASE_URL=<real-url>
    node scripts/atlas-production-readiness.mjs)
[ ] Client Zero OK (against the real deployed URL — proven in
    local/containerized environments through 46.30–46.33, not yet
    against a real deployment)
[ ] Monitoring active (no platform chosen yet)
[ ] Backup verified (depends on hosting/database provider)
[x] Rollback procedure known (documented above; not drillable without a
    live deployment)
```

Checked items above mean "proven in a real, local/containerized
environment, repeatedly, through 46.30–46.35" — re-running the same
checks against the real deployed URL is still required before trusting a
real client on it.

## Go-Live Decision Gate (as of ATLAS 46.35)

`PASS` requires real, observed evidence — a local/containerized proof is
not substituted for a cloud one. `EXTERNAL/DEFERRED` means the gate
depends on infrastructure this repository does not control and cannot
provision itself.

| Gate                  | Status                                 | Evidence                                                                                               |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Repository            | PASS                                   | `local == origin/master`, working tree clean except two pre-existing files with zero real diff         |
| Tests                 | PASS                                   | 91 files / 1802 tests, 0 failures, 0 flakes, x2, via the exact CI test-job command                     |
| Type-check            | PASS                                   | `pnpm type-check` clean                                                                                |
| Lint                  | PASS                                   | `pnpm lint` clean                                                                                      |
| Build                 | PASS                                   | `pnpm build` clean                                                                                     |
| Docker                | PASS                                   | `docker build --no-cache` clean, genuinely zero reused layers                                          |
| Production boot       | PASS                                   | Real container, `NODE_ENV=production`, full secret set, boots and serves                               |
| Production URL        | EXTERNAL/DEFERRED                      | No cloud deployment exists                                                                             |
| DNS                   | EXTERNAL/DEFERRED                      | `atlasappruntime.com.br` confirmed unregistered via direct lookup                                      |
| HTTPS                 | EXTERNAL/DEFERRED                      | No domain attached to any service                                                                      |
| Database (production) | EXTERNAL/DEFERRED                      | No managed Postgres instance provisioned                                                               |
| Authentication        | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Authorization         | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Tenant isolation      | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Runtime               | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Heartbeat             | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Discovery             | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| First Job             | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| Persistence           | PASS (local/containerized only)        | Full suite; not yet proven against a real deployment                                                   |
| CORS                  | PASS (local/containerized only)        | Allowlist + production fail-loud verified; real frontend origin not yet known                          |
| Backup                | EXTERNAL/DEFERRED                      | Depends on a database provider not yet chosen                                                          |
| Restore               | EXTERNAL/DEFERRED                      | Same                                                                                                   |
| Monitoring            | EXTERNAL/DEFERRED                      | No platform chosen                                                                                     |
| Alerting              | EXTERNAL/DEFERRED                      | Same                                                                                                   |
| Rollback              | EXTERNAL/DEFERRED (drill)              | Procedure documented above; undrillable without a live deployment                                      |
| Client Zero           | EXTERNAL/DEFERRED (against production) | Proven repeatedly in local/containerized environments (46.30–46.35); not yet against a real deployment |

**Verdict: `ATLAS — GO-LIVE READY` cannot be declared.** Every gate this
repository controls is `PASS`; every remaining gate requires an account,
credential, domain registration, or provider choice that does not exist
and was not fabricated to close this table artificially.
