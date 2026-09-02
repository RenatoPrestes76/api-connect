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

## ATLAS 46.26 — Production Security & Hardening

A dedicated, adversarial security audit of billing/security/ops/ha/portal —
attacking the system as ten threat-actor personas rather than trusting
existing tests. Full write-up: the "ATLAS 46.26 — RESULTADO" report
delivered alongside the commit that closed this sprint (see `git log` for
the commit message and its body).

**Authorization model.** Every tenant-scoped route now derives its tenant
strictly from the authenticated session (`requireOrgId(ctx)` for the
generic/portal surfaces, `ctx.portalOrganizationId` for the portal
surface) — never from a client-supplied `x-tenant-id` header, `tenantId`
query/body param, or URL path segment. Genuinely platform-wide staff
surfaces (`ops/*`, `ha/*` read endpoints, security audit-chain-verify,
compliance framework controls) remain intentionally unscoped, each with
an explicit code comment recording that decision. Privileged, consequential
staff actions (billing admin dashboard, the Stripe webhook handler,
secret-rotation evaluate, HA backup/restore/recovery-test) are gated by
`requirePermission(...)` — reusing the existing admin-identity permission
system, extended with two new permissions (`security.manage`,
`ha.manage`) rather than a parallel authorization scheme.

**Mass assignment.** Several store-level update methods accepted a raw
`Partial<T>` patch via `Object.assign(target, patch, {...})` with only
`updatedAt` (sometimes `id`) protected — a TypeScript-only restriction,
erased at runtime by the calling route's type assertion on `ctx.body`. The
most severe instance let a portal organization owner PATCH their own
organization's `controlPlaneOrganizationId`, re-linking it to a
_different_ organization's real, Postgres-persisted Control Plane record.
Fixed with explicit field allowlisting everywhere this pattern was found.

**Brute force.** `/api/v1/portal/auth/login` and `/api/v1/security/mfa/verify`
had no attempt throttling. Both now lock out after 5 failures in a
15-minute window (`modules/portal-identity/rate-limiter.ts`,
`modules/security/rate-limiter.ts`), reusing the exact mechanism
`/admin/auth/login` already had, keyed to avoid a client simply spoofing a
header to reset the counter.

**Rate-limiter/JWT-scheme routing note.** Any route moved behind
`requirePermission(...)` (an admin-identity Bearer JWT) must also be added
to `middleware/auth.ts`'s `PUBLIC_PATHS`/`PUBLIC_PATH_PREFIXES`, or the
generic Supabase-style middleware rejects the admin token before
`requirePermission` ever runs — discovered mid-sprint via the new
end-to-end test suites (auth chain, not just the isolated handler).

**Deferred / external, not silently marked complete:**

- Stripe webhook has no real `Stripe-Signature` verification — there is no
  real Stripe integration anywhere in this codebase yet (no `stripe` SDK
  dependency; `stripe-simulation.ts` fabricates URLs locally), so this is
  explicitly deferred until a real Stripe account is part of Go-Live, not
  quietly left broken.
- ~~`ops/*`'s "staff-only" boundary relies on the generic auth layer's
  identity being genuinely staff-only~~ — closed by ATLAS 46.27, see below.
- `security/mfa/verify`'s new rate limiter is not paired with rate limiting
  on `security/mfa/setup`/other MFA endpoints — scoped to the one endpoint
  with a real brute-force target (a 6-digit code).

## ATLAS 46.27 — Ops Authorization & Privilege Boundary Gate

Closed the residual flagged at the end of ATLAS 46.26: `ops/*` (health,
dashboard, feature-flags, SLOs, DR, circuit breakers, queues — 16 routes
across 7 files) relied entirely on the generic Supabase-style
`authMiddleware` for "authorization" — any caller holding a valid generic
session was implicitly treated as staff, with no explicit permission
check of any kind, unlike every other admin-gated surface in this
codebase.

**Model.** Two new permissions, reusing the existing `requirePermission`
mechanism (no parallel authorization system): `ops.read` (all 10 `GET`
routes plus feature-flag evaluation, a read-only computation) and
`ops.manage` (create/update/delete feature flags, trigger DR
backups/tests, reset circuit breakers, enqueue/retry queue jobs). Granted
to `ATLAS_ADMIN`/`DEVOPS` (both tiers) and `SUPORTE`/`AUDITOR` (`ops.read`
only) — the same role-grant pattern already used for `security.manage`/
`ha.manage`. `ops/*` moved entirely off the generic middleware (added to
`PUBLIC_PATH_PREFIXES`, same treatment as `billing/admin/*` and
`security/secrets/rotation/evaluate` in 46.26) since every route is now
admin-identity-gated, with no remaining tenant-scoped route on that
prefix.

**Unchanged by design:** `ops/queues.ts`'s `tenantId` on `enqueue` remains
attribution metadata only (which tenant a job is "for"), never an
authorization boundary — that was already true before this sprint and
stays true; the actual authorization boundary is now `ops.manage`.

**Verified no regression:** Portal, Runtime (Ed25519/RuntimeRegistration
untouched), Security, Billing, and HA suites all re-run clean — this
sprint touched only `routes/v1/ops/*`, the permission catalog, and the
`ops/*` test suite.

**Bonus finding, unrelated to ops:** running the monorepo's actual
`pnpm type-check` (not the narrower `tsconfig.build.json`-scoped check
used throughout 46.26, which excludes `__tests__/**`) surfaced a real,
pre-existing type-inference bug in two 46.26 test helpers
(`signSupabaseJWT`'s `userId` parameter inferred the branded `UUID`
template-literal type from its `= randomUUID()` default instead of
`string`, rejecting plain-string callers). Fixed with an explicit `:
string` annotation — a type-strictness fix, not a runtime behavior
change or a security finding.

## ATLAS 46.28 — MFA Hardening & Authentication Abuse-Resistance Gate

Closed the residual flagged at the end of 46.26/46.27: `security/mfa/setup`
and the rest of the MFA endpoint family had no protection beyond `verify`
(the only one 46.26 hardened). Full endpoint family:
`GET .../mfa/status`, `POST .../mfa/setup`, `POST .../mfa/verify`,
`DELETE .../mfa/disable`, `GET .../mfa/backup-codes` — all under
`routes/v1/security/mfa.ts`, all session-scoped via `requireOrgId`
(session-derived tenant, never a client-supplied header/query value —
unchanged from 46.26).

**Setup rate limiting.** Unlike `verify` (a brute-force-guessing target),
`setup`'s risk is different: it's a mutation that silently regenerates and
overwrites an existing enrollment's secret + backup codes on every call,
with no confirmation step, so an unbounded caller could grief a
legitimate `userId`'s factor or race an unattended-enrollment takeover.
Rate limited to 5 calls / 15 minutes per (tenantId, userId) — same shape
as `verify`'s existing lockout, but a genuinely independent counter
(`modules/security/rate-limiter.ts`'s new `mfaSetupRateLimiter`) so setup
abuse and verify brute-forcing never share or reset each other's window.
Responds `429 MFA_SETUP_RATE_LIMITED` (a request-rate throttle), distinct
from verify's `423 MFA_LOCKED` (an account-lockout response to a
suspected credential-guessing attack).

