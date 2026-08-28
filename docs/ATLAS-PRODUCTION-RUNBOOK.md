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

> **ATLAS 46.24 re-audit**: the secret/CORS validation above was re-checked
> against everything the canonical onboarding flow (signup → Organization →
> Tenant → activation key → Runtime → heartbeat → ONLINE → ERP discovery →
> GENESIS → ATHENA) actually touches. No new secret-bearing config was
> introduced by 46.22/46.23/46.24 — `RUNTIME_JWT_SECRET`/`RUNTIME_CERT_SECRET`
> already covered the Ed25519/JWT surface, liveness thresholds and Activation
> Key data are not secrets. This list is confirmed complete for onboarding a
> first real client, not just re-asserted.
>
> **ATLAS 46.25 re-audit**: re-checked again against the new operational
> surface (list filters, `GET .../summary`, the `requestLogger` status-code
> fix — see "Runtime Incident Troubleshooting" below). Nothing new needs a
> secret: filters/summary are read-only derivations of already-persisted,
> non-secret data, and the logging fix only adds an HTTP status code to an
> existing log line.

**Domínio / DNS**

- `atlasappruntime.com.br` is RESERVED, not yet registered — see
  `docs/ATLAS-PRODUCTION-DOMAIN.md` for the full domain/subdomain/DNS plan.
  Nothing in this runbook assumes it resolves. Re-confirmed unchanged as of
  ATLAS 46.24 — no domain/deploy action was taken or simulated this sprint.
  Re-confirmed again, still unchanged, as of ATLAS 46.25 — classified
  **BLOCKED EXTERNAL INFRASTRUCTURE**, not a code blocker: nothing in this
  sprint's operational surface (summary, filters, troubleshooting runbook)
  depends on the domain being registered.

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

> **Update (ATLAS 46.22):** the Runtime identity this client registers is
> now Prisma-backed (`RuntimeRegistration` model), not in-memory — a real
> API process restart no longer loses any Runtime's registration state.
> See "Runtime Registration Persistence" under "Runtime Enrollment" below.
> The heartbeat ONLINE/STALE/OFFLINE reservation from 46.20-B still stands
> unchanged — 46.22 persists the raw heartbeat fields but explicitly does
> not build staleness computation.

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

### Runtime Registration Persistence (ATLAS 46.22)

The Runtime identity registered above (`RuntimeRegistration` Prisma
model) is durable across Atlas API restarts — an operational change from
the state described earlier in this doc's Runtime Readiness findings.
Operationally:

- **A rolling/manual restart of the Atlas API does not require any
  currently-enrolled Runtime to re-register.** The client's own identity
  file is unaffected either way, but previously the server-side record
  would have been lost on restart; now it persists. Proven with a real
  spawned/killed/restarted `node dist/index.js` process in
  `apps/api/src/__tests__/runtime-registration/restart-durability-e2e.test.ts`.
- **`machineFingerprintHash` and `publicKey` are both unique at the
  database level.** Two Runtimes can never end up sharing either value,
  even under concurrent registration attempts — this is enforced by
  Postgres, not just application code.
- **Tenant provisioning for self-service signups is still an external,
  undecided product policy.** A freshly self-service-registered
  Organization has `tenantId = null` (PENDING TENANT ASSIGNMENT) until an
  admin explicitly assigns a real Tenant via
  `PATCH /admin/control-plane/organizations/:id`. Atlas does **not**
  auto-create a Tenant at signup, and does not use any placeholder/default
  Tenant id. See `docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`'s "ATLAS
  46.22 — Runtime Registration Persistence" section for the full design.
- **Migration**: `packages/database/prisma/migrations/20260828004554_add_runtime_registration/`
  — additive only (new table, new enum, new FK to `Organization`), no
  data loss on either an empty or an already-populated database.

### Runtime Liveness (ATLAS 46.23)

Every Runtime read (admin list/detail, the 46.21 Control Plane
organization-runtimes lookup, and the `POST /runtime/heartbeat` response
itself) now carries a `liveness` field — `ONLINE` / `STALE` / `OFFLINE` —
alongside the existing `status` field, which keeps its pre-46.23 meaning
unchanged. Operationally:

- **ONLINE**: last heartbeat within 60 seconds (2x the default 30s
  heartbeat cadence).
