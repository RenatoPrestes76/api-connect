# ADR: Canonical Atlas Client Onboarding

**Status**: Accepted
**Sprint**: ATLAS 46.21 — Canonical Client Onboarding & Identity Architecture Gate

## Contexto

ATLAS 46.20-B built a real, working Ed25519 client
(`apps/agent/src/atlas-runtime-client/`) for the `runtime-registration`
protocol, proven end-to-end (register → heartbeat → discover → GENESIS scan
→ ATHENA classification). That sprint's own final report flagged a
reservation: it wasn't clear which of three existing enrollment flows was
the _official_ one for a first real customer, nor how the new client's
identity related to the Tenant/Organization model ATLAS 46.19 established
in Postgres.

ATLAS 46.21 audited all three flows and the identity graph beneath them by
tracing actual code (`docs/ATLAS-RUNTIME-ONBOARDING-MATRIX.md`,
`docs/ATLAS-HEARTBEAT-ARCHITECTURE.md`). The headline finding: **three
disjoint "Organization" concepts and three disjoint "Runtime" concepts
coexist**, none formally joined by a Prisma relation:

1. Prisma `Organization` (real, FK to `Tenant`, admin-visible via Control
   Plane's Tenants/Organizations pages) — established ATLAS 46.19.
2. `portal-identity`'s in-memory `OrganizationRecord` (self-service signup,
   `POST /api/v1/portal/auth/register`) — non-durable, own UUID space.
3. `AtlasAgent.companyId` — a free string, no FK, no relation at all.

And on the Runtime side:

1. `RuntimeRegistrationRecord` (Ed25519, in-memory) — cryptographically
   real, replay-protected, the only flow with ERP discovery
   (GENESIS/ATHENA) capability, has a real client (46.20-B) and a
   dedicated admin UI page ("Atlas Runtimes").
