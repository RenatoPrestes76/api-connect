# Atlas — Operations

What actually exists today for running and observing Atlas in production
— no aspirational tooling included.

## Health & readiness (real)

- `GET /health` — process + database check via `pingDB()` (a real
  `SELECT 1` round-trip, not a connection-cache no-op — fixed in a prior
  sprint after a real mid-life-outage false-positive was found and
  proven with a real Docker test).
- `GET /ready` — dependency readiness (database; cache/queues report
  `not_configured` honestly, since Redis is provisioned but unused —
  see `docs/ARCHITECTURE.md`).
- `GET /live` — pure liveness, no dependency checks.
- All three also exist under `/api/v1/{health,ready,live}`.

## Logging (real)

- Structured JSON via `@seltriva/logger`, `X-Request-Id` correlation on
  every request/response pair (generated if the caller doesn't supply
  one, echoed back if they do).
- Log levels: debug/info/warn/error.

## Graceful shutdown (real, verified)

- `SIGTERM`/`SIGINT` → `server.close()` → `disconnectDB()` →
  `process.exit(0)`, 10s forced-exit fallback.
- Verified via a real Docker container + real `docker stop` (genuine
  POSIX SIGTERM), not a simulation — confirmed clean exit in ~1.3s.

## Fail-loud production secrets gate (real, verified)

- `services/production-secrets.ts` refuses to boot in `NODE_ENV=production`
  if any of 8 required secrets, or `CORS_ALLOWED_ORIGINS`, is missing —
  confirmed via a real container boot test, not just a unit test of the
  assertion function.

## Backup / restore (real code, external-infrastructure-dependent)

- `modules/ha/backup-service.ts` writes real JSON snapshot files to
  `.data/backups/<id>.json` with SHA-256 checksum verification on
  restore. **Confirmed limitation** (Finding GAP-09): restore is not
  actually tenant-scoped — it replaces the entire in-memory
  `ControlPlaneStore` state platform-wide, despite the API accepting a
  `tenantId` parameter. Real Postgres data (`Tenant`/`Organization`/
  `RuntimeRegistration`/`ErpIntegration`) is **not** covered by this
  backup mechanism at all — it needs the hosting platform's own managed
  database backup, which is external infrastructure not present in this
  repository (see `docs/deployment/external-infrastructure-handoff.md`).

## Monitoring / alerting (not real — explicitly documented as such)

`modules/prometheus` and `modules/observatory` present a fully-featured
dashboard UI backend (traces, incidents, SLOs, capacity planning, cost
reports), but every one of these is 100% in-memory, hardcoded demo/seed
data — confirmed via this audit's module inventory (zero `prisma.` calls,
literal hardcoded dates like `2026-07-11`). **This is not live monitoring
of the real system** — it is UI/API scaffolding for a future real
integration. Real external monitoring/alerting requires infrastructure
outside this repository — see
`docs/deployment/external-infrastructure-handoff.md`'s Monitoring/
Alerting sections for exactly what's needed.

## Deployment (real, automated)

- `docker/Dockerfile.api` — multi-stage, reproducible (`--no-cache`
  verified in prior sprints), pnpm-deploy-based, correct Prisma
  binary-target for Linux musl+OpenSSL 3.
- `scripts/production/*.mjs` — `production:preflight`, `production:deploy`,
  `production:migrate`, `production:verify`, `production:client-zero`,
  `production:rollback`, `production:domain`, `production:dry-run`. Every
  one fail-loud (refuses local DATABASE_URL/localhost under
  `--production`, never fabricates a PASS for infrastructure that doesn't
  exist). Full contract in
  `docs/deployment/production-first-deployment.md`.

## Runbook / incident history

`docs/ATLAS-PRODUCTION-RUNBOOK.md` — one section per ATLAS sprint,
append-only, never rewritten. Includes the real admin-login-lockout
incident (session/audit fix, this audit's SEC-001 prerequisite) and every
prior production-readiness sprint's findings.

## Known operational risks (see full detail in `docs/security/SECURITY-AUDIT.md` and `docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md`)

- A process restart resets 34 of 37 business-logic modules to seed/empty
  state (in-memory by design — see `docs/ARCHITECTURE.md`'s
  "Persistence Reality" table). Anyone operating Atlas needs to know this
  before assuming any of those domains' data survives a redeploy.
- No external monitoring/alerting/managed-backup exists yet — genuinely
  requires infrastructure outside this repository, not a code change.