- **STALE**: last heartbeat between 60 seconds and 5 minutes ago — known,
  registered, just not currently reachable. The 5-minute boundary reuses,
  unchanged, the `maxHeartbeatGapMs` policy value already returned to
  every Runtime at registration time — not a new threshold invented this
  sprint.
- **OFFLINE**: last heartbeat more than 5 minutes ago, or no heartbeat was
  ever recorded at all.
- **No new operational surface to monitor**: liveness is computed fresh on
  every API read directly from `RuntimeRegistration.lastHeartbeat` — there
  is no cache, no background job, and nothing that can drift or need
  restarting on its own. A restarted Atlas API computes the identical
  liveness a still-running one would, from the same Postgres row.
- **STALE/OFFLINE alerting/paging is still out of scope** — this sprint
  makes the classification available on read; it does not add a
  notification, dashboard widget, or scheduled sweep. That remains future
  work, same reservation carried since 46.20-B/46.21's heartbeat
  architecture notes.

See `docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`'s "ATLAS 46.23" section
for the full threshold rationale and
`apps/api/src/modules/runtime-registration/liveness.ts` for the
implementation.

### Tenant Onboarding Boundary (ATLAS 46.23)

Formalizes, without changing, 46.22's Tenant association design:
`PATCH /admin/control-plane/organizations/:id` **is** the one and only
Tenant-provisioning point in the system today — explicit, admin-controlled,
never automatic. Confirmed and tested this sprint:

- Reassigning an Organization's Tenant propagates to its Runtime(s)
  immediately (derived, no Runtime row write).
- Removing an Organization's Tenant (`tenantId: null`) returns it to a
  legitimate PENDING_TENANT_ASSIGNMENT state — never a fallback/default
  Tenant.
- No client-supplied `tenantId` anywhere in the Runtime registration or
  lookup surface can influence ownership — there is no such field to
  supply in the first place.

**Whether/when a self-service signup should automatically receive a
Tenant remains an external product decision**, not made by 46.22 or
46.23.

## First Client Onboarding Runbook (ATLAS 46.24)

A step-by-step walkthrough for onboarding a real first client, written so
someone can execute it from this document alone, with no prior knowledge of
the codebase. Every step below is proven, end to end, by
`apps/api/src/__tests__/runtime-registration/client-zero-onboarding-e2e.test.ts`
(fast, in-process) and, with a real API process restart spliced in, by
`restart-durability-e2e.test.ts`. No secret value appears anywhere below.

### 1. Pré-requisitos

- Atlas API reachable and healthy (`GET /health` returns 200) — see
  "Pré-requisitos"/"Deploy" above.
- A super-admin credential to call the `/admin/*` endpoints below (seed
  admin in dev; a real admin account in production).

### 2. Criação do cliente (signup)

```
POST /api/v1/portal/auth/register
{
  "name": "<company display name>",
  "razaoSocial": "<legal company name>",
  "cnpj": "<company tax id>",
  "internalCode": "<a short, unique organization code you choose>",
  "plan": "professional",
  "owner": { "name": "...", "email": "...", "password": "..." }
}
```

This immediately creates a real, Postgres-persisted Control Plane
`Organization`, linked via `controlPlaneOrganizationId` — not a fixture, not
in-memory-only.

### 3. Confirmar Organization (sem Tenant ainda)

```
GET /admin/control-plane/organizations?<filter by the slug you chose>
```

Expect `tenantId: null` — this is the correct, legitimate
PENDING_TENANT_ASSIGNMENT state, not an error to fix.

### 4. Associação do Tenant

Create a real Tenant (or reuse an existing one this customer belongs to),
then associate it explicitly:

```
POST  /admin/control-plane/tenants           { "name": "...", "slug": "..." }
PATCH /admin/control-plane/organizations/:id { "tenantId": "<the Tenant id>" }
```

Confirm: `GET /admin/control-plane/organizations/:id` now shows the
assigned `tenantId`.

### 5. Geração da Activation Key

```
POST /admin/runtime-registration/activation-keys
{ "organizationCode": "<the internalCode from step 2>" }
```

Single-use — hand the returned `code` to whoever is installing the Runtime.
It only works for this exact `organizationCode`; see "Security" below.