2. Prisma `Agent` (real FK to `Organization`/`Environment`) — genuinely
   persistent and properly related, but its only client
   (`apps/agent`'s `_registerWithCloud()`) never sends the fields the
   route requires, so it is currently non-functional.
3. control-plane-store's own in-memory `Runtime` type — seeded fixture
   data only, disconnected from every real registration flow, powers the
   generic `/admin/control-plane/runtimes` "fleet" page.

## Identidade — matriz

| Identidade                | Criada por                                                                        | Persistida em                                                              | Consumidores                                                                                                 | Fonte de verdade                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Human (admin)             | `admin-identity` module                                                           | In-memory (`admin-identity-store.ts`)                                      | Control Plane admin UI login                                                                                 | `admin-identity` (unchanged, out of scope)                                                                       |
| Human (portal user)       | `portal-identity` module                                                          | In-memory (`portal-identity-store.ts`)                                     | `apps/web` portal login                                                                                      | `portal-identity` (unchanged, out of scope)                                                                      |
| **Tenant**                | Control Plane admin (`POST /admin/control-plane/tenants`) or `tenancyRepository`  | **Prisma `Tenant`** (Postgres, real)                                       | Control Plane admin UI, `tenancyRepository`                                                                  | **Prisma `Tenant`**                                                                                              |
| **Organization**          | Control Plane admin, _or_ (as of 46.21) automatically at portal self-registration | **Prisma `Organization`** (Postgres, real)                                 | Control Plane admin UI, `tenancyRepository`, (46.21) `runtime-registration` via `controlPlaneOrganizationId` | **Prisma `Organization`**                                                                                        |
| Organization (portal)     | Self-service signup                                                               | In-memory `OrganizationRecord`                                             | `portal-identity` module, `runtime-registration`'s `organizationCode` resolution                             | Not of record — a UI/billing-adjacent record that now (46.21) carries a pointer to the real one                  |
| Organization (AtlasAgent) | `apps/runtime-installer`'s activation flow                                        | `AtlasAgent.companyId` (free string)                                       | `apps/cloud`'s `(atlas)` dashboard                                                                           | Not of record — untouched this sprint, real consumer, no FK to fix without a larger change                       |
| **Runtime**               | Ed25519 registration (`POST /runtime/register`)                                   | **Prisma `RuntimeRegistration`** (Postgres, real — since 46.22; see below) | `apps/agent/src/atlas-runtime-client/`, "Atlas Runtimes" admin page                                          | **Prisma `RuntimeRegistration`** (see below — not Prisma `Agent`, despite `Agent` being more "properly" modeled) |
| Runtime (Agent legacy)    | `POST /api/v1/agents/register`                                                    | Prisma `Agent`                                                             | None functional (broken client)                                                                              | Not of record — real FK, zero real data, no working client                                                       |
| ERP connection            | `POST /erp-connectivity/profiles`                                                 | In-memory (`erp-connectivity-store.ts`)                                    | `erp-metadata` discovery flow                                                                                | Unchanged, out of scope                                                                                          |

## Decisão

### Canonical Enrollment: **A — `apps/agent` + `runtime-registration` + Ed25519**

Chosen because it's the only flow that satisfies the decision criteria
with real evidence, not just adequate modeling:

- **Segurança**: Ed25519 signatures, replay protection (timestamp window +
  signature dedupe). Agent legacy and Runtime Installer have neither.
- **ERP connectivity**: the _entire point_ of the Atlas Runtime product —
  discovery → GENESIS → ATHENA → semantic mapping → canonical model — only
  exists in this flow. Neither other flow has any discovery capability at
  all; they are presence/heartbeat trackers, not ERP-connecting Runtimes.
- **Lifecycle/instalação**: `apps/agent` has a real 7-phase bootstrap; the
  Ed25519 path is wired into it as a real, opt-in step (46.20-B).
- **Suporte/atualização**: `docs/ATLAS-RUNTIME-CLIENT.md` documents
  configuration, troubleshooting, and error codes already.
- Prisma `Agent` (Option "C"-adjacent) has better _referential_ modeling
  but zero working client and zero real data — choosing it now would mean
  building a client from scratch with none of the ERP-discovery value the
  product needs, which is a materially larger undertaking than bridging
  the winning flow's existing Organization gap (see Implementation below).
- Runtime Installer (Option B) has real Postgres persistence and a real
  consumer (`apps/cloud`) but no cryptographic security and no discovery —
  it is, on the evidence, a different product surface (fleet presence for
  the cloud dashboard), not a competing _ERP Runtime_ onboarding path.

### Tenant of Record

**Prisma `Tenant`** (`packages/database/prisma/schema.prisma`). The only
Tenant model in the system; nothing else claims the name.

### Organization of Record

**Prisma `Organization`**. Real, FK'd to `Tenant`, admin-visible. Every
other "Organization" concept (portal-identity's, `AtlasAgent.companyId`)
is a parallel, non-canonical record — portal-identity's is now (46.21)
explicitly linked to it via `controlPlaneOrganizationId`, not replaced.

### Runtime Identity of Record

**Prisma `RuntimeRegistration`** (Ed25519, `runtime-registration.repository.ts`;
TypeScript type name kept as `RuntimeRegistrationRecord` in
`runtime-registration-store.ts` for continuity). Chosen over Prisma `Agent`
specifically because it is the identity actually produced by the canonical
enrollment flow — an "of record" entity that no real client writes to is
not, in practice, of record.

As of **ATLAS 46.22**, this identity is Prisma-backed, not in-memory — see
"ATLAS 46.22 — Runtime Registration Persistence" below for the full
migration. The "making this durable is a real, larger migration explicitly
deferred" reservation carried by 46.21 is resolved.

### Heartbeat of Record

**`runtime-registration`'s `POST /runtime/heartbeat`** — see
`docs/ATLAS-HEARTBEAT-ARCHITECTURE.md` for the full comparison. Not merged
with `atlas/heartbeat.ts`, which keeps serving its own real consumer
(`apps/cloud`'s dashboard) unchanged.

### Legacy

| Fluxo                                                         | Decisão       | Justificativa                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/agent` legacy cloud registration (`_registerWithCloud`) | **DEPRECATE** | Currently broken (missing required fields — see onboarding matrix) and superseded in capability by the Ed25519 path within the same app. Not removed this sprint: no proof of zero consumers of the underlying `/api/v1/agents/*` route family beyond the broken client itself, and removing dead-but-harmless code isn't this sprint's mandate. |
| `apps/runtime-installer`                                      | **KEEP**      | Real, working, Prisma-persisted, has a genuine consumer (`apps/cloud`'s `(atlas)` dashboard). Serves a different purpose (fleet presence for the cloud console) than the ERP Runtime this sprint is about — not a competing onboarding path to retire.                                                                                           |

### Client Zero

The official, evidence-based install flow for a first customer:

```
Customer signs up
  -> POST /api/v1/portal/auth/register (portal-identity)
       -> (46.21) also creates/links a real Prisma Organization
          via controlPlaneOrganizationId
  -> Admin issues an activation key
       POST /admin/runtime-registration/activation-keys {organizationCode}
  -> Customer installs apps/agent, sets ATLAS_API_URL / ATLAS_ORGANIZATION_CODE
     / ATLAS_ACTIVATION_KEY (+ ATLAS_SCAN_DB_* for real discovery)
  -> apps/agent's bootstrap Phase 7 runs the Ed25519 client:
       generates identity -> POST /runtime/register
       -> heartbeat -> ACTIVE
       -> POST /runtime/auth/token -> JWT session
  -> Admin sees it in apps/admin's "Atlas Runtimes" page, and (46.21) can
     look it up under its real Organization via
     GET /admin/control-plane/organizations/:id/runtimes
  -> Admin creates an ERP connection profile + discovery request
  -> The Runtime polls, executes a real GENESIS scan, submits the result
  -> ATHENA classifies it server-side automatically
```

Proven live in `apps/api/src/__tests__/runtime-registration/client-zero-e2e.test.ts`
(ATLAS 46.21) and, with a real API process kill/restart spliced into the
middle of the same flow, in
`apps/api/src/__tests__/runtime-registration/restart-durability-e2e.test.ts`
(ATLAS 46.22) — both over real HTTP.

## Consequências

**Benefícios**: one unambiguous answer to "which client, which identity, how
does it appear in the Control Plane" — the question this sprint exists to
answer. The new `controlPlaneOrganizationId` link is small, additive,
non-breaking, and closes the most damaging gap (Runtimes registered by
real customers being invisible to/unlinked from the real Organization
graph) without a rewrite.

**Custos**: as of ATLAS 46.22, `RuntimeRegistration` is Prisma-backed (see
below) — the in-memory-loss cost described in 46.21's original text no
longer applies. What remains open: the Tenant-provisioning commercial
policy is still undecided (see the new section below), and STALE/OFFLINE
heartbeat computation is still deferred.

**Riscos / reservations carried forward**:

- STALE/OFFLINE computation for the canonical heartbeat (available
  off-the-shelf in `@seltriva/agent-observability`, unused here) — still
  deferred, per `docs/ATLAS-HEARTBEAT-ARCHITECTURE.md`. Not attempted in
  46.22 either — explicitly out of that sprint's scope too.
- `apps/agent`'s legacy cloud registration remains broken and un-retired —
  a decision for whoever owns that route's actual (if any) production
  usage.
- `AtlasAgent.companyId`'s lack of a real FK to Organization/Tenant was
  identified but not touched — `apps/runtime-installer`/`apps/cloud`'s
  flow is a real, working, separate product surface, and adding a FK to a
  live table with existing data is a bigger, riskier change than either
  sprint's "pequenos ajustes" mandate allows.
- Tenant commercial provisioning policy (whether/when a self-service
  signup gets assigned a real Tenant) remains an **external product
  decision**, not made by 46.21 or 46.22 — see the new section below.

## ATLAS 46.22 — Runtime Registration Persistence

**Sprint**: ATLAS 46.22 — Runtime Registration Persistence & Tenant
Provisioning Gate.

### Identity

`RuntimeRegistration` (Prisma model, `packages/database/prisma/schema.prisma`)
— a new, dedicated model, not a reuse of `Agent` or `AtlasAgent` (see
"Identidade — matriz" above for why neither fit without either conflating
concepts or requiring a much larger out-of-scope migration). Columns:
`machineFingerprintHash` (unique), `publicKey` (unique), `hostname`, `os`,
`architecture`, `version`, `status`, `capabilities`, `lastHeartbeat`,
`lastHeartbeatSignature`, `lastMemoryMb`, `lastCpuPercent`,
`lastUptimeSeconds`, `registeredAt`, `activatedAt`. The private key never
touches this table (or any server-side storage) — only the public key,
matching the original protocol.

### Persistence

`apps/api/src/modules/runtime-registration/runtime-registration.repository.ts`
is the sole file touching `prisma.runtimeRegistration`, mirroring the
`tenancy.repository.ts` pattern established in ATLAS 46.19. Every
`runtime-registration-store.ts` method (`registerRuntime`, `getRuntime`,
`listRuntimes`, `findByFingerprintHash`, `recordHeartbeat`, `blockRuntime`,
`reactivateRuntime`, `revokeCertificate`, `isReplayedSignature`) is now
`async` and delegates fully to the repository — no in-memory cache layer,
consistent with how Tenant/Organization themselves are handled (not the
seed-once-at-boot pattern the rest of `control-plane-store.ts` uses for
its still-static entities).

### Restart

Proven with a real spawned `node dist/index.js` process, killed (SIGTERM)
and restarted on the same port mid-test —
`apps/api/src/__tests__/runtime-registration/restart-durability-e2e.test.ts`.
After restart: the Runtime is still visible via the admin API and the
46.21 Control Plane lookup, the client's own persisted identity file still
resolves the same `runtimeId`, heartbeat and the auth/token exchange both
still work, and — extended in the same test for 46.22 — a full ERP
discovery → real GENESIS scan → ATHENA classification cycle still
completes against the new process, proving the whole platform's state
(not just the Runtime row) survived the restart.

### Tenant / Organization

`RuntimeRegistration` deliberately has **no `tenantId` column**. Its Tenant
is always derived by joining `controlPlaneOrganizationId ->
Organization.tenantId`, so it can never drift out of sync with the
Organization's actual current Tenant — proven in
`apps/api/src/__tests__/runtime-registration/tenant-association.test.ts`
by reassigning an Organization's Tenant via the existing admin PATCH
endpoint and confirming the Runtime's derived Tenant updates with zero
writes to the Runtime record itself.

**Tenant provisioning policy: EXTERNAL DECISION, NOT MADE THIS SPRINT.**
46.22 does not assume `signup -> new Tenant`, does not create a
default/system/fake Tenant, and does not assign `tenantId = 0` or any
placeholder value. Every self-service portal signup's Organization has
`tenantId = null` until an admin explicitly assigns one via the Control
Plane. This is the honest, currently-real state of every organic signup
in this system today, not a temporary shortcut — see PENDING TENANT
ASSIGNMENT below.

### PENDING TENANT ASSIGNMENT

Not a new field, enum value, or fake Tenant — it is the natural state
where `RuntimeRegistration.controlPlaneOrganizationId IS NOT NULL AND
Organization.tenantId IS NULL`. Any consumer deriving a Runtime's Tenant
must handle this as an honest absence (`null`), never substitute a
fabricated identifier. Proven in `tenant-association.test.ts`'s first
test case.

### Heartbeat

`recordHeartbeat` persists `lastHeartbeat`, `status`, `lastMemoryMb`,
`lastCpuPercent`, `lastUptimeSeconds`, `lastHeartbeatSignature`, and
(on first activation) `activatedAt` — all real Postgres columns, verified
directly (not just via the API response) in the restart-durability test.
**STALE/OFFLINE status computation remains explicitly deferred** — this
sprint only persists the raw heartbeat state; no background sweep or
timeout-based downgrade was built.

### Replay protection

Unchanged mechanism — ±5-minute timestamp window plus exact
last-accepted-signature dedupe, no separate nonce field (see
`docs/ATLAS-RUNTIME-CLIENT.md`). Classified **ACCEPTABLE**, not a
production blocker: both replay scenarios (stale timestamp, verbatim
resend) are covered by
`apps/api/src/__tests__/runtime-registration/runtime-registration-routes.test.ts`
and continue to pass against the persisted repository. As a direct
side effect of this sprint's persistence work, replay protection is
now strictly _more_ durable than before 46.22: `lastHeartbeatSignature`
is a real Postgres column, so the dedupe guard now survives an API
restart, where previously (in-memory) it would have been silently wiped.

### Security review

- Private key: never sent to, or stored by, the server — only
  `identity.publicKeyPem` is ever transmitted (see `client.ts`'s
  `registerRuntime`). Unchanged this sprint.
- Public key: persisted (`RuntimeRegistration.publicKey`, unique).
- Signature: only `lastHeartbeatSignature` is persisted — the single
  field the replay-dedupe mechanism requires, nothing beyond it (no
  history of every signature ever received).
- No separate nonce/keyId concept exists in this protocol (confirmed
  again this sprint) — identity consistency is enforced via the unique
  `machineFingerprintHash` and unique `publicKey` columns instead;
  `apps/api/src/__tests__/runtime-registration/registration-idempotency.test.ts`
  proves same-fingerprint and same-public-key duplicate registrations are
  both rejected, including under real concurrent-request race conditions
  (the DB-level unique constraint is the actual guard, not just an
  application-level pre-check).
- Cross-tenant / cross-organization isolation: proven in
  `tenant-association.test.ts` and `client-zero-e2e.test.ts`'s negative
  cases — one Organization's Control Plane Runtime lookup never includes
  another's Runtime.
- Control Plane authorization: unchanged, still enforced by
  `requirePermission('companies.read')` on every lookup route; the
  unauthenticated-request negative case is covered in
  `client-zero-e2e.test.ts`.
- Ed25519 signing/verification itself: untouched — this sprint changed
  only the persistence layer beneath an already-shipped, already-tested
  protocol.

## ATLAS 46.23 — Runtime Liveness & Commercial Tenant Onboarding

**Sprint**: ATLAS 46.23 — Runtime Liveness & Commercial Tenant Onboarding
Gate. Builds directly on 46.22's baseline (Prisma-backed
`RuntimeRegistration`, restart-durable, `Organization.tenantId`-derived
Tenant association) — nothing about that baseline changed shape this
sprint; no migration was needed.

### Liveness

`ONLINE` / `STALE` / `OFFLINE` — a **second, orthogonal** dimension to the
existing `status` (`PENDING`/`REGISTERED`/`ACTIVE`/`BLOCKED`/`REVOKED`),
not a replacement or a parallel state machine. `status` keeps its
pre-46.23 meaning exactly: the Runtime's registration lifecycle, changed
only by explicit actions (register, first-heartbeat activation, block,
reactivate, revoke). Liveness answers a different question — "is this
Runtime checking in right now" — and is **never stored**: it is
recomputed, fresh, on every read, by a pure function of
`(lastHeartbeat, now, thresholds)` — see
`apps/api/src/modules/runtime-registration/liveness.ts`.

- **ONLINE**: last heartbeat within `LIVENESS_ONLINE_WINDOW_MS` (60s = 2x
  the default 30s heartbeat cadence already established in
  `runtime-registration-store.ts`'s `DEFAULT_RUNTIME_CONFIG` — tolerates
  exactly one missed beat before downgrading).
- **STALE**: last heartbeat beyond the ONLINE window but within
  `LIVENESS_STALE_WINDOW_MS` (5 minutes — reuses, unchanged, the
  `policies.maxHeartbeatGapMs` value already advertised to every Runtime
  at registration time in `routes/v1/runtime-registration/register.ts`,
  not a new number).
  Runtime known and registered, just not currently reachable.
- **OFFLINE**: last heartbeat beyond the STALE window, **or no heartbeat
  ever recorded** (`lastHeartbeat === null` — never observed, which is a
  different, stronger absence than "was seen and aged out").
- **Future timestamps** (clock skew — `lastHeartbeat` is always
  server-assigned at write time, never client-supplied, so this can only
  be legitimate drift, never an attacker-controlled value): the gap is
  clamped to zero, classified ONLINE. Explicit, safe, never a crash.
- **Source of truth**: `RuntimeRegistration.lastHeartbeat` (Postgres),
  exactly the column 46.22 made durable. No cache, no background sweep, no
  in-memory liveness state anywhere — a restart cannot desynchronize
  liveness because there is nothing to desynchronize.

Exposed additively as `liveness` on `RuntimeRegistrationDTO` (every
`toDTO()` call site: the admin list/detail/block/reactivate routes and the
46.21 Control Plane organization-runtimes lookup) and on the
`POST /runtime/heartbeat` response — both backward-compatible field
additions, no existing field removed or repurposed.

Proven in `apps/api/src/__tests__/runtime-registration/liveness.test.ts`
(pure-function unit tests: recent heartbeat, both boundaries exactly and
just beyond, no heartbeat, future timestamp, restart-independence via
identical-input determinism, custom thresholds) and, for the persistence
angle specifically, in `restart-durability-e2e.test.ts`'s steps 4b/4c: a
real restarted process computing ONLINE right after a fresh heartbeat,
then STALE and OFFLINE after directly backdating `lastHeartbeat` in
Postgres (a controlled-timestamp transition — no real sleep, no flake
risk).

### Tenant onboarding — formalized, not changed

The real, already-existing flow, now stated explicitly rather than left
implicit:

```
Signup (POST /api/v1/portal/auth/register)
  -> Organization created, linked via controlPlaneOrganizationId (46.21)
  -> Organization.tenantId is null (PENDING TENANT ASSIGNMENT — legitimate,
     not an error state, not temporary scaffolding)
  -> Runtime registers and heartbeats normally — entirely independent of
     Tenant; ACTIVE/ONLINE never requires a Tenant to exist
  -> An admin explicitly assigns a Tenant:
     PATCH /admin/control-plane/organizations/:id { tenantId }
     (tenancyRepository.updateOrganization — validates the Tenant exists,
     in the same transaction as the write; ATLAS 46.22)
  -> The Runtime's derived Tenant (joined through
     controlPlaneOrganization.tenantId) updates immediately, with zero
     writes to the Runtime row
```

**This sprint did not build automatic Tenant provisioning**, and
explicitly was not asked to. `PATCH /admin/control-plane/organizations/:id`
already **is** the provisioning point — explicit, admin-controlled, this
sprint's job was to confirm and test its boundary, not add a new one:

- **Reassignment** (Tenant A → Tenant B): the Runtime's derived Tenant
  follows immediately; no duplicate Organization or RuntimeRegistration
  row is ever created — it is an update to one existing column, not an
  insert. Proven in `tenant-association.test.ts`.
- **Removal** (`tenantId: null`): already supported by 46.22's
  `updateOrganization` (the `patch.tenantId !== undefined` write path
  accepts `null`) — the Organization returns to a legitimate, honest
  PENDING_TENANT_ASSIGNMENT state. **No fallback/default Tenant is ever
  substituted.** Proven in `tenant-association.test.ts`.
- **Client-supplied `tenantId` cannot influence ownership.** There is no
  `tenantId` field anywhere in `RegisterRuntimeInput` or
  `ListRuntimesQuerySchema` — an injected `tenantId` in a registration
  body or as a query-string parameter on the Organization-scoped Runtime
  lookup is structurally inert, not merely "rejected." Proven in
  `tenant-association.test.ts` by literally injecting one and confirming
  zero effect on the result.
- **Concurrency**: two simultaneous Tenant (re)assignments on the same
  Organization are a normal last-write-wins race on a single scalar FK
  column — not a corruption risk (there is no multi-row invariant to
  protect here, unlike `createOrganization`'s tenant-existence check,
  which already runs inside a transaction from 46.22). Both requests
  complete cleanly; the Organization ends up with exactly one of the two
  Tenants; no duplicate row of any kind results. Proven in
  `tenant-association.test.ts`.

**Tenant commercial provisioning policy remains an external product
decision, unchanged from 46.22** — this sprint formalizes and tests the
technical boundary (`PATCH .../organizations/:id` as the explicit
provisioning point) without deciding _when_ or _whether_ a self-service
signup should automatically receive one.

## ATLAS 46.24 — Production Client Onboarding & Operational Readiness Gate

**Sprint**: ATLAS 46.24. Does not change the architecture established by
46.19–46.23 — this sprint proves the already-built components function
together as one reproducible onboarding operation, and closes the small,
genuinely missing pieces found while proving it.

### Canonical flow, consolidated

```
Signup (POST /api/v1/portal/auth/register)
  -> Organization (real, linked via controlPlaneOrganizationId)
  -> Organization.tenantId is null (PENDING TENANT ASSIGNMENT, legitimate)
  -> Tenant provisioned explicitly (PATCH .../organizations/:id)
  -> Activation Key issued (single-use, bound to one organizationCode)
  -> Runtime generates its Ed25519 identity and registers
  -> Runtime heartbeats -> ACTIVE -> liveness ONLINE
  -> ERP discovery -> real GENESIS scan -> ATHENA classification
  -> Every relation above verified, directly in Postgres, to belong to the
     same Organization/Tenant/Runtime triple
```

Proven, fast and in-process, in
`apps/api/src/__tests__/runtime-registration/client-zero-onboarding-e2e.test.ts`
— the one file that walks this exact sequence including the Tenant step
(the one dimension `client-zero-e2e.test.ts` (46.21) didn't exercise, since
it predates this flow's Tenant-association test coverage), ending in a
direct-Postgres integrity audit (no orphans, no duplicate Organization/
RuntimeRegistration/Tenant rows, `tenantId` structurally absent from the
`RuntimeRegistration` row) and one negative case (ERP discovery against a
nonexistent Runtime -> `RUNTIME_NOT_FOUND`, 404).

The same flow, restart included, is proven in
`restart-durability-e2e.test.ts` — extended this sprint to add the Tenant
step to pass 1 and, in pass 2, confirm the Runtime's _derived_ Tenant
(joined through `controlPlaneOrganization.tenantId`) still resolves
correctly from a process that never held the Tenant assignment in memory.

### Isolation checklist (Part C)

Consolidated in the new
`apps/api/src/__tests__/runtime-registration/onboarding-isolation.test.ts`,
which states explicitly what's proven where rather than re-testing
everything from scratch:

1. Client A's Runtime is invisible from Client B's Organization-scoped
   lookup, and vice versa — proven fresh in this file.
2. Two Organizations that legitimately share one real Tenant still keep
   their Runtimes strictly separate — proven fresh in this file (a
   genuinely new scenario: prior tests only used one Organization per
   Tenant).
3. A Runtime can never be arbitrarily pulled into a foreign Tenant — same
   test as #2; structurally true since `RuntimeRegistration` has no
   `tenantId` column for anything to write to.
4. A client-supplied `tenantId` cannot alter ownership — already proven in
   `tenant-association.test.ts` (46.23).
5. **An Activation Key issued for Organization A is rejected when
   presented with Organization B's `organizationCode`** — genuinely new
   this sprint. Prior coverage (`runtime-registration-routes.test.ts`)
   only exercised a bogus key _string_; this closes the real gap of a
   _valid_ key used against the wrong Organization. The rejected attempt
   also leaves the key unconsumed and still valid for its real owner.
6. A public key or fingerprint already registered elsewhere cannot be
   reused, including under a real concurrent-request race — already
   proven in `registration-idempotency.test.ts` (46.22).

### Observability (Part L)

`GET /admin/runtime-registration/runtimes/:id` now additionally returns
`organization: {id, name} | null` and `tenant: {id, name} | null`,
computed at read time from `controlPlaneOrganizationId` (exactly the same
derivation `liveness` used in 46.23 — nothing new stored, nothing cached).
Closes a real small gap: previously, answering "which Organization/Tenant
is this Runtime under" required three separate admin calls
(Runtime → Organization → Tenant); now the first call answers it. No
dashboard, no alerting, no background sweep was built — out of scope,
per this sprint's explicit boundary.

### Production readiness — re-audited, not re-built

`apps/api/src/services/production-secrets.ts` (ATLAS 46.20) already
validates every secret-bearing env var this onboarding flow depends on
(`RUNTIME_JWT_SECRET`, `RUNTIME_CERT_SECRET`, plus the others unrelated to
Runtime onboarding specifically) and `CORS_ALLOWED_ORIGINS`, failing loud
at boot in production. Re-audited this sprint against the full onboarding
chain — nothing new needed validating (liveness thresholds and Activation
Key data are not secrets). `docs/ATLAS-PRODUCTION-DOMAIN.md`'s domain/DNS
plan is unchanged and re-confirmed still `RESERVED / NOT YET REGISTERED` —
no domain, DNS, or deploy action was taken or simulated.

See `docs/ATLAS-PRODUCTION-RUNBOOK.md`'s new "First Client Onboarding
Runbook" section for the executable, code-knowledge-free walkthrough this
sprint produced, and the **Production Readiness** split (Software /
Configuration / Infrastructure / Commercial) in ATLAS 46.24's final report
for exactly what remains externally pending.

## ATLAS 46.25 — Production Operations & Runtime Observability Gate

**Sprint**: ATLAS 46.25. Turns 46.23's liveness classification into
enough operational surface to actually run a first real client — small,
additive extensions to the existing Control Plane, no new architecture.

### Runtime operational view (Part A) — already mostly there, confirmed

`GET /admin/runtime-registration/runtimes/:id` (enriched in 46.24 with
`organization`/`tenant`) already carries everything an operator needs:
`runtimeId`, `hostname`, registration `status`, `liveness`,
`lastHeartbeat`, `activatedAt`, Organization/Tenant. Confirmed this
sprint, in `runtime-operational-view.test.ts`, that it never returns a
private key, a signature, or any other credential material — nothing
changed there, since nothing sensitive was ever in the DTO to begin with.

### List filters and operational summary (Part B/C)

`GET /admin/runtime-registration/runtimes` gains three new, optional,
backward-compatible query filters: `controlPlaneOrganizationId` (already
supported internally, now exposed at the HTTP layer), `tenantId` (new —
filters through the `controlPlaneOrganization` relation, since Tenant is
still not a column on `RuntimeRegistration`), and `liveness`
(ONLINE/STALE/OFFLINE — applied in the application layer after the
persisted-data filters run, since liveness has no column to filter on at
the database level; see `runtime-registration-store.ts`'s `listRuntimes`).

New endpoint: `GET /admin/runtime-registration/summary` — `{total,
online, stale, offline}`, optionally scoped by the same three filters.
Computed live from the same rows `listRuntimes` itself would return for
that scope — no persisted counter, no cache, so it can never drift out of
sync with what the list endpoint reports (proven directly in
`runtime-operational-view.test.ts` by cross-checking the two responses
for the same scope).

**Naming note**: `/admin/control-plane/runtimes` already exists — it is
the _legacy, in-memory, fixture-seeded_ `Runtime` concept `control-plane-
store.ts` has always had (see this ADR's original "Identidade — matriz"
table, "control-plane-store's own in-memory `Runtime` type — seeded
fixture data only, disconnected from every real registration flow").
The new summary endpoint deliberately lives under `/admin/runtime-
registration/summary` instead, to avoid conflating the two — this sprint
does not touch, rename, or migrate the legacy fleet endpoint.

### Multi-client independence (Part N)

`runtime-isolation.test.ts` proves liveness is computed strictly
per-Runtime: Client A transitioning ONLINE → STALE → OFFLINE never
changes Client B's independently-ONLINE state, B's scoped summary, or B's
presence/absence in a `liveness=ONLINE`-filtered list — at every step,
including a direct comparison against the unscoped global summary to
confirm it aggregates rather than overwrites. The new filters also don't
compose into a way to leak another Organization's Runtimes (scoping by
`controlPlaneOrganizationId` and `liveness` together still returns exactly
the caller's own Runtime).

### Recovery, run twice (Part F/M)

`runtime-liveness-operation.test.ts` runs a full ONLINE → STALE → OFFLINE
→ ONLINE cycle **twice** in the same test, using controlled Postgres
timestamp writes (no real sleep) — proving the cycle is a repeatable,
stateless computation rather than a one-shot artifact of test ordering.
Combined with `restart-durability-e2e.test.ts` (which now also covers the
Tenant dimension, since 46.24), recovery is proven both across a real API
process restart and across a purely liveness-driven state cycle within
one still-running process.

### Logging (Part I) — one real gap found and closed

`server.ts`'s `requestLogger` never included the HTTP response status
code in its "request completed" log line — a rejected heartbeat
(`REPLAY_REJECTED`/`INVALID_SIGNATURE`, which return a clean `apiError()`
response rather than throwing) logged _identically_ to a successful one,
making a rejected heartbeat operationally indistinguishable from an
accepted one by log alone. Fixed by reading `res.statusCode` (previously
an unused, underscore-prefixed parameter) after the handler chain
resolves. No other logging gap was found: audit-trail entries
(`RUNTIME_REGISTERED`, `RUNTIME_ACTIVATED`, `RUNTIME_LOGIN`, etc.) already
carry only non-sensitive metadata (`organizationId`, `hostname`) — never a
signature, private key, JWT, or activation-key secret — confirmed by
direct audit of every `recordAudit()` call site in
`routes/v1/runtime-registration/`.

### API health vs. Runtime liveness (Part J)

Documented explicitly (see `docs/ATLAS-PRODUCTION-RUNBOOK.md`'s new
"Runtime Incident Troubleshooting" section) rather than renamed: `GET
/health`/`/live`/`/ready` describe the Atlas API _process_ — nothing about
any individual Runtime. A Runtime's `liveness` field is the only source
of truth for whether _that Runtime_ is checking in. No endpoint was
renamed — `/live` predates this sprint and renaming it would be a
breaking API change for a naming clarification that a doc section
resolves just as well.

### Alerting remains explicitly future work (Part K)

No email/SMS/WhatsApp/push/paging was built, and none was attempted. The
model is already shaped for a future alerting layer to consume without
any persistence change: `liveness`, `lastHeartbeat`, and the new
`GET .../summary` are all read-only, already-computed surfaces a future
poller could watch.

## ATLAS 46.26 — Production Security & Hardening (object-level authorization)

A follow-on, adversarial security audit (billing/security/ops/ha/portal),
directly relevant to this ADR's onboarding surfaces: the portal
organization self-service update endpoint
(`PATCH /api/v1/portal/organization`) had a mass-assignment gap letting an
org owner's PATCH body silently overwrite `controlPlaneOrganizationId` —
the exact cross-reference this ADR establishes between portal-identity's
in-memory `OrganizationRecord` and the real, Postgres-persisted Control
Plane `Organization`. A malicious org owner could have re-linked their own
portal organization to point at a _different_ organization's Control
Plane record, and from there to that organization's real Runtimes (see
`GET /admin/control-plane/organizations/:id/runtimes`, §"Part J" logic
above). Fixed by allowlisting `updateOrganization`'s mutable fields
explicitly (`modules/portal-identity/portal-identity-store.ts`) — `id`,
`controlPlaneOrganizationId`, and `createdAt` are now always re-pinned to
their original values regardless of what the request body contains. Full
audit write-up: the "ATLAS 46.26 — RESULTADO" report accompanying the
commit that closed this sprint.