**TOTP replay protection.** `verifyTotpToken`'s ±1 time-step (30s) clock-
skew window means a captured, already-used code stayed submittable and
would re-verify successfully for up to ~90 seconds — RFC 6238 §5.2
explicitly calls out rejecting OTP reuse as a mitigation worth
implementing. `MfaRecord` gained a new field, `lastUsedStep` (the RFC 6238
time-step index of the last successfully-verified code, `@seltriva/aegis`
package — never exposed via any DTO, purely internal bookkeeping); a
verify request that matches the _same_ step as last time is now rejected
with the identical generic `{valid: false, message: "Invalid or expired
token"}` response a wrong code gets (no distinct "replay" response that
would tell an attacker their guess was actually correct) and counts
toward the same brute-force lockout as any other failure.

**Concurrency.** Both rate limiters are synchronous, in-memory `Map`-based
counters with no `await` between the `isLocked()` check and the
`recordFailure()`/state update inside any caller — Node's run-to-completion
semantics make each request's check-then-update atomic relative to other
concurrent requests, so there's no time-of-check/time-of-use window an
attacker could race to slip extra attempts through. Verified directly: 10
concurrent `setup` calls and 10 concurrent invalid `verify` calls for the
same (tenantId, userId) both correctly cap at the 5-attempt limit, never
letting the full burst through.

**Cross-authentication-scheme boundary.** All five MFA endpoints were
re-verified to reject a real portal-identity session, a real Runtime
access token, and a real admin-identity session (each signed with a
different secret than the generic Supabase-style middleware `security/*`
sits behind) with `401`, and to reject a session with no organization
linked with `403 ORGANIZATION_NOT_LINKED` rather than falling back to a
default tenant.

**Enumeration resistance.** A wrong code against an enrolled user and a
replayed (already-used, but otherwise valid) code against the same user
now produce byte-identical response bodies — no oracle that would let an
attacker distinguish "close, but already used" from "just wrong." `setup`
never echoes a previous enrollment's secret/backup codes back — always a
fresh set. `status` never includes `secretBase32`, `backupCodes`, or the
new `lastUsedStep` field.

**Deliberately left unchanged, and why (not silently — see Residual
Risks in the delivered report):**

- `DELETE .../mfa/disable` and `GET .../mfa/backup-codes` — audited for
  abuse and deliberately NOT rate limited. A single `disable` call already
  fully disables the factor; a request-rate limiter wouldn't reduce that
  risk (the real open question is whether disabling should require
  re-proving the current factor first — an authorization/reauthentication
  design decision, not a rate-limiting fix). `backup-codes` re-displays a
  sensitive value the caller's tenant session is already trusted to read
  once (at setup) — consistent with `security/secrets/:id/decrypt`
  (ATLAS 46.26), an equally "any tenant session can already do this"
  surface that also got no rate limiter; there's nothing being _guessed_
  here; a limiter would be arbitrary, not risk-reducing.
- `userId` remains a client-supplied resource identifier, not
  cross-checked against the caller's own identity — the same trust model
  every other `security/*` resource already uses (secrets, SSO providers,
  policies, certificates, risk events are all tenant-owned, not
  individual-caller-owned). Inventing a stricter per-caller-identity model
  for MFA alone, while every sibling resource in the module stays
  tenant-scoped, would be a novel, inconsistent authorization philosophy
  for one endpoint family, not a targeted fix.

## ATLAS 46.29 — Production Security Residual Closure Gate

Audit-only sprint (no application code changes) reauditing the residuals
carried forward from 46.22–46.28. Starting point: `7665b64` (46.28),
working tree already clean. Result: no production surface was found
accepting a sensitive operation without adequate authentication,
authorization, integrity, or abuse protection.

**A — Stripe/webhook reaudit.** Reconfirmed, independently, that no real
Stripe integration exists anywhere in the monorepo: zero `stripe` entries
in any `package.json` and zero `stripe@` resolutions in the lockfile.
The only two files anywhere referencing `Stripe-Signature` /
`constructEvent` / `STRIPE_WEBHOOK_SECRET` are this runbook and
`stripe-webhooks.ts`'s own doc comment describing what a _real_
integration would require — neither is executable verification code.
`modules/billing/stripe-simulation.ts` fabricates fake
`checkout.stripe.com/demo/...` URLs locally; no outbound call to any real
Stripe API exists. `http/router.ts`'s `parseBody()` only ever exposes
parsed JSON — the raw request bytes a genuine Stripe signature check
would need to HMAC over are discarded before a handler ever runs, so
real verification isn't even plumbable today. `handleStripeWebhook`
remains gated behind `billing.manage` (the interim protection established
in 46.26); billing-routes.test.ts's existing "rejects a fully
unauthenticated caller" test already demonstrates no unauthenticated
traffic — real Stripe or otherwise — can reach this route. Verdict:
**STRIPE_WEBHOOK = EXTERNAL/DEFERRED — NO REAL STRIPE WEBHOOK
IMPLEMENTATION PRESENT.** No fake/simulated signature-verification layer
was built, per this sprint's explicit instruction not to invent an
integration that doesn't exist.

**B — Authorization residuals.** `ops/*` (closed in 46.27) and the
`security/*`/`billing/*` tenant-scoping fixes (closed in 46.26/46.28)
were re-verified against the current tree rather than assumed: `git log`
confirms `HEAD` is still exactly the 46.28 commit, so none of that
previously-audited code has changed since it was last tested and
committed — regression is not possible on files nothing has touched.
Spot-verified `security/risk.ts` (session-derived tenant, no client-
controlled `:tenantId` trust) and `ops/*`'s 21 `requirePermission('ops.*')`
gate sites are still in place. No new residual found; nothing reopened
without new evidence, per this sprint's own rule against relitigating
closed work.

**C — Secret/credential exposure.** Re-verified `security/secrets.ts`:
list/get responses strip `encryptedValue` and return a masked value only;
`POST /secrets` and `POST /secrets/:id/rotate` both strip
`encryptedValue` from their store-layer return value before it reaches
`json()`; only `POST /secrets/:id/decrypt` reveals plaintext, by design,
tenant-checked and audit-logged. `mfa.ts`'s `status` handler still strips
`secretBase32`/`backupCodes`/`lastUsedStep`. No route handler in
`security/*` logs request/response bodies — the shared request logger
(`server.ts`) logs only method/url/status/duration, never body content.
No new exposure found.

**D — Replay/idempotency.** MFA replay protection (46.28) is unchanged
and still covered by its own regression test. The Stripe webhook handler
is idempotent by construction where it matters: `markInvoicePaid` and
`syncStripeSubscription` are state-setters (last-write-wins), not
counters, so redundant delivery can't double-charge or double-count; a
repeat `subscription.deleted` is already caught by a try/catch treating
"already canceled" as a no-op. No idempotency keys were added — no
concrete risk was demonstrated that would justify them, and the route
has no real (non-simulated) traffic reaching it regardless.

**E — CORS/trust boundaries.** `CORS_ALLOWED_ORIGINS` is enforced
fail-loud at boot in production (`assertProductionCorsConfigured`,
wired in `index.ts`) — refuses to start with an open/unset/`*` policy.
No `Access-Control-Allow-Credentials` header is ever set, so the
wildcard-plus-credentials misconfiguration this guard exists to prevent
isn't reachable even in dev. Existing `__tests__/http/cors.test.ts`
already covers unset/allowlisted/out-of-allowlist/multi-origin behavior.
No change needed.