### 6. Instalação/configuração do Runtime

On the customer's machine, set (see `docs/ATLAS-RUNTIME-CLIENT.md` for the
full reference):

```
ATLAS_API_URL=<the real Atlas API base URL>
ATLAS_ORGANIZATION_CODE=<the internalCode from step 2>
ATLAS_ACTIVATION_KEY=<the code from step 5>
ATLAS_SCAN_DB_HOST / _PORT / _NAME / _USER / _PASSWORD=<the customer's ERP database>
```

Then run `apps/agent` (or its bootstrap, if embedded in a larger install).
The Runtime generates its own Ed25519 identity locally — the private key
never leaves that machine.

### 7. Primeiro heartbeat

Happens automatically after registration, on the interval Atlas returned at
registration time (`heartbeatInterval`, 30s default). No manual action
needed.

### 8. Confirmação ONLINE

```
GET /admin/runtime-registration/runtimes/:runtimeId
```

Check `runtime.status` is `ACTIVE` and `runtime.liveness` is `ONLINE`. The
same response now also includes `organization` and `tenant` summaries
(ATLAS 46.24) — confirm they match steps 2/4, closing the loop without
extra lookups.

### 9. ERP discovery

An admin creates a connection profile and requests discovery:

```
POST /erp-connectivity/profiles      { runtimeId, organizationId, ... }
POST /erp-metadata/discover          { runtimeId, organizationId, profileId }
```

The Runtime polls, claims, and executes the scan automatically.

### 10. Confirmação GENESIS

```
GET /erp-metadata/discover/:requestId   (or list, filtered)
```

Expect `status: "COMPLETED"` once the Runtime reports back.

### 11. Confirmação ATHENA

```
POST /semantic-mapping/analyze     { profileId }
GET  /semantic-mapping/entities?profileId=...
POST /semantic-mapping/approve     { profileId, schema, table, decision: "APPROVE" }
```

Classified entities appear from the `GET`; approving them is the last
manual step before this ERP's data participates in the canonical model.

### 12. Validação de isolamento

Before considering onboarding complete for a client sharing infrastructure
with others, spot-check:

- `GET /admin/control-plane/organizations/:id/runtimes` for this
  Organization never includes another Organization's Runtime.
- The Activation Key issued in step 5 cannot be reused with a different
  `organizationCode` (`ACTIVATION_KEY_INVALID` if attempted).

See `apps/api/src/__tests__/runtime-registration/onboarding-isolation.test.ts`
for the automated proof of both.

### 13. Troubleshooting

See `docs/ATLAS-RUNTIME-CLIENT.md`'s Troubleshooting section for
`ACTIVATION_KEY_ALREADY_USED`, `INVALID_SIGNATURE`, `REPLAY_REJECTED`, and
missing-scan-target behavior. Additionally:

- **`liveness` stuck at `STALE`/`OFFLINE` despite the Runtime running**:
  check the Runtime's local clock — heartbeat timestamps outside a 5-minute
  window of Atlas's clock are rejected before they'd even update
  `lastHeartbeat` (`REPLAY_REJECTED`), which then also stalls liveness.
- **`tenant` is `null` in step 8's response**: step 4 (Tenant association)
  wasn't completed, or was completed against the wrong Organization id —
  re-check `GET /admin/control-plane/organizations/:id`.

### 14. Restart / recovery

An Atlas API restart (planned maintenance, deploy, crash recovery) requires
**no re-onboarding action** — Runtime identity, heartbeat history, and
Tenant association are all Postgres-persisted (ATLAS 46.22/46.23). After a
restart, re-run step 8's `GET` — it should show the same `runtimeId`,
`organization`, and `tenant` as before, with `liveness` recovering to
`ONLINE` on the Runtime's next heartbeat. Proven with a real spawned/killed/
restarted process in `restart-durability-e2e.test.ts`.

### 15. Critérios de sucesso

- Step 8's `GET` shows `status: ACTIVE`, `liveness: ONLINE`, correct
  `organization`/`tenant`.
- Step 10/11 both show completed/classified data.
- Step 12's isolation checks pass.

### 16. Critérios de rollback

- If registration fails at step 6 (`ACTIVATION_KEY_*` error): revoke the
  key (`DELETE /admin/runtime-registration/activation-keys/:id`) and issue
  a fresh one — a failed/expired key is never silently reusable.
