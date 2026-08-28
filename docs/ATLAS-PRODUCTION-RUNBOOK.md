# ATLAS — Production Runbook

Operational reference for deploying, verifying, and recovering the Atlas
Connect production stack. Written from ATLAS 46.20's Production Deployment
& Runtime Readiness Gate — every claim below was verified against a real,
freshly-bootstrapped local environment (fresh Postgres volume, real process
restarts, real HTTP calls), not assumed from reading code. See
`docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md` and
`docs/ATLAS-PRODUCTION-DOMAIN.md` for the persistence and domain work this
builds on.

## Pré-requisitos

**Banco de dados**

- PostgreSQL, reachable at the `DATABASE_URL` the API process sees.
- A brand-new, empty database bootstraps deterministically from
  `packages/database/prisma/migrations/` alone — verified in this sprint by
  dropping the local dev Postgres volume entirely and running
  `prisma migrate deploy` against a genuinely fresh database (single
  migration, `20260824000000_init_baseline`, applies cleanly).
- Postgres 15+ requires the `public` schema grant fix already baked into
  `docker/postgres-init/01-grant-public-schema.sql` (auto-runs via
  `docker-entrypoint-initdb.d` on a fresh container/volume).

**Secrets** (never commit real values — see `apps/api/.env.example`)

- Required unconditionally (`packages/config`'s `getConfig()` throws at
  startup if either is missing): `DATABASE_URL`, `API_SECRET_KEY`.