**F — Error/observability.** `withErrorBoundary` (server.ts) returns a
generic `Internal server error` (500) for any uncaught exception —
`err.message`/`err.stack` go only to the server-side structured log,
correlated by `X-Request-Id`, never to the response. The handful of
route-level `catch` blocks that do echo `err.message` to a client
(`load-balancer.ts`, `control-plane/organizations.ts`,
`control-plane/erp-integrations.ts`) do so only for their own
deliberately-worded custom error classes (`LoadBalancerError`,
`OrganizationTenantNotFoundError`, `ErpIntegrationNotConfiguredError`),
each narrowed by `instanceof` with every other exception rethrown to the
generic boundary — the exact pattern established in 46.26. No leak
found.

**G — Test matrix.** No new findings in A–F, so no new tests were added —
existing coverage (Stripe auth-gating, MFA replay/rate-limiting/
concurrency, secrets redaction, CORS, error-boundary leak tests) already
demonstrates the properties this sprint reaudited.

**H — Regression.** Root `pnpm type-check`, `pnpm lint`, and `pnpm build`
all clean (all cached — confirms zero source drift from the last
verified state). `apps/api`'s full suite run twice: 87 files / 1797
tests, 0 failures, 0 flakes, both passes.

**Closing decision.** No production surface was found still capable of
accepting a sensitive operation without adequate authentication,
authorization, integrity, or abuse protection. **ATLAS 46.29 —
COMPLETE. READY FOR NEXT SPRINT.** (Not a Go-Live declaration.)
This was an audit-only sprint — no application source changed, only this
documentation.

## ATLAS 46.30 — Production Readiness & Go-Live Gate

Proved, through real code and reproducible tests (not just reading source),
that the full first-client operational cycle — Client Zero → Tenant
provisioning → Runtime registration → Runtime authentication → ERP
discovery → job creation/execution → result persistence → heartbeat →
liveness → failure → recovery → observability — holds together end to end
and survives the failures that are actually predictable for it.

**Baseline.** `HEAD` at `778fd0d` (46.29), `local == origin/master`,
working tree clean. Inventory of existing mechanisms found the operational
cycle already covered by an extensive, real (not simulated) test suite
built across 46.20–46.25: `client-zero-e2e.test.ts`,
`client-zero-onboarding-e2e.test.ts`, `real-client-enrollment-e2e.test.ts`,
`restart-durability-e2e.test.ts`, `registration-idempotency.test.ts`,
`tenant-association.test.ts`, `onboarding-isolation.test.ts`,
`runtime-isolation.test.ts`, `liveness.test.ts`,
`runtime-liveness-operation.test.ts`, `runtime-operational-view.test.ts`,
`enrollment-discovery-e2e.test.ts`, `erp-metadata-routes.test.ts`,
`job-orchestration-routes.test.ts`, and `tenancy-persistence.test.ts`.
Given this, the sprint's work was overwhelmingly verification — running
and inspecting what exists — rather than new implementation, per this
gate's own instruction not to alter code just to generate a diff.

**Code change: one new file.**
`__tests__/runtime-registration/atlas-46-30-production-readiness-e2e.test.ts`
— the single reproducible Client Zero scenario this gate requires. No
existing file walked all 15 steps (signup → tenant → registration → auth
→ heartbeat → ONLINE → discovery → generic job create/claim/execute/result
→ persistence re-read → heartbeat loss → STALE → OFFLINE → real-heartbeat
recovery → ONLINE again) plus a second, independent Client Zero for
tenant-isolation, in one sequence — the existing files each proved a
subset (flow correctness, or the liveness cycle, or process-restart
durability) in isolation. This test composes those already-proven
primitives rather than re-deriving protocol-level properties (invalid
signature, replay, activation-key lifecycle — all exhaustively covered
elsewhere and deliberately not repeated here). It does **not** repeat a
real API process restart — `restart-durability-e2e.test.ts` (46.22)
already proves registration/heartbeat survive a real process kill+restart;
duplicating that spawn here would only slow the scenario down.

**Production Cycle** — all steps proved against real HTTP, a real
listening server, and real Postgres:

- Client Zero / Tenant Provisioning: signup → Organization
  (PENDING_TENANT_ASSIGNMENT, not an error) → explicit admin-controlled
  Tenant assignment. Repetition/idempotency:
  `registration-idempotency.test.ts` (duplicate fingerprint rejected, two
  concurrent registrations racing the same fingerprint — exactly one
  succeeds via the database's own unique constraint, not application
  logic). Isolation: `onboarding-isolation.test.ts`,
  `tenant-association.test.ts` (concurrent tenant reassignment never
  duplicates a row). Failure/rollback:
  `tenancy-persistence.test.ts` (`rolls back cleanly: creating an
organization under a nonexistent tenantId leaves zero rows behind`,
  and the same for a tenant deleted mid-transaction).
- Runtime Enrollment: real Ed25519 identity, activation-key single-use
  enforcement, wrong-key/expired/revoked/reused-key all rejected with the
  correct status. Cross-tenant: a Runtime cannot authenticate or operate
  outside its own Organization (`runtime-isolation.test.ts`,
  `tenant-association.test.ts`'s client-supplied-tenantId-cannot-escape
  test).
- Runtime Authentication: signed proof-of-identity → JWT session →
  rotate/revoke; wrong-key and blocked/revoked-runtime cases rejected.
- Heartbeat / Liveness: real signed heartbeats update state; invalid
  signature and exact-replay rejected without corrupting the existing
  record. `ONLINE (<=60s) / STALE (>60s, <=5min) / OFFLINE (>5min)` —
  thresholds unchanged this sprint, boundary-tested inclusively in
  `liveness.test.ts`. The full ONLINE → STALE → OFFLINE → ONLINE cycle is
  proven with controlled timestamps (no real sleep), run twice in
  `runtime-liveness-operation.test.ts` and once more inline in this
  sprint's new scenario. An OFFLINE runtime is always still a known,
  addressable record (200 on lookup) — never confused with one that was
  never registered.
- Discovery: authenticated-runtime-only claim, tenant preserved
  end-to-end, a wrong-tenant/wrong-runtime discovery or result submission
  is rejected, a failed scan retries with backoff then fails cleanly
  (`erp-metadata-routes.test.ts`), a mid-scan classifier exception does
  not leave the request stuck (`Recovery — classifier throws mid-scan`),
  a repeated result submission for an already-completed request is
  idempotent (reused, not reprocessed).
- Job Lifecycle: create → queued → claim (signed) → dispatch → execute →
  result → completed, all proven in this sprint's new scenario against a
  real Client Zero runtime. Cross-org creation is rejected
  (`RUNTIME_ORGANIZATION_MISMATCH`), creation is idempotent via
  `idempotencyKey`, a duplicate result report does not re-execute the
  job, several independent jobs for the same runtime run without
  interference, and a dispatched job that never reports back within its
  timeout retries then fails (`FAILED`, with a `timeout` history entry) —
  never stuck indefinitely.
- Persistence: `tenancy-persistence.test.ts` — writes visible across
  independent Prisma connections, transactional rollback on invalid FK
  and on a race where the referenced tenant is deleted mid-transaction,
  five concurrent creates under the same tenant with distinct slugs all
  succeed independently, tenant-scoped queries never leak across tenants.
- Recovery: a real API process kill+restart preserves the Runtime
  registration and heartbeat capability (`restart-durability-e2e.test.ts`,
  46.22). Job interruption is proven through its observable
  consequences rather than a literal "kill mid-execution" simulation: a
  job that stops reporting back times out to `FAILED` deterministically
  (never stuck), and a late/duplicate result arriving after the fact is
  idempotent, not double-applied — see Findings for why this is scoped
  as LOW rather than treated as a gap in the required guarantee.