- If the Runtime was registered with the wrong Organization or a
  compromised identity: `DELETE /admin/runtime-registration/runtimes/:id/credentials`
  revokes its certificate and kills its active sessions immediately: it
  can no longer authenticate, and a fresh install must re-register under a
  new activation key.
- Nothing in this flow requires a database rollback — every step is either
  additive (new rows) or a single-column update (`tenantId`), never a
  destructive operation.

## Runtime Incident Troubleshooting (ATLAS 46.25)

For diagnosing an already-onboarded Runtime that's misbehaving — different
from the "First Client Onboarding Runbook" above, which walks a _new_
signup. Executable from this document alone; no code knowledge required.
Uses the new operational surface this sprint added:
`GET /admin/runtime-registration/summary` (Part C) and
`GET /admin/runtime-registration/runtimes?...` with the new
`controlPlaneOrganizationId`/`tenantId`/`liveness` filters (Part B).

> **API health is not Runtime liveness.** `GET /health`/`/live`/`/ready`
> report whether the _Atlas API process itself_ is up and can reach
> Postgres — they say nothing about any individual Runtime.
> `GET /admin/runtime-registration/runtimes/:id`'s `liveness` field
> (ONLINE/STALE/OFFLINE) is the only source of truth for "is this specific
> Runtime checking in." A perfectly healthy API can have every one of its
> Runtimes OFFLINE, and a STALE/OFFLINE Runtime says nothing about the
> API's own health. Never conflate the two when triaging.

### 1. Verificar API

`GET /health` — must be `200`/`healthy` with `database: "ok"` before
investigating anything Runtime-specific; if the API itself is degraded,
every Runtime will read OFFLINE for reasons that have nothing to do with
any individual Runtime.

### 2. Localizar Organization

`GET /admin/control-plane/organizations?<filter by known slug/name>` — or,
if you already have a `runtimeId`, skip straight to step 4 and read
`organization` off that response instead.

### 3. Localizar Tenant

`GET /admin/control-plane/organizations/:id` — its `tenantId` (or `null`
for a legitimate PENDING_TENANT_ASSIGNMENT Organization). Again, if you
have a `runtimeId`, step 4's response already includes this.

### 4. Localizar Runtime

```
GET /admin/runtime-registration/runtimes/:id
GET /admin/runtime-registration/runtimes?controlPlaneOrganizationId=<id>
GET /admin/runtime-registration/runtimes?organizationId=<id>
```

The `:id` form is the fastest path if you already know the `runtimeId`
(e.g. from a customer support ticket); the list form with
`controlPlaneOrganizationId` finds every Runtime under one real Control
Plane Organization when you only know the customer, not the Runtime.

### 5. Interpretar ONLINE

Last heartbeat within 60s. Fully healthy — no action needed.

### 6. Interpretar STALE

Last heartbeat between 60s and 5 minutes ago. The Runtime is known and was
recently seen, but hasn't checked in within its expected cadence — likely
transient (network blip, brief outage, host under load). Not yet an
incident; re-check in a minute before escalating.

### 7. Interpretar OFFLINE

Last heartbeat more than 5 minutes ago, or never recorded at all. Treat as
a real incident once the API itself (step 1) is confirmed healthy — the
Runtime process is very likely down, network-partitioned, or was never
successfully installed.

### 8. Verificar lastHeartbeat

Same `GET .../runtimes/:id` response, `runtime.lastHeartbeat` (ISO
timestamp, `null` if never observed) and `runtime.activatedAt` (when it
first went ACTIVE — set once, never cleared).

### 9. Verificar activation

`GET /admin/runtime-registration/activation-keys` — find the key by
`organizationCode`; check `used`/`usedByRuntimeId`/`revoked`/`expiresAt`.
A Runtime stuck at `status: REGISTERED` (never reaching `ACTIVE`) with no
heartbeat ever recorded usually means the Runtime process itself never
started successfully after registration — activation key state won't
explain that (registration already consumed it successfully by that
point).

### 10. Verificar identidade