- Required specifically when `NODE_ENV=production`
  (`assertProductionSecretsConfigured` /`assertProductionCorsConfigured` in
  `apps/api/src/services/production-secrets.ts`, both called from
  `apps/api/src/index.ts`'s `main()` before the server starts listening):
  `ADMIN_JWT_SECRET`, `PORTAL_JWT_SECRET`, `RUNTIME_JWT_SECRET`,
  `RUNTIME_CERT_SECRET`, `CONNECTOR_PACKAGE_SECRET`,
  `MESSAGE_DELIVERY_SECRET`, `ATLAS_MASTER_KEY`, and `CORS_ALLOWED_ORIGINS`
  (must be a real comma-separated allowlist, not unset/`*`). Each of these
  falls back to a hardcoded, source-visible dev default outside production —
  a production boot with any of them missing now fails immediately and
  loudly instead of silently signing/encrypting with a public default.

**Domínio / DNS**

- `atlasappruntime.com.br` is RESERVED, not yet registered — see
  `docs/ATLAS-PRODUCTION-DOMAIN.md` for the full domain/subdomain/DNS plan.
  Nothing in this runbook assumes it resolves.

**Configuração**

- `CORS_ALLOWED_ORIGINS` — comma-separated allowlist. Production target once
  the domain is live:
  `https://app.atlasappruntime.com.br,https://admin.atlasappruntime.com.br`.
- Per-app API base URL — each frontend reads its own existing variable
  (`ADMIN_API_URL`/`NEXT_PUBLIC_ADMIN_API_WS_URL` for apps/admin,
  `NEXT_PUBLIC_HUB_API_URL` for apps/web, `NEXT_PUBLIC_ATLAS_API_URL` for
  apps/cloud) — see `docs/ATLAS-PRODUCTION-DOMAIN.md` §2 for why these
  weren't consolidated into one name.

## Deploy

**API** (`apps/api`) — real target: Render.com, `render.yaml` at repo root,
service `seltriva-api`, Docker runtime, `dockerfilePath: ./docker/Dockerfile.api`.

1. `pnpm --filter=@seltriva/database db:generate && npx prisma migrate deploy`
   (or let the Docker build stage run `db:generate`; migrations must be
   applied against the target database before or during first boot).
2. Build the image from `docker/Dockerfile.api` (multi-stage; runs the
   compiled `dist/index.js`, not a dev server). It now has a
   container-level `HEALTHCHECK` hitting `/health` — see
   `docs/ATLAS-PRODUCTION-DOMAIN.md` §9.
3. Set the `sync: false` env vars in the Render dashboard (never commit
   them): `CORS_ALLOWED_ORIGINS`, `API_SECRET_KEY`, `DATABASE_URL`,
   `ATLAS_MASTER_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — plus the
   other six production-only secrets listed above (not yet in `render.yaml`;
   add them there or in the dashboard before a real production cutover).
4. Deploy. Render's `healthCheckPath: /health` gates traffic on a healthy
   response.

**Admin / App / Docs** (`apps/admin`, `apps/web`, `apps/docs`) — Vercel,
via each app's `vercel.json` (`buildCommand`/`ignoreCommand`, gated to the
`master` branch). Set each app's API-base-URL variable(s) in its Vercel
project settings (see Pré-requisitos above). `next build && next start` is
the production path — verified in this sprint (not `next dev`).

## Smoke test

Run `node scripts/atlas-production-readiness.mjs --api-url=<deployed API URL>`
against a running instance (with `DATABASE_URL`/`API_SECRET_KEY` in the
invoking shell's env, and `NODE_ENV=production` set if checking a real
production target). It prints one line per check and a final verdict:

```
ATLAS PRODUCTION READINESS: PASS
```

or

```
ATLAS PRODUCTION READINESS: BLOCKED (<n> check(s) failed)
```

It checks, in order: production build artifact present, environment
(required vars, and production secrets/CORS when `NODE_ENV=production`),
database migrations up to date, `/health`, `/ready`, authentication
(unauthenticated request rejected, authenticated request succeeds),
persistence (create-then-reread a tenant), tenant isolation (two tenants,
each organization list correctly excludes the other tenant's org — self-
cleaning, deletes everything it creates), and CORS. It cannot print PASS
while any check above failed — verified in this sprint by deliberately
forcing both a real and a simulated failure and confirming BLOCKED.

Manual equivalents, if you want to check by hand:

- **health**: `curl <API_URL>/health` → `{"status":"healthy",...}`
- **readiness**: `curl <API_URL>/ready` → `{"status":"ready",...}`
- **login**: `POST <API_URL>/admin/auth/login` with the seeded/real admin
  credentials → `200` with an `accessToken`.
- **tenant**: `GET <API_URL>/admin/control-plane/tenants` with that token →
  `200` with the seeded tenants (Acme Corp / TechVentures / StartupXYZ, or
  your production data).
- **organization**: `GET <API_URL>/admin/control-plane/organizations` →
  `200`.
- **runtime**: see "Runtime Readiness" below — there is currently no real
  Runtime client to smoke-test end-to-end; only the API side of the
  enrollment protocol is production-ready.

## Rollback

- **Application**: Render keeps prior deploys — roll back to the previous
  successful deploy from the Render dashboard. Vercel keeps prior
  deployments per-app the same way.
- **Versão**: `git revert` the offending commit(s) on `master` rather than
  force-pushing; redeploy from the reverted commit.
- **Banco de dados**: this project's migrations are additive-only so far
  (one baseline migration, no destructive changes yet). Before any future
  destructive migration ships, a corresponding down-migration or a tested
  backup/restore procedure must exist first — none was needed or created in
  this sprint. Never run `prisma migrate reset` against a database holding
  real tenant data.
- **Aplicação vs. banco**: because the API refuses to boot in production
  with an incomplete secret/CORS config (see Pré-requisitos), a bad config
  deploy fails at startup rather than serving degraded traffic — roll back
  the deploy, not the database, for a config-only incident.

## Troubleshooting

**Database**

- `relation "X" does not exist"` on a fresh deploy → migrations weren't
  applied; run `prisma migrate deploy` (not `db push`) before first boot.
- Prisma boot error mentioning `libssl.so.1.1` inside the container → the
  binary target mismatch this repo already fixed
  (`packages/database/prisma/schema.prisma`'s `binaryTargets` includes
  `linux-musl-openssl-3.0.x` for `node:24-alpine`) — confirm the image was
  actually rebuilt after that fix, not a stale cached layer.
- Postgres 15+ `permission denied for schema public` on a brand new
  database → the grant fix in `docker/postgres-init/01-grant-public-schema.sql`
  only runs on container-init of a genuinely empty volume; run
  `GRANT ALL ON SCHEMA public TO <db user>;` manually if provisioning a
  managed Postgres instance that doesn't run that init script.

**CORS**

- Browser console shows a CORS rejection in production → confirm
  `CORS_ALLOWED_ORIGINS` is set to the exact origin(s) calling the API
  (scheme + host, no trailing slash), comma-separated, no spaces around
  commas beyond what `.trim()` in `router.ts` already tolerates. The API
  refuses to boot in production if this is unset or `*` (Fase 3 gate).
- Only the first configured origin ever gets a valid response in
  production → this was a real bug (fixed in the ATLAS Domain Bootstrap
  work — see `docs/ATLAS-PRODUCTION-DOMAIN.md` §3): `json()` now reads the
  actual request's `Origin` header, not just the OPTIONS preflight. If this
  regresses, check `apps/api/src/http/router.ts`'s `json()`.

**Auth**

- `401` on every admin request → check the `Authorization: Bearer <token>`
  header is present and the token hasn't expired (15-minute access tokens;
  use the refresh token flow, `POST /admin/auth/refresh`).
