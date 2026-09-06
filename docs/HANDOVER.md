# Atlas — Handover

Written so another developer can take over Atlas with an accurate mental
model on day one. No secrets included anywhere below.

## What Atlas is, in one paragraph

Atlas connects a customer's on-premise ERP database to a hosted platform
via a locally-installed Runtime agent (Ed25519-authenticated). The
backend (`apps/api`) discovers the ERP's schema, classifies it into a
canonical business model, and lets authorized operations (reads, and a
small set of governed writes like price markdowns) run against it — while
also hosting a large operational surface (security/compliance dashboards,
fleet ops, billing, connector marketplace, an AI-assisted workflow
builder) built incrementally, much of it still in-memory rather than
database-backed. Read `docs/ARCHITECTURE.md` first — its
"Persistence Reality" table is the single fact most likely to surprise a
new developer.

## Running locally

```bash
pnpm install
docker compose up -d          # postgres (5433) + redis (6379, unused by app code)
pnpm --filter @seltriva/database db:generate
cd packages/database && npx prisma migrate deploy
pnpm build
pnpm --filter @seltriva/api dev
```

Required env vars for a working local boot: `DATABASE_URL`,
`API_SECRET_KEY`. See `docs/deployment/production-environment-contract.md`
for the complete, categorized list (Required / Required for Client Zero /
Optional / External) — never put a real secret value in any file, commit,
or `.env.example`.

## Structure

- `apps/api/src/http/router.ts` — custom router (not Express).
- `apps/api/src/middleware/` — 5 independent auth mechanisms; read
  `docs/api/API-CATALOG.md`'s "Global authentication architecture" before
  touching any of them.
- `apps/api/src/modules/` — 37 business-logic modules. **Check
  `docs/ARCHITECTURE.md`'s persistence table before assuming
  any module is Postgres-backed** — only 3 are.
- `apps/api/src/routes/v1/` — 267 route files, one directory per module
  (roughly).
- `packages/database/prisma/schema.prisma` — the single source of truth
  for `apps/api`'s database schema (41 models, 2 migrations, both
  additive-only).

## Database

- Real migrations exist (`packages/database/prisma/migrations/`) —
  always use `prisma migrate dev`/`deploy`, never `db push` for schema
  changes going forward.
- 29 of 41 models have zero runtime consumer today — don't assume a
  model existing means a module uses it; grep for `prisma.<model>` to
  confirm.
- `apps/cloud` has its own, separate database and a manually-maintained
  subset schema — unrelated to Atlas, don't conflate the two when
  searching for "the" Organization model.

## APIs

- Full inventory: `docs/api/API-CATALOG.md`. 583 total routes.
- Two tenant-scoping primitives exist with an explicit safety
  distinction baked into the code itself: `requireOrgId(ctx)` (safe,
  session-derived) vs. `requireTenantId(ctx, ...)` (client-suppliable,
  documented as unsafe for authorization — its own doc comment explains
  why). **Always use `requireOrgId` for anything returning or mutating
  tenant-owned data.**

## Runtime enrollment

`apps/agent`'s Runtime client uses Ed25519 signing for every write to the
backend (registration, heartbeat, job/message/execution results) — see
`docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md` for why this is a
separate flow from the two legacy agent-enrollment paths
(`AtlasAgent`/Runtime Installer, and the real-Postgres `Agent`
fleet-management concept) rather than a unification of all three.

## Discovery, secrets

- ERP connection profiles: `modules/erp-connectivity` (in-memory,
  AES-256-GCM encrypted credentials).
- Schema discovery: `modules/erp-metadata` (in-memory, checksum-gated
  reclassification).
- Platform secrets (unrelated domain, same encryption library):
  `modules/security/security-store.ts` — envelope-encrypted, automatic
  rotation scheduler, 110+ dedicated cross-tenant BOLA tests.

## Security

Read `docs/security/SECURITY-AUDIT.md` in full before making any
authorization-related change. Two real cross-tenant vulnerabilities were
found and fixed in this audit cycle (Organization/Agent/Plugin routes);
one class of lower-severity findings was deliberately left undecided
pending a product decision about staff/tenant delegation scoping — read
that reasoning before assuming it needs an immediate fix.

## Tests

- `pnpm test` (or `pnpm --filter @seltriva/api test`) — 92 files, 1,822
  tests, real Postgres required (`docker compose up -d`).
- Several tests require a real Docker image tagged `atlas-api:docker-test`
  to exist — build it once with
  `docker build -f docker/Dockerfile.api -t atlas-api:docker-test .`
  before running the suite locally, or they'll skip cleanly (not fail)
  if it's absent.
- If you see a transient timeout under heavy local load (Docker/Postgres
  contention), re-run the specific file in isolation before assuming a
  regression — this has happened repeatedly across this project's history
  and is a known, documented pattern (`docs/security/SECURITY-REGRESSION-REPORT.md`'s
  "Flake note").

## CI

`.github/workflows/ci.yml` — `build`, `test`, `security` jobs, triggers
correctly on `master`. The `security` job never blocks a merge
(`continue-on-error: true`) — a deliberate, still-open decision, not an
oversight; see `docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md` GAP-06.

## Deploy

`docs/deployment/production-first-deployment.md` is the canonical guide.
`scripts/production/*.mjs` automate preflight/deploy/migrate/verify/
client-zero/rollback/domain checks, all fail-loud. Production
infrastructure (hosting, managed Postgres, domain/DNS/TLS, monitoring,
alerting, backups) is external and not present in this repository — see
`docs/deployment/external-infrastructure-handoff.md` for exactly what's
needed before a real go-live.

## Known risks / technical backlog (do not treat as urgent without re-reading the reasoning)

See `docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md` for the full,
prioritized list. Top three: (1) authorization model decision for
staff-gated cross-tenant routes and the legacy unauthenticated `/admin/*`
surface, (2) HA restore's misleading per-tenant-looking signature that's
actually global, (3) a dependency residual (Vitest's own internal `vite`)
that requires a coordinated major-version migration, deliberately not
forced in this audit after doing so twice broke the test runner.

## Architectural decisions worth knowing before you "fix" something

- In-memory-first, Postgres-later is a deliberate, repo-wide convention
  — not every module needing real persistence is a bug to fix reflexively.
- `requireTenantId` still exists and is still used in 3 files — this is
  fine; each use was individually re-verified in this audit to be safe
  (attribution-only or dead-code historical reference, never an
  authorization check).
- The onboarding wizard's "provisioning" is fully simulated by design at
  this stage — don't assume a customer who completes it has a real tenant
  until real provisioning logic is built.