**Failure Matrix** — 11/11 applicable cases, all PASS:

| Falha                        | Resultado esperado                      | PASS                                                                   |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| API indisponível             | runtime não perde identidade persistida | ✅ restart-durability-e2e.test.ts                                      |
| runtime indisponível         | liveness eventualmente OFFLINE          | ✅ runtime-liveness-operation.test.ts, 46.30 E2E                       |
| heartbeat perdido            | STALE/OFFLINE conforme threshold        | ✅ liveness.test.ts, 46.30 E2E                                         |
| runtime retorna              | ONLINE                                  | ✅ runtime-liveness-operation.test.ts (x2), 46.30 E2E                  |
| discovery falha              | estado consistente                      | ✅ erp-metadata-routes.test.ts (retry+backoff, mid-scan recovery)      |
| job falha                    | FAILED consistente                      | ✅ job-orchestration-routes.test.ts (retry+backoff, timeout)           |
| job repetido                 | sem efeito duplicado indevido           | ✅ job-orchestration-routes.test.ts (idempotencyKey, duplicate result) |
| tenant incorreto             | rejeição                                | ✅ job-orchestration/erp-metadata cross-org tests, 46.30 E2E isolation |
| token inválido               | rejeição                                | ✅ runtime-registration-routes.test.ts, erp-metadata-routes.test.ts    |
| database transaction failure | rollback                                | ✅ tenancy-persistence.test.ts                                         |
| restart                      | estado persistido preservado            | ✅ restart-durability-e2e.test.ts                                      |

**Security Regression** (targeted, not a repeat of 46.26–46.29's full
audits): unauthenticated → 401 and wrong-organization → 403 reconfirmed
on job-orchestration and erp-metadata; cross-tenant runtime/job visibility
reconfirmed in this sprint's new scenario (a second, independent Client
Zero cannot see or list the first's runtime or job, and vice versa);
wrong-runtime result submission rejected; invalid/wrong-key signatures
rejected across registration, heartbeat, and job claim/result. Auth
middleware and permission catalogs are unchanged since 46.28/46.29 — `HEAD`
diff for this sprint touches only the one new test file.

**Database Diagnostics** — reused the same direct-Postgres methodology as
46.26 Part 15 (no second diagnostic tool built). Checked: orphan
`RuntimeRegistration.controlPlaneOrganizationId` / `Organization.tenantId`
references, duplicate `machineFingerprintHash`/`publicKey`/tenant
slug/organization slug, impossible lifecycle state (`ACTIVE` with no
`lastHeartbeat`), impossible timestamps (`activatedAt`/`lastHeartbeat`
before `registeredAt`). Result: **ZERO INCONSISTENCIES**, both before and
after this sprint's full test-suite run (confirming the new scenario's
`afterAll` cleans up completely). The dev/test database carries a large
volume of accumulated fixture rows from repeated sprint test runs
(thousands of organizations/runtimes) — expected local-environment noise,
not a production concern; a real production database starts empty.