- Production boot fails with "Refusing to start in production with
  hardcoded dev secrets" → exactly one or more of the seven
  `*_SECRET`/`ATLAS_MASTER_KEY` vars is unset in that environment; the error
  message names every missing one.

**Runtime** (see full findings below)

- There is currently no real client process for the Ed25519
  `runtime-registration` module (`POST /runtime/register`) — if a real
  on-premise Runtime is expected to enroll and none does, this is not a
  config problem, it's the known gap documented below. Don't spend time
  debugging network/DNS for a Runtime client that doesn't exist yet.
- `apps/agent`'s only real network call
  (`POST /api/v1/agents/register`) and `apps/runtime-installer`'s
  (`POST /api/v1/activate`) are two separate, older enrollment paths, not
  the same protocol — don't conflate their failures with the
  `runtime-registration` module's.

**DNS**

- See `docs/ATLAS-PRODUCTION-DOMAIN.md` — the domain isn't registered yet,
  so any DNS troubleshooting is necessarily hypothetical until then. Once
  registered, attach the custom domain in Render's dashboard first (it
  provides the exact CNAME target) before creating any DNS record.

## Runtime Readiness (Fase 11)

Investigated by tracing every code path, not by re-reading prior
documentation. Three separate, non-integrated Runtime/agent enrollment
surfaces exist in this repo:

1. **`apps/agent` ("Sentinel")** — almost entirely type-only scaffolding
   (`export type {...}` across bootstrap/security/connectors/sync/etc.).
   Its one real network call is `POST {SELTRIVA_CLOUD_URL}/api/v1/agents/register`
   (`apps/agent/src/bootstrap/bootstrapper.ts`), landing at
   `apps/api/src/routes/v1/agents.ts`.
2. **`apps/runtime-installer`** — `POST /api/v1/activate`
   (`apps/runtime-installer/src/activation/registration.ts`), backed by
   `packages/agent-identity` + `packages/agent-provisioning` +
   `packages/activation` — the older "AtlasAgent"/"Runtime Token" system
   feeding `apps/cloud`'s dashboards.
3. **The Ed25519 `runtime-registration` module** (`apps/api/src/modules/runtime-registration/`) —
   this is the one that actually implements "Runtime → GENESIS → ATHENA →
   Atlas": `POST /runtime/register` (activation-key + Ed25519 keypair →
   certificate), `POST /runtime/heartbeat` (signed, replay-protected),
   discovery via `erp-metadata` (`POST /erp-metadata/discover` →
   `GET /erp-metadata/runtime/jobs` → `POST /erp-metadata/runtime/result`,
   which runs the raw schema through **GENESIS** — `packages/database-sdk`,
   real `pg`/`mysql2`/`mssql` drivers — and **ATHENA** — `DatabaseScanner`
   from `packages/database-intelligence` — before landing in
   `semantic-mapping`/`canonical-model`). Tenant/organization identity is
   explicit and enforced (`organizationCode` at registration →
   `organizationId` JWT claim → cross-checked on every discovery action,
   rejecting cross-org access with `RUNTIME_ORGANIZATION_MISMATCH`/`RUNTIME_MISMATCH`).

