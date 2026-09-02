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

## Deployment Status (as of ATLAS 46.34)

Checked directly — not assumed — via `docs/ATLAS-PRODUCTION-DOMAIN.md`'s
own status line, a search for any real `.onrender.com` reference in this
repository, and `render.yaml`'s content. Result: **no real cloud
deployment exists yet.**

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
46.34 section for the full evidence trail behind this status.

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
[x] Correct commit (ATLAS 46.33, local == origin/master)
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
environment, repeatedly, through 46.30–46.33" — re-running the same
checks against the real deployed URL is still required before trusting a
real client on it.