**Observability** — using only existing surfaces, no new dashboard: which
runtimes exist and their tenant/organization (`GET
.../runtimes` and `.../runtimes/:id`), ONLINE/STALE/OFFLINE per runtime
and in aggregate (`.../runtimes/:id`'s `liveness` field, `.../summary`),
last heartbeat timestamp (`lastHeartbeat`), which jobs are running/failed
and why (`GET /jobs?status=...`, `job.lastError`, `job.history[].outcome`
— e.g. `timeout`), infrastructure failure vs. functional failure are
distinguishable (a DB-unavailable `/health`/`/ready` never returns 200 and
never leaks connection details, vs. a functional `JOB FAILED` carries its
own `lastError`/history reason) and every state-changing operation across
this cycle is audit-logged (`RUNTIME_ACTIVATED`, `JOB_CREATED`,
`JOB_RESULT_REPORTED`, `JOB_CANCELLED`, `METADATA_DISCOVERY_REQUESTED`,
`METADATA_DISCOVERY_COMPLETED`). This check was scoped to the operational
cycle's own surfaces, not an exhaustive silent-catch audit of the entire
codebase — no silent failure was found within that scope.

**Tests.** Full `apps/api` suite run twice: **88 files / 1798 tests, 0
failures, 0 flakes**, both passes. `pnpm type-check`, `pnpm lint`, `pnpm
build` all clean.

**Findings** (none are BLOCKER or HIGH — nothing here prevents the next
gate):

- LOW — Job/runtime interruption is proven through its consequences
  (timeout → `FAILED`, idempotent late result) rather than a single
  literal "kill mid-execution, restart, re-verify" simulation, because no
  such interruption mechanism exists to simulate beyond what timeout/
  idempotency already cover. Not invented per this gate's own rule
  against inventing mechanisms that don't exist.
- LOW — The observability "no silent errors" check was scoped to this
  cycle's own routes/stores, not a full-codebase audit; unrelated modules
  were not re-swept (out of scope, no evidence of an issue there).

**Deferred / External** — unchanged from 46.29, out of this sprint's
scope and not reopened without new evidence: real Stripe webhook signature
verification (no real Stripe integration exists to protect), `mfa/disable`
reconfirmation, MFA `userId` binding.

**Final Verdict**

```text
ATLAS 46.30 — COMPLETE
READY FOR NEXT SPRINT
```

Not a Go-Live declaration — this sprint proves production _readiness_ of
the operational cycle, not authorization to onboard a real client.

## ATLAS 46.31 — First Client Deployment & Operational Acceptance

This sprint validated the real deployment path — source through a booted,
serving container — rather than the operational cycle already proved in
46.30. It found and fixed a genuine deploy blocker: **the actual Docker
image this repo has shipped since 46.20 never successfully booted.**
`pnpm build` passing was never proof of that (this gate's own rule 18) —
nobody had actually run `docker build && docker run` end to end since the
Dockerfile was written, because every prior sprint's validation used
`node dist/index.js` directly on the host or an in-process vitest server,
never the real image.

### The blocker, root-caused and fixed

Building the image with `docker build -f docker/Dockerfile.api .` and
running it with plain `docker run` (not `docker-compose up`, whose dev-mode
`volumes:` bind-mounts the host's own `apps/api`/`packages` over the
image's — silently shadowing whatever the image actually shipped, which is
why this was never caught: `docker compose up` always tested the _host's_
node_modules, not the image's) reproduced, deterministically:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv'
imported from /app/apps/api/dist/index.js
```

Root cause: the final stage copied `node_modules` and
`apps/api/node_modules` straight from the build stage on the theory that
pnpm's relative per-package symlinks (e.g. `apps/api/node_modules/dotenv`
-> `../../node_modules/.pnpm/dotenv@.../node_modules/dotenv`) would keep
resolving after the copy. `pnpm --filter=@seltriva/api deploy --prod
/app/deploy` — pnpm's own purpose-built command for exactly this — replaces
that with a self-contained, non-symlinked `node_modules`, eliminating the
whole class of issue. That surfaced a second, real, separate bug: the
deployed `@prisma/client` copy was never generated (`db:generate` earlier
in the build wrote into the _shared_ store, not the deploy output's own
copy) and, once pointed at the right schema, a third: `npx prisma` floated
to an unrelated newer `prisma` CLI version already present elsewhere in
this workspace, mismatched against the pinned `@prisma/client@5.22.0`.
Fixed by copying `prisma/schema.prisma` into the deploy output (so
schema-relative resolution lands on the deployed client) and invoking
`packages/database/node_modules/.bin/prisma` explicitly — the exact pinned
binary, no floating resolution. See `docker/Dockerfile.api`'s inline
comments for the full chain.

**Verified end to end, for real, not just "build succeeded":** built the
image, ran it standalone on the shared Docker network with a full,
correctly-formatted set of production secrets and `NODE_ENV=production`,
confirmed `/health`/`/ready` both 200 and Docker's own `HEALTHCHECK`
directive reports `healthy`, and separately confirmed the production
fail-loud secret gate still refuses to boot (clear error, not a hang or
silent degraded start) when a required secret is missing. Then confirmed
the _absence_ of a secret is caught before any of this — i.e., re-ran the
existing `production-secrets.test.ts` suite, unaffected by this fix.

### A second, independent finding: health/ready could false-positive during a real outage

Investigating the container boot led to running a real dependency-outage
test against the built artifact (stop the Postgres container the running
API is using, mid-life) — and `/health` kept reporting `database:"ok"`
indefinitely afterward. Root cause: the handlers called `connectDB()`
(`$connect()`), which is a no-op once a Prisma client believes it's already
connected — it never re-verifies. This is exactly this gate's own BLOCKER
example ("readiness declara pronto quando serviço crítico está
indisponível"). Fixed with a new `pingDB()` (a real `SELECT 1` round trip)
that `/health` and `/ready` now call instead; `connectDB()` is unchanged
and still used for boot's one-time initial connection. Never documented
as fixed by mocking alone — `db-real-outage-recovery.test.ts` (new)
proves it against a real, separate, throwaway Postgres container and the
real built artifact: healthy at boot, degraded/not_ready within seconds of
a real stop, recovered once the database returns. `db-unavailable.test.ts`
(existing, 46.19) now mocks `pingDB()` instead of `connectDB()` — it was
mocking a function the handlers no longer call, which would have made it
pass for the wrong reason.

### Environment contract

Audited every `process.env[...]` read in `apps/api/src` against
`services/production-secrets.ts`'s `REQUIRED_IN_PRODUCTION`, `render.yaml`,
and `.env.example`. Found `render.yaml` and `.env.example` both missing 7
of the 8 secrets that gate on `NODE_ENV=production`
(`ADMIN_JWT_SECRET`, `PORTAL_JWT_SECRET`, `RUNTIME_JWT_SECRET`,
`RUNTIME_CERT_SECRET`, `CONNECTOR_PACKAGE_SECRET`,
`MESSAGE_DELIVERY_SECRET`, `SUPABASE_JWT_SECRET` — only `ATLAS_MASTER_KEY`
was already declared) — a real deploy on Render would have had these
unset and hit the fail-loud gate immediately (safe failure, but an
avoidable one). Added all 7 to both files, and to `scripts/validate-env.js`
(a pre-existing, previously-incomplete standalone checker — extended, not
replaced). Confirmed with a real run: never prints values, only
name+presence.

| NAME                                                                                                                                                                                          | PURPOSE                                    | REQUIRED/OPTIONAL                                                  | ENVIRONMENT |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | ----------- |
| `DATABASE_URL`                                                                                                                                                                                | Postgres connection                        | Required                                                           | all         |
| `API_SECRET_KEY`                                                                                                                                                                              | generic API auth                           | Required                                                           | all         |
| `NODE_ENV`                                                                                                                                                                                    | environment mode                           | Optional (default `development`)                                   | all         |
| `API_PORT`                                                                                                                                                                                    | HTTP listen port                           | Optional (default `3001`)                                          | all         |
| `LOG_LEVEL`                                                                                                                                                                                   | logger verbosity                           | Optional (default `info`)                                          | all         |
| `CORS_ALLOWED_ORIGINS`                                                                                                                                                                        | CORS allowlist                             | Required in production (fail-loud)                                 | production  |
| `ADMIN_JWT_SECRET` / `PORTAL_JWT_SECRET` / `RUNTIME_JWT_SECRET` / `RUNTIME_CERT_SECRET` / `CONNECTOR_PACKAGE_SECRET` / `MESSAGE_DELIVERY_SECRET` / `SUPABASE_JWT_SECRET` / `ATLAS_MASTER_KEY` | signing/encryption keys, one per subsystem | Required in production (fail-loud)                                 | production  |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                                                                                                                                                    | bootstrap admin identity                   | Optional (dev-only defaults)                                       | all         |
| `ANTHROPIC_API_KEY`                                                                                                                                                                           | AI Copilot routes                          | Optional (demo fallback)                                           | all         |
| `REDIS_URL`                                                                                                                                                                                   | provisioned in docker-compose              | **Not read by any application code** (finding, not a required var) | —           |

### Database / migrations

Ran `prisma migrate deploy` against a genuinely fresh, empty, throwaway
Postgres container (not the shared dev database) — both migrations
(`20260824000000_init_baseline`, `20260828004554_add_runtime_registration`)
applied cleanly, then the real built API booted against that same
freshly-migrated database and served `/health`/`/ready` correctly. Both
migrations remain additive-only — no destructive migration exists to
audit. No automated migration step exists in the deploy path (Dockerfile
CMD is just `node dist/index.js`; `render.yaml` has no pre-deploy hook) —
this was already true before this sprint and is already documented above
under Troubleshooting; still a real, manual operator step, not fixed here
(no Render-specific YAML feature was assumed without evidence — see
Findings).

### CORS / Domain

`atlasappruntime.com.br` and `api.atlasappruntime.com.br`: confirmed via a
real DNS resolution attempt (not assumed from prior docs) —
`getaddrinfo ENOTFOUND` for both. **NOT CONFIGURED — EXTERNAL/DEFERRED.**
`CORS_ALLOWED_ORIGINS` behavior (allowlist, fail-loud in production, no
`Access-Control-Allow-Credentials`) is unchanged and already covered by
`__tests__/http/cors.test.ts`.

### Deployment pipeline

`.github/workflows/ci.yml` ran lint/type-check/build/format/security-audit
on every push and PR, but **never the test suite** — a broken test could
have merged to `master` without CI ever failing. Added a `test` job:
Postgres+Redis services (mirroring `docker-compose.yml`), `prisma migrate
deploy`, `pnpm build` (a few integration tests exercise the real `dist/`
artifact), then `pnpm test`. Not independently verified via a live GitHub
Actions run in this sprint (no `gh` CLI access in this environment) —
YAML syntax validated locally; the next push's Actions run is the real
confirmation, recommended as a follow-up check.

### Rollback

Unchanged from the existing Rollback section above (Render/Vercel
platform-native prior-deploy rollback, `git revert` for source, migrations
still additive-only so no down-migration is needed yet) — reconfirmed
accurate, not modified. **EXTERNAL/DEFERRED** for an actual live-platform
rollback drill (no production deployment exists to drill against); the
underlying mechanism (redeploy a prior image) is standard platform
behavior, not custom code, so this is not classified as a gap.

### Data safety

Migrations: additive-only (above). Transactions: proved correct in 46.30
(`tenancy-persistence.test.ts` — rollback on invalid FK and on a
delete-mid-transaction race). Destructive operations: none in the deploy
path; `prisma migrate reset` remains explicitly warned against. Backup/
restore: the only backup/restore code in this repo
(`routes/v1/ha/backups.ts`, `restore.ts`) is an in-memory DR-dashboard
simulation (`haStore`/`backupService`), not real `pg_dump`/`pg_restore`
against the actual database — **EXTERNAL/DEFERRED**, real backup depends
on the hosting platform's managed Postgres backup feature once
provisioned. Not invented here.

### First Client Operating Procedure

Reproducible in a test/staging environment (never real client data):

1. Provision environment — `docker compose up -d postgres redis`, `.env`
   from `.env.example`.
2. `pnpm install --frozen-lockfile && pnpm --filter=@seltriva/database
run db:generate`.
3. `cd packages/database && npx prisma migrate deploy`.
4. `pnpm build --filter=@seltriva/api` (or `docker build -f
docker/Dockerfile.api .` for the real deploy artifact).
5. Start the API (`node apps/api/dist/index.js`, or run the built
   container) and verify `GET /health` and `GET /ready` both `200`.
6. Sign up a Client Zero (`POST /api/v1/portal/auth/register`) —
   Organization created, no Tenant yet (`PENDING_TENANT_ASSIGNMENT`).
7. Provision a Tenant (`POST /admin/control-plane/tenants`) and associate
   it (`PATCH /admin/control-plane/organizations/:id`).
8. Issue an activation key (`POST
/admin/runtime-registration/activation-keys`).
9. Register a Runtime with that key, authenticate (signed proof-of-identity
   -> session token), send a heartbeat, confirm `liveness: "ONLINE"` via
   `GET /admin/runtime-registration/runtimes/:id`.
10. Execute ERP discovery (`POST /erp-connectivity/profiles` then `POST
/erp-metadata/discover`), confirm `status: "COMPLETED"`.
11. Create and execute a job (`POST /jobs` -> claim -> `POST
/jobs/result`), confirm `status: "SUCCESS"`.
12. Verify persistence by independently re-reading the job and runtime.
13. Verify observability: runtime list/detail, liveness, job list filtered
    by status, audit trail entries for each mutation above.

Steps 6–13 are exactly `atlas-46-30-production-readiness-e2e.test.ts`
(46.30) automated — this procedure is that test's steps, described for a
human operator, not new code.

### Client Zero acceptance

Re-proved only what this gate specifically needs (not the full 46.30
suite): `atlas-46-30-production-readiness-e2e.test.ts` re-run as part of
this sprint's full-suite passes — Client Zero, Tenant, Runtime, auth,
heartbeat, discovery, job, persistence, and cross-tenant isolation all
still PASS, unchanged since 46.30, against the current `HEAD`.

**EXECUTION ENVIRONMENT = LOCAL/CONTAINERIZED** — Postgres/Redis via real
Docker containers throughout; the Client Zero acceptance flow itself runs
via vitest's in-process HTTP server (real HTTP, real Postgres, not the
Docker image); the Docker _image_ boot/health/readiness/fail-loud
verification above used the real built container directly. No staging or
production environment exists to execute against (domain not registered,
no confirmed live Render/Vercel deployment) — not claimed as either.

### Observability

Using only existing surfaces (no new dashboard): environment
(`/health`'s `version`/`uptime`, `/ready`'s per-dependency `checks`),
runtime (`GET .../runtimes`, `.../runtimes/:id`: tenant, organization,
liveness, last heartbeat), jobs (`GET /jobs?status=...`, `job.lastError`,
`job.history[].outcome`), failures distinguishable (infrastructure:
`/health` 503 with no leaked connection detail; functional: job `FAILED`
with its own reason in `history`). All PASS.

### Security (deployment subset)

No secrets committed (`.env*` gitignored, confirmed no tracked `.env`
files exist; build artifact scanned, none found). No secrets in logs
(structured logger emits method/url/status/duration only). Production
config fails safely (confirmed via a real container boot with a secret
missing — immediate, clear crash, never a silent degraded start).
Authentication/authorization/tenant-isolation/runtime-authorization:
unchanged since 46.26–46.30, reconfirmed passing in the full suite; not
re-audited from scratch (out of this gate's scope, no regression
evidence). CORS: allowlist + fail-loud in production, confirmed.

### Acceptance check tooling

`scripts/atlas-production-readiness.mjs` (46.20) already does exactly what
Phase O asks for against a live, already-running instance — build
artifact, environment, migrations, health, readiness, authentication,
persistence+isolation, CORS — deterministic PASS/BLOCKED. Not duplicated.
Did not extend it with a full runtime-registration-to-job cycle: that
would require re-implementing the Ed25519 signing logic already in
`agent/src/atlas-runtime-client/*` inside a separate, fetch-only script —
meaningful new surface for a check the vitest E2E (46.30 +
`atlas-46-30-production-readiness-e2e.test.ts`) already covers
deterministically. The two together (this script for a live deployed
instance's baseline; the vitest E2E for the full operational cycle) are
the automated acceptance check this gate asks for.

### Tests

Full `apps/api` suite run twice: **89 files / 1799 tests, 0 failures, 0
flakes**, both passes. `pnpm type-check`, `pnpm lint`, `pnpm build` all
clean.

### Final Deployment Readiness Matrix

| Área                | Status                             | Evidência                                                                              |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| Build               | PASS                               | clean `pnpm build`; real Docker image builds and boots                                 |
| Configuration       | PASS                               | render.yaml/.env.example/validate-env.js gaps closed; fail-loud confirmed live         |
| Database            | PASS                               | migrations apply cleanly to a genuinely empty DB                                       |
| Migrations          | PASS                               | additive-only, applied and verified; no automated pipeline step (documented)           |
| Startup             | PASS                               | real container boots in `NODE_ENV=production` with full secret set                     |
| Health              | PASS                               | `pingDB()` fix verified against a real mid-life outage                                 |
| Readiness           | PASS                               | same fix; never reports ready with a real dependency down                              |
| CORS                | PASS                               | allowlist + production fail-loud, tested                                               |
| Domain              | NOT CONFIGURED / EXTERNAL-DEFERRED | live DNS resolution attempted, confirmed unregistered                                  |
| Deployment pipeline | PASS (gap closed)                  | CI now runs the test suite; not yet observed on a live Actions run                     |
| Rollback            | EXTERNAL/DEFERRED (live drill)     | mechanism documented, platform-native, untestable without production                   |
| Client Zero         | PASS                               | 46.30 E2E re-confirmed                                                                 |
| Runtime             | PASS                               | registration/auth/heartbeat/liveness re-confirmed                                      |
| Discovery           | PASS                               | re-confirmed                                                                           |
| Job                 | PASS                               | re-confirmed                                                                           |
| Observability       | PASS                               | existing surfaces sufficient                                                           |
| Security            | PASS (subset)                      | no secrets committed/logged, fail-loud confirmed live, auth/tenant isolation unchanged |
| Data safety         | PASS / EXTERNAL-DEFERRED (backup)  | transactions/migrations safe; real backup depends on hosting platform                  |

### Findings

- **BLOCKER, fixed and verified** — the shipped Docker image never
  actually booted (`Cannot find package 'dotenv'`, then a Prisma Client
  generation gap once that was fixed). Root-caused and fixed in
  `docker/Dockerfile.api`; verified with a real build + boot +
  health/ready + fail-loud check.
- **BLOCKER, fixed and verified** — `/health`/`/ready` could report ready
  during a real, ongoing database outage (this gate's own BLOCKER
  example, verbatim). Fixed with `pingDB()`; verified with a real
  outage/recovery integration test, not a mock alone.
- **MEDIUM** — no automated migration step in the deploy pipeline; a real
  deploy still depends on an operator remembering to run `prisma migrate
deploy`. Already documented in the existing Troubleshooting section;
  not fixed with unverified Render-specific YAML (rule against inventing
  infrastructure).
- **LOW** — `REDIS_URL` is provisioned in `docker-compose.yml`/documented
  in `.env.example` but read by no application code — either wire it up
  when something needs it, or remove the unused provisioning;
  informational.
- **LOW** — CI's new `test` job has not yet been observed passing on a
  live GitHub Actions run (no `gh` CLI access in this environment) —
  recommend confirming on the next push.

### Deferred / External

| Item                                                        | Status                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `atlasappruntime.com.br` / `api.atlasappruntime.com.br` DNS | EXTERNAL/DEFERRED — confirmed unregistered                        |
| Live Render/Vercel deployment                               | EXTERNAL/DEFERRED — not provisioned                               |
| Real backup/restore                                         | EXTERNAL/DEFERRED — depends on hosting platform                   |
| Live rollback drill                                         | EXTERNAL/DEFERRED — no production to drill against                |
| Stripe integration                                          | EXTERNAL/DEFERRED — unchanged, not created (out of scope, rule 8) |
| MFA `disable` reconfirmation / `userId` binding             | DEFERRED — unchanged since 46.28/46.29                            |

### Final Verdict

```text
ATLAS 46.31 — COMPLETE
READY FOR DEPLOYMENT GATE
```

Not GO-LIVE. Two real blockers were found and fixed this sprint — the
production Docker image did not boot at all, and health/readiness could
false-positive during a real outage — both now verified against real
infrastructure, not just re-read source. What remains before an actual
first client is exclusively external/platform-dependent (DNS, a live
Render/Vercel deployment, managed backups) — nothing left is a code gap
this repository controls.

## ATLAS 46.32 — Production Deployment Gate

Turned 46.31's local/containerized readiness into a reproducible,
auditable deployment artifact: reconfirmed the Docker fix survives a
genuinely clean (`--no-cache`) rebuild, closed two real gaps 46.31 didn't
reach (graceful shutdown under a _real_ SIGTERM, and an automated —
not just manual — proof that the production secret gate actually refuses
to boot), and extended the existing smoke-check script into a proper
deployment harness. No business features; no external infrastructure
invented.

### Docker reproducibility (Phase 2)

Rebuilt the image with `--no-cache` — zero reused layers, a genuine
from-scratch build, not a cache artifact of 46.31's fix — and it built and
booted identically: `/health`/`/ready` both 200 against a freshly-migrated
database, Docker's own `HEALTHCHECK` reports `healthy`. Confirms 46.31's
fix is durable, not incidental to one machine's cache state.

### Health/Readiness (Phase 3)

`pingDB()` (46.31) reconfirmed correct — no change needed. `REDIS_URL` is
still provisioned in `docker-compose.yml`/`.env.example` and still read by
no application code. Per this gate's explicit instruction, **not** turned
into a required dependency just because the variable exists — kept exactly
as-is. **LOW/DEFERRED**, unchanged from 46.31: either wire it up when
something actually needs it, or remove the unused provisioning; not this
sprint's call to make either way.

Added `production-fail-loud.test.ts` — 46.31 verified the production
secret gate manually (interactively, while root-causing the Docker
blocker); nothing captured it as a repeatable test. This does, against the
real image: `NODE_ENV=production` with required secrets missing exits
non-zero, logs `Refusing to start in production`, and never opens the
port; the mirror case (a complete, valid secret set) boots and serves.

**Secondary finding surfaced while writing that test**, not something this
sprint set out to look for: with an _unreachable_ `DATABASE_URL`,
`ControlPlaneStore`'s own eager, unguarded startup seeding (a real Prisma
query fired independently of `main()`'s carefully-ordered secret checks)
throws first and wins the race — a raw, unformatted Prisma stack trace
reaches the log instead of `assertProductionSecretsConfigured`'s clean
message. The exit code is still correctly non-zero either way (the
container still correctly never becomes healthy), and no secret value is
ever printed by either path — so this doesn't change any pass/fail
verdict, but the diagnostic quality is worse than intended if both
problems coincide. **MEDIUM**, recorded in Findings, not fixed —
untangling `ControlPlaneStore`'s eager seeding from request-time
initialization is a real refactor, out of scope for a sprint that isn't
meant to introduce architecture changes.

### Graceful shutdown (Phase 4)

`index.ts` already had a real handler (`SIGTERM`/`SIGINT` ->
`server.close()` -> `disconnectDB()` -> `process.exit(0)`, 10s forced-exit
fallback) — but nothing precisely proved it takes the graceful path rather
than the forced one. The obvious test — spawn the built artifact,
`child.kill('SIGTERM')` — turned out to be the wrong tool: on Windows
(this repo's primary dev environment), Node's SIGTERM emulation doesn't
reliably reach a registered `process.on('SIGTERM')` handler, so that
approach can't distinguish "handled gracefully" from "just got killed."
`graceful-shutdown.test.ts` instead uses a real container and `docker
stop`, which sends a genuine POSIX SIGTERM regardless of host OS —
confirmed directly: exit code 0, `Received SIGTERM`/`API server stopped`
in the logs, in well under a second, comfortably inside the 10s window.

### Migration deployment safety (Phase 5)

Unchanged: both migrations remain additive-only; no destructive migration
exists. No automated migration step exists in the deploy path — `docker
build`/the container `CMD` never run `prisma migrate deploy`, and
`render.yaml` has no pre-deploy hook — this is the same gap 46.31
identified and is still a manual operator step (see the First Client
Operating Procedure in 46.31's section above, steps 1–3, and
Troubleshooting's `relation "X" does not exist` entry). Not invented here:
no Render-specific pre-deploy YAML feature was assumed without evidence
in this repository.

### Database safety (Phase 6)

No schema, transaction, or isolation code changed this sprint. Re-proved
via the full suite (below) rather than re-derived: tenant isolation,
Client Zero, runtime registration, and transactional rollback tests all
still pass, unchanged.

### CORS / production configuration (Phase 7)

Reconfirmed consistent across `render.yaml`, `.env.example`,
`scripts/validate-env.js`, `docker/Dockerfile.api`, `.github/workflows/ci.yml`,
and `services/production-secrets.ts` — all closed in 46.31, no drift
found. `CORS_ALLOWED_ORIGINS` still fails loud in production; no
`Access-Control-Allow-Credentials` anywhere (confirmed by a fresh grep,
Phase 14). No `.env` file is tracked in git (only `.env.example`, which
holds no real values).

### CI production gate (Phase 8)

`.github/workflows/ci.yml`'s `test` job (added 46.31) now also builds the
real production image (`docker build -f docker/Dockerfile.api -t
atlas-api:docker-test .`) before `pnpm test`, so `graceful-shutdown.test.ts`
and `production-fail-loud.test.ts` actually run there instead of skipping
— both look for that exact tag and skip cleanly, not falsely-pass, if it's
absent. **This sprint has no `gh` CLI or other GitHub Actions access in
this environment — the workflow's YAML is validated locally (parses, job
graph is correct) but its actual execution on a live runner has not been
observed.** Recorded honestly, not claimed:

```text
CI REAL EXECUTION — EXTERNAL / DEFERRED
```

Recommended follow-up: confirm the `test` job passes on the Actions run
this sprint's push triggers.

### Deployment smoke test harness (Phase 9)

Extended `scripts/atlas-production-readiness.mjs` (46.20) rather than
building a second script — it already checked exactly what this phase
asks for (build artifact, environment, migrations, `/health`, `/ready`,
authentication, persistence + tenant isolation, CORS) against a live,
already-running instance, self-cleaning, non-destructive. Added
`ATLAS_BASE_URL` env-var support (`--api-url` still takes precedence if
both are given) — no domain is ever hardcoded, and the effective target
plus which source it came from is always printed first, so a real
deployment target can never be silently confused with the `localhost`
dev default. Verified with a real local run: correctly targets, correctly
reports PASS/BLOCKED per check.

### Backup / restore boundary (Phase 11)

Unchanged from 46.31 — reconfirmed, not re-derived: the only backup/
restore code in this repository (`routes/v1/ha/backups.ts`, `restore.ts`,
`modules/ha/backup-service.ts`/`ha-store.ts`) is an in-memory DR-dashboard
simulation, not real `pg_dump`/`pg_restore` against the actual database.

```text
BACKUP/RESTORE REAL — EXTERNAL / DEFERRED
```

To be validated once a real production database exists (not before, and
not simulated in its place):

- Automated backup schedule and retention policy (depends on the hosting
  platform's managed Postgres offering once provisioned).
- A real restore actually executed against a non-production copy, not
  just assumed to work because a backup file exists.
- Point-in-time recovery, if the platform offers it.
- Documented, dated evidence of at least one successful test restore
  before it's trusted for a real incident.

### First Deployment Checklist (Phase 12)

For the first real deployment. Items outside this repository's control
stay unchecked here by design — checking them prematurely would be the
inaccuracy this gate exists to prevent.

**Infrastructure**

- [ ] DNS configured (`atlasappruntime.com.br` / `api.atlasappruntime.com.br`
      — confirmed unregistered as of 46.31/46.32, real DNS lookup, not
      assumed)
- [ ] API URL configured
- [ ] TLS/HTTPS active
- [ ] Database provisioned (managed Postgres, not the local dev container)
- [ ] Secrets configured (all 8 in the Environment Contract table above,
      real production values, never the dev fallbacks)
- [ ] CORS configured (`CORS_ALLOWED_ORIGINS` set to the real frontend
      origin(s))
- [ ] Redis decision confirmed (still unused by application code as of
      this sprint — either provision it because something now needs it,
      or don't provision it at all; don't provision it "just in case")

**Application**

- [x] Docker image builds — verified, reproducibly, `--no-cache`
- [x] Application boots (`NODE_ENV=production`, full secret set) — verified
- [x] Health — verified, including real mid-life-outage detection
- [x] Readiness — verified, same
- [ ] Migrations applied against the real production database (manual
      step — see Phase 5 above; not automated in this pipeline)
- [ ] Smoke tests run against the real deployed URL
      (`ATLAS_BASE_URL=<real-url> node scripts/atlas-production-readiness.mjs`)

**Client Zero**

- [x] Tenant — verified (46.30 E2E, reconfirmed passing this sprint)
- [x] Runtime — verified
- [x] Authentication — verified
- [x] Heartbeat — verified
- [x] Discovery — verified
- [x] First job — verified
- [x] Persistence — verified

(All six checked here mean "proven in a real, local/containerized
environment" — re-running the same acceptance flow against the real
deployed URL once it exists is still the operator's job before trusting a
real client on it.)

**Operations**

- [ ] Logs — structured logger confirmed never leaking secrets/stack
      traces to clients (verified); a real log aggregation destination is
      a platform decision, not made here
- [ ] Backup — EXTERNAL/DEFERRED, see above
- [x] Rollback — mechanism documented (platform-native prior-deploy
      redeploy); not drillable without a live deployment
- [ ] Monitoring — no monitoring/alerting platform integration exists in
      this repository; not invented here
- [ ] Incident procedure — Troubleshooting section above covers known
      failure signatures; a full on-call/incident process is an
      operational decision, not a code artifact

### Tests

Full `apps/api` suite run twice, independently: **91 files / 1802 tests,
0 failures, 0 flakes**, both passes (89 files / 1799 tests carried over
from 46.31, plus this sprint's 2 new Docker-based integration files —
`graceful-shutdown.test.ts` (1 test), `production-fail-loud.test.ts` (2
tests); `db-real-outage-recovery.test.ts` is unchanged from 46.31 — net
+2 files / +3 tests). `pnpm type-check`, `pnpm lint`, `pnpm build` all
clean. `pnpm install --frozen-lockfile` confirmed reproducible.

### Findings

- **MEDIUM** — an unreachable `DATABASE_URL` in production can let
  `ControlPlaneStore`'s eager startup seeding crash first with a raw,
  unformatted Prisma stack trace instead of the clean
  `assertProductionSecretsConfigured` message, if both conditions
  coincide. Exit code is still correctly non-zero either way; no secret
  value is ever printed. Not fixed — a real architectural untangling,
  out of scope for this sprint.
- **MEDIUM** — no automated migration step in the deploy pipeline
  (unchanged from 46.31); still a manual, documented operator step.
- **LOW** — `REDIS_URL` still provisioned but unused by any application
  code (unchanged from 46.31) — informational, deliberately not acted on
  per this sprint's own instruction.
- **LOW** — CI's `docker build`/`test` job execution has not been
  observed on a live GitHub Actions run in this environment (no `gh` CLI
  access) — recommend confirming on the push this sprint triggers.

No CRITICAL or HIGH findings. Final sweep (Phase 14): no `.env` files
tracked in git, no `Access-Control-Allow-Credentials` anywhere, no
`.only`/masking `.skip` in any test file (the three new Docker-based
tests use `describe.skip` only as an environment-capability guard,
identical in shape to 46.31's `db-real-outage-recovery.test.ts`), no new
secrets/tokens/credentials in logs or error responses, one pre-existing
`TODO` comment (`middleware/auth.ts`) describing an already-correctly-
`NODE_ENV==='development'`-gated dev shortcut — reviewed, confirmed safe,
not touched.

### External / Deferred

| Item                                                          | Status                                              |
| ------------------------------------------------------------- | --------------------------------------------------- |
| DNS (`atlasappruntime.com.br` / `api.atlasappruntime.com.br`) | EXTERNAL/DEFERRED — confirmed unregistered          |
| Live Render/Vercel deployment                                 | EXTERNAL/DEFERRED — not provisioned                 |
| CI real execution on a live Actions run                       | EXTERNAL/DEFERRED — no access from this environment |
| Real backup/restore                                           | EXTERNAL/DEFERRED — depends on hosting platform     |
| Live rollback drill                                           | EXTERNAL/DEFERRED — no production to drill against  |
| Monitoring/alerting integration                               | EXTERNAL/DEFERRED — no platform chosen              |
| Stripe integration                                            | EXTERNAL/DEFERRED — unchanged, not created          |

### Final Verdict

```text
ATLAS 46.32 — COMPLETE WITH RESERVATIONS
READY FOR DEPLOYMENT WITH EXTERNAL GATES
```

Every technical gate this repository controls passed, including two that
had never been automated before this sprint (real-SIGTERM graceful
shutdown, real-container production fail-loud). What remains is entirely
external — DNS, a live platform deployment, real managed backups, and
confirming this sprint's own CI change actually runs green — none of
which this sprint can execute or fake from here. Not GO-LIVE.
