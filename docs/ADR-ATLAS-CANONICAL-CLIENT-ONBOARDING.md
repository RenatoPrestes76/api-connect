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
