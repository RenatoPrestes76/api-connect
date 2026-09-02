# Atlas Connect — External Infrastructure Handoff

Written by ATLAS 46.38 (Production Infrastructure Handoff & Go-Live Lock).
This document states, exactly and objectively, what must exist **before**
the first real deploy — nothing here is provisioned yet. It is a handoff
to whoever provisions infrastructure (a human operator, or a future
sprint with real cloud access), not a status report on work already done.

Cross-reference: [`docs/deployment/production-environment-contract.md`](production-environment-contract.md)
for the full environment-variable list, [`docs/deployment/go-live-checklist.json`](go-live-checklist.json)
for the machine-readable gate list this document supports.

## Hosting

- **Service type**: Docker web service — `render.yaml` already specifies
  this (`runtime: docker`, `dockerfilePath: ./docker/Dockerfile.api`,
  `dockerContext: .`). Any host that can run an arbitrary Docker image and
  expose port `3001` (or remap it via `API_PORT`) works; Render is the
  currently-specified target but the `ProductionProvider` interface in
  `scripts/production/provider.mjs` exists so another host is a matter of
  writing one new adapter, not restructuring the pipeline.
- **Build command**: none needed at the host level — the Dockerfile does
  its own multi-stage build (`docker build -f docker/Dockerfile.api .`).
  Reproducibility already verified with `--no-cache` (46.32–46.34).
- **Start command**: the image's own `CMD` (`node apps/api/dist/index.js`,
  via the deployed `pnpm --filter=@seltriva/api deploy` output — see the
  Dockerfile itself for the exact entrypoint).
- **Health endpoint**: `GET /health` — must return `200` with
  `{"status":"healthy",...}`. Already the value of `render.yaml`'s
  `healthCheckPath`.
- **Readiness endpoint**: `GET /ready` — used by `production:preflight`'s
  Application check and `scripts/atlas-production-readiness.mjs`.
- **Region/plan**: `render.yaml` currently specifies `oregon` / `starter`
  — adjust to whatever the actual account provisions; these values are a
  specification, not a commitment already made with a provider.

## PostgreSQL

- **Requirement**: a managed PostgreSQL instance (version compatible with
  the Prisma schema in `packages/database/prisma/schema.prisma` — no
  Postgres-version-specific features are used beyond what any current
  managed offering supports).
- **SSL**: the connection string must use `sslmode=require` (or the
  provider's equivalent) — do not disable SSL for a production database.
- **`DATABASE_URL`**: supplied by the provider once created. Never a
  localhost/private-network address — `production:preflight` and
  `production:migrate` both refuse to proceed if `--production` is passed
  with a `DATABASE_URL` that resolves to a local/private hostname.
- **Migrations**: run via `pnpm production:migrate --production --yes`
  (wraps `prisma migrate deploy` only — never `migrate reset` or any
  destructive command). The two existing migrations
  (`20260824000000_init_baseline`, `20260828004554_add_runtime_registration`)
  are additive-only and safe to apply to an empty database.
- **Backup/restore procedure**: must come from the provider (e.g.
  point-in-time recovery, scheduled snapshots). This repository's own
  `modules/ha/backup-service.ts` is a local JSON-snapshot tool for
  dev/testing and is explicitly not a substitute.

## Domain

- `atlasappruntime.com.br` — the root/marketing domain.
- `api.atlasappruntime.com.br` — the API subdomain the deployed service
  must actually answer on.
- Both are confirmed **unregistered** as of this sprint (real DNS lookups
  via `scripts/production/domain.mjs`, repeated every sprint since 46.30).
  Registration is a prerequisite for every step below.

## DNS

- Once hosting exists and produces a real target (an IP or a CNAME target
  the host issues), create:
  - `api.atlasappruntime.com.br` → CNAME/A record pointing at the hosting
    provider's assigned target.
  - `atlasappruntime.com.br` → whatever the root/marketing site requires
    (out of scope for the API deployment itself).
- **Validation**: `pnpm production:domain` performs a real DNS lookup
  against both hostnames and reports PASS/DEFERRED — run it after making
  DNS changes to confirm propagation before proceeding to TLS/deploy.

## TLS

- HTTPS is mandatory for the production API — no production traffic
  should ever be served over plain HTTP.
- Most managed hosts (including Render) provision a certificate
  automatically once a custom domain is attached and DNS resolves
  correctly — this is a hosting-provider action taken after DNS, not a
  separate certificate-authority step to plan for.
- HTTP→HTTPS redirect: confirm the host enforces this (most do by
  default); if not, it must be added at the host/proxy level — this
  repository's application code does not implement its own redirect.

## Secrets

Full list and purpose in
[`production-environment-contract.md`](production-environment-contract.md).
Summary of what must be generated and where it goes:

| Secret                                     | Generate with                              | Configure in                      |
| ------------------------------------------ | ------------------------------------------ | --------------------------------- |
| `ADMIN_JWT_SECRET`                         | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `PORTAL_JWT_SECRET`                        | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `RUNTIME_JWT_SECRET`                       | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `RUNTIME_CERT_SECRET`                      | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `CONNECTOR_PACKAGE_SECRET`                 | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `MESSAGE_DELIVERY_SECRET`                  | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `SUPABASE_JWT_SECRET`                      | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `ATLAS_MASTER_KEY`                         | `openssl rand -hex 32` (64 hex chars)      | Hosting platform's secret manager |
| `CORS_ALLOWED_ORIGINS`                     | N/A — real frontend origin(s)              | Hosting platform's env vars       |
| `API_SECRET_KEY`                           | `openssl rand -hex 32`                     | Hosting platform's secret manager |
| `DATABASE_URL`                             | Issued by the PostgreSQL provider          | Hosting platform's secret manager |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Real operator-chosen bootstrap credentials | Hosting platform's secret manager |

**Never** record a real value for any of these in this repository, in any
commit, in `render.yaml`, or in `.env.example` — `render.yaml` already
marks every one of these `sync: false` for exactly this reason.

## Monitoring

Not configured — no platform chosen. Whatever is chosen must observe, at
minimum:

- Uptime of `GET /health` and `GET /ready` from outside the hosting
  network (a real external prober, not a health check the host runs
  against itself only).
- Application error rate (5xx responses).
- Latency (p50/p95/p99) on the API.
- Runtime heartbeat failures (a registered runtime going `STALE`/`OFFLINE`
  — the API already computes this state; monitoring needs to observe it,
  not recompute it).

## Alerting

Not configured — no platform chosen. Must alert on, at minimum:

- API unavailable (health check failing from an external prober).
- Readiness failure (`/ready` reporting a dependency down, e.g. database).
- Database connectivity failure.
- A registered runtime going offline unexpectedly (heartbeat loss beyond
  the expected staleness window).
- Job failure rate exceeding a threshold.

## What this repository does NOT need from you

- No code change is required to support a specific hosting provider
  beyond writing one new class implementing `ProductionProvider`
  (`scripts/production/provider.mjs`) once an account/API token exists —
  the orchestration (`production:deploy`, `production:verify`, etc.)
  already programs against that interface, not against Render
  specifically.
- No database schema change is required — the existing 2 Prisma
  migrations are complete and additive-only.