**The gap**: surface 3 — the only one that matches the "Runtime → GENESIS →
ATHENA → Atlas" flow this sprint was asked to validate — has **no real
client anywhere in this repo**. Its only caller is test code
(`apps/api/src/__tests__/runtime-registration/helpers.ts`, exercised by
`enrollment-discovery-e2e.test.ts`). Neither `apps/agent` nor
`apps/runtime-installer` calls `/runtime/register`, `/runtime/heartbeat`,
or `/erp-metadata/runtime/*`.

**What this means for production readiness**: the _API side_ of this flow
is genuinely production-ready — real Ed25519 signing/verification, replay
protection, tenant-scoped discovery, ATHENA classification, all covered by
a real E2E test. The _client side_ does not exist yet. A first real
customer deployment cannot rely on an actual Runtime process enrolling
itself against this protocol today — either a Runtime client needs to be
built (a new feature, explicitly out of this sprint's scope), or the first
customer's actual enrollment path is one of the two older surfaces
(`apps/agent` or `apps/runtime-installer`), which should be confirmed with
whoever owns the customer onboarding plan. This is recorded here as a
**blocker for a scenario that depends on the Ed25519 Runtime flow
specifically** — it is not a regression introduced by this sprint, and no
new Runtime client architecture was invented to paper over it.

Two independent heartbeat/staleness mechanisms also coexist without
integration: `runtime-registration`'s heartbeat records `lastHeartbeat` with
no staleness computation, while the older `apps/api/src/routes/v1/atlas/heartbeat.ts`
(backed by `@seltriva/agent-observability`) has real ONLINE/STALE/OFFLINE
threshold logic. Neither was changed in this sprint (no gap fix was small,
local, and safe enough to justify — this is noted as a reservation, not
fixed here).

> **Update (ATLAS 46.20-B):** the gap above is closed. A real client for
> surface 3 now exists at `apps/agent/src/atlas-runtime-client/`, wired
> into `apps/agent`'s bootstrap as an additive, opt-in second enrollment
> path. See the "Runtime Enrollment" section below and
> `docs/ATLAS-RUNTIME-CLIENT.md` for the full detail. The heartbeat
> reservation above still stands unchanged — 46.20-B intentionally did not
> merge the two mechanisms.

## Runtime Enrollment (ATLAS 46.20-B, canonicalized in 46.21)

**ATLAS 46.21 declared this the official, canonical onboarding path** for
a first Atlas customer — see `docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`
for the full decision, `docs/ATLAS-RUNTIME-ONBOARDING-MATRIX.md` for the
evidence, and `docs/ATLAS-HEARTBEAT-ARCHITECTURE.md` for why its heartbeat
(not `atlas/heartbeat.ts`) is the heartbeat of record. Two other enrollment
surfaces exist (`apps/agent`'s original cloud registration — currently
broken; `apps/runtime-installer` — working, but a separate product surface
feeding `apps/cloud`'s dashboard) and neither was touched or merged.

**New in 46.21**: the Organization a Runtime registers under
(`portal-identity`'s `OrganizationRecord`, resolved from
`ATLAS_ORGANIZATION_CODE`) is now automatically linked, at portal
registration time, to a real Postgres-persisted Control Plane `Organization`
(`controlPlaneOrganizationId`). An admin can look up every Ed25519 Runtime
registered under a real Control Plane Organization via
`GET /admin/control-plane/organizations/:id/runtimes` — previously there
was no way to cross-reference the two.

The real Runtime client lives at `apps/agent/src/atlas-runtime-client/` —
full detail in `docs/ATLAS-RUNTIME-CLIENT.md`. Summary for operational use:

**Geração da identidade**: on first run, the client generates an Ed25519
keypair + a machine fingerprint and persists them at
`<data_dir>/atlas-runtime-identity.json`. The private key never leaves that
file — it's never transmitted (only the public key is, at registration)
and never logged. Subsequent runs reuse the same identity.

**Registration**: `ATLAS_API_URL` + `ATLAS_ORGANIZATION_CODE` +
`ATLAS_ACTIVATION_KEY` (a single-use key from
`POST /admin/runtime-registration/activation-keys`) → `POST /runtime/register`
→ a `runtimeId` is assigned and persisted alongside the identity. Missing
any of the three required env vars skips this path entirely (non-fatal,
same as the existing `SELTRIVA_CLOUD_URL` gate) rather than failing agent
startup.

**Heartbeat**: an Ed25519-signed `POST /runtime/heartbeat` — promotes the
Runtime from `REGISTERED` to `ACTIVE` on Atlas's side. Uses
`runtime-registration`'s own heartbeat, not the older
`atlas/heartbeat.ts`/`agent-observability` mechanism (see the reservation
above).

**Discovery**: after obtaining a short-lived JWT (`POST /runtime/auth/token`,
also Ed25519-signed), the client polls `GET /erp-metadata/runtime/jobs`
(Bearer auth) for any discovery job Atlas assigned to it.

**Job execution**: for each claimed job, the client runs a real GENESIS
(`@seltriva/database-sdk`'s `PostgresDriver`) schema introspection against
the database configured via `ATLAS_SCAN_DB_*` env vars — no fixture, no
new ERP engine.

**Result**: `POST /erp-metadata/runtime/result` (Bearer auth) with the real
introspected schema. Atlas runs it through ATHENA (`DatabaseScanner`)
server-side automatically — nothing further required from the client.

**Troubleshooting**: see `docs/ATLAS-RUNTIME-CLIENT.md`'s Troubleshooting
section for the specific error codes (`ACTIVATION_KEY_ALREADY_USED`,
`INVALID_SIGNATURE`, `REPLAY_REJECTED`, etc.) and what each one means.

## Security Baseline (Fase 12)

- **Secrets in code**: none found — scanned for common key/private-key
  patterns across the monorepo; only source-visible _dev-default fallback
  strings_ exist (by design, and blocked from reaching production by the
  Fase 3 gate above).
- **Secrets in logs**: `requestLogger` (`apps/api/src/server.ts`) logs only
  `requestId`/`method`/`url`/`durationMs` — never the request body, so
  login payloads (passwords) are never logged. `/health`/`/ready` never
  include `DATABASE_URL` or any secret value in their response bodies
  (spot-checked directly).
- **Internal URLs exposed**: none — see
  `docs/ATLAS-PRODUCTION-DOMAIN.md` §11 for the full hardcoded-URL audit
  (nothing production-blocking).
- **Stack traces**: `withErrorBoundary` (`apps/api/src/server.ts`) converts
  any uncaught error into a generic response, never the real message/stack
  — covered by `apps/api/src/__tests__/health/error-boundary.test.ts` and
  reconfirmed by this sprint's new `http-production-gate.test.ts`.
- **Excessive permissions**: admin routes are gated by
  `requirePermission(...)` per-permission (e.g. `companies.read`/
  `companies.write`), not a single blanket admin flag — spot-checked on
  the Control Plane routes.
- **Unauthenticated admin endpoints**: none found — every
  `/admin/control-plane/*` route checked in this sprint's new production
  gate test returns `401` with no credentials.
- **Permissive CORS**: closed this sprint — production can no longer boot
  with an open/unset `CORS_ALLOWED_ORIGINS` (Fase 3/8).
- **Tenant bypass**: none found — see Fase 6/11 above; cross-tenant reads
  are excluded at the repository-query level, proven by both the 46.19 test
  suite and this sprint's live readiness-script check.
- **Insecure production config**: closed this sprint for secrets and CORS;
  `render.yaml` already marks real secrets `sync: false` (dashboard-only,
  never committed).

No new "Production Safety Gate", "Shadow Mode", or "Authorization Guard"
component was invented — the existing `assertProductionSecretsConfigured`/
`assertProductionCorsConfigured` pair (extended, not replaced, this sprint)
and the existing `requirePermission` middleware already cover this ground
under their established names.