`machineFingerprintHash` and `publicKey` are both unique at the database
level (ATLAS 46.22) — if a customer reports "my Runtime won't register,"
check for `FINGERPRINT_DUPLICATE`/`PUBLIC_KEY_ALREADY_REGISTERED` in the
registration response; it means this exact machine (or its identity file)
already has a registration. The private key never left the customer's
machine and is never visible from the API side — there is nothing to
"verify" about it directly, only its downstream effects (signature
validity on heartbeat/auth calls).

### 11. Verificar restart

An Atlas API restart never requires Runtime action. Confirm via
`GET .../runtimes/:id` immediately after a known restart — `runtimeId`,
`organization`, `tenant`, and `status` must all read identically to
before the restart (persisted in Postgres, ATLAS 46.22/46.24). If they
don't match, that's a real bug, not expected behavior — escalate (step
18).

### 12. Verificar ERP discovery

`GET /erp-metadata/discover/:requestId` (or list, filtered) — `status`
progresses `REQUESTED` → `CLAIMED` → `COMPLETED`/`FAILED`. Stuck at
`REQUESTED`: the Runtime never polled `GET /erp-metadata/runtime/jobs` —
check its liveness first (step 4); an OFFLINE Runtime can't claim
anything.

### 13. Verificar GENESIS

A `COMPLETED` discovery request means GENESIS's real schema introspection
succeeded and the Runtime reported back. A `FAILED` request's `error`
field carries the introspection failure reason (e.g. unreachable ERP
database, credential failure at the ERP end — not an Atlas-side issue).

### 14. Verificar ATHENA

`GET /semantic-mapping/entities?profileId=...` after
`POST /semantic-mapping/analyze` — empty results mean either analysis
hasn't run yet, or the discovered schema had nothing ATHENA could
classify (rare; check the raw discovery result first).

### 15. Diagnosticar heartbeat inválido

- `INVALID_SIGNATURE`: the persisted identity file on the Runtime's
  machine doesn't match what's registered server-side — most often means
  something regenerated `<data_dir>/atlas-runtime-identity.json` after
  registration. There is no recovery except re-registering with a fresh
  activation key.
- `REPLAY_REJECTED`: either the Runtime's clock has drifted more than 5
  minutes from Atlas's, or the exact same signed request was sent twice
  (shouldn't happen through normal client use — each call builds a fresh
  timestamp).
- A heartbeat that never even reaches the API (no log line, no error): a
  network/connectivity problem, not an Atlas-side rejection — check the
  Runtime's own logs, not Atlas's.

### 16. Diagnosticar Runtime duplicado

`FINGERPRINT_DUPLICATE`/`PUBLIC_KEY_ALREADY_REGISTERED` at registration
time (see step 10) is the only way a "duplicate" can occur — both are
enforced by real Postgres unique constraints, not just application code,
so a duplicate row is not possible even under a concurrent registration
race. If two Runtimes both claim to be "the same machine," the second one
to attempt registration receives the error; the first one already
registered is unaffected.

### 17. Recuperar Runtime após restart

No recovery action is normally needed (see step 11). If a Runtime shows
OFFLINE after an API restart and stays that way past its next expected
heartbeat interval, the issue is on the Runtime's own machine/process, not
something to fix API-side — check that the Runtime process itself is
still running and can reach `ATLAS_API_URL`.

### 18. Escalar problema quando necessário

Escalate past this runbook when: `GET /health` itself is degraded (step

1. — that's an API-level incident, not a Runtime one; a restart doesn't
   reproduce the same `runtimeId`/`organization`/`tenant` (step 11) — a real
   persistence bug; or GENESIS/ATHENA fail consistently across multiple,
   otherwise-healthy Runtimes — likely an Atlas-side regression, not a
   per-customer issue.

### Alerting — explicitly not built yet

Every step above is a **manual** `GET` an operator runs. There is no
email/SMS/WhatsApp/push notification, no paging integration, and no
background sweep that watches for a Runtime crossing into STALE/OFFLINE
and reacts on its own — deliberately out of this sprint's (and 46.23's)
scope. When that future layer is built, it can consume `liveness`,
`lastHeartbeat`, and the new `GET /admin/runtime-registration/summary`
(Part C) exactly as they already exist today — nothing about the
persistence model needs to change to support it; it would be a pure
consumer of this already-computed state, polling on whatever interval it
chooses.

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
