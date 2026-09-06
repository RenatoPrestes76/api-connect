# Atlas — Use Cases

Real, code-verified operational flows. Each maps to the RF entries in
`REQUIREMENTS.md` and the tests cited there.

## UC-01 — Client Zero: Runtime enrollment through first data operation

**Ator**: Runtime process (`apps/agent`) on customer infrastructure, on
behalf of a customer organization.

**Pré-condições**: an Organization exists (via portal signup or staff
provisioning); staff has issued an activation key for it.

**Fluxo principal**:

1. Runtime generates an Ed25519 keypair locally, computes a machine
   fingerprint hash.
2. `POST /runtime/register` (Ed25519-signed) with the activation key →
   validated (not expired/used/revoked) → `RuntimeRegistration` row
   created, `status: REGISTERED`.
3. Runtime sends `POST /runtime/heartbeat` (signed) → first heartbeat
   promotes `REGISTERED`/`PENDING` → `ACTIVE`; liveness computed as
   ONLINE from this point.
4. Staff or an automated flow requests ERP schema discovery
   (`POST /erp-metadata/discover`) against a connection profile the
   Runtime is bound to.
5. Runtime polls `GET /erp-metadata/runtime/jobs`, performs the real
   introspection locally, reports back via
   `POST /erp-metadata/runtime/result` (signed).
6. `semantic-mapping` classifies the discovered tables;
   `canonical-model` builds an approved CBM once a human approves the
   suggestions.
7. A query intent is submitted, validated by `query-planner`, compiled
   to dialect SQL by `sql-generator`, dispatched via `query-execution`
   to the Runtime, executed against the real ERP, result paginated back.

**Fluxos alternativos**: activation key expired/used/revoked → `403`;
duplicate fingerprint or public key → `409` (real DB unique constraint,
not application-level check — proven under real concurrency in
`registration-idempotency.test.ts`); heartbeat signature replay → rejected.

**Exceções**: Runtime blocked/revoked mid-session → all outstanding JWT
sessions invalidated immediately, next heartbeat rejected.

**Teste real**: this exact flow (steps 1-3) is the one independently
verified end-to-end against a live local server in a prior sprint
(`production:client-zero` automation, see
`docs/ATLAS-PRODUCTION-RUNBOOK.md`).

## UC-02 — Admin login, session, and first-login password change

**Ator**: Atlas Control Plane staff member.

**Fluxo principal**: `POST /admin/auth/login` → 200 + tokens +
`mustChangePassword: true` (if using the seed password) →
`POST /admin/auth/change-password` (requires current password) →
`mustChangePassword: false` persisted → subsequent logins skip the
forced-change redirect.

**Exceção real, found and fixed in production** (documented in
`docs/ATLAS-PRODUCTION-RUNBOOK.md`, prerequisite context for this audit):
before the fix, a server restart between login and change-password
invalidated the session and reverted the password — "Admin session is no
longer valid" — because `AtlasAdminUser` was pure in-memory. Now
persisted; the identical restart no longer breaks this flow (verified by
a real kill-and-restart test).

## UC-03 — Cross-tenant access attempt (the negative case this audit exists to prove)

**Ator**: an authenticated user belonging to Organization B, attempting
to access Organization A's data.

**Fluxo principal (post-fix)**: `GET /api/v1/organizations/:orgA-id`
with Organization B's session → `404 NOT_FOUND` (not `403`, to avoid
confirming the resource exists) — same for update, delete, workspaces,
members, agent read/heartbeat/retire, plugin install/list/uninstall.

**Fluxo principal (security module, pre-existing, still passing)**: the
same shape for secrets/MFA/SSO/policies/audit/consent/certificates
(110-test suite).

**Teste real**: `organizations-agents-plugins-routes.test.ts` (new, 20
tests, real second Organization row, real second session token) +
`security-routes.test.ts` (110 tests, pre-existing).

## UC-04 — Backup and disaster-recovery drill

**Ator**: staff, or the automated `chaos` scenario runner.

**Fluxo principal**: `POST /api/v1/ha/backup` → real snapshot written to
`.data/backups/<id>.json` with SHA-256 checksum → `POST /recovery-test`
injects a synthetic marker into the live in-memory state → restores from
the snapshot → verifies the marker is gone → reports measured RTO
(real wall-clock) and RPO (hardcoded `0`, since replication is
synchronous in-process, not actually replicated).

**Fluxo alternativo/limitação confirmada**: the restore operation is
**not actually tenant-scoped** despite accepting a `tenantId` parameter —
it replaces the entire in-memory `ControlPlaneStore` state for every
organization's projects/workspaces/environments/runtimes/connectors/
deployments/feature-flags. A recovery test for "tenant-enterprise" is,
for its duration, mutating platform-wide state. Documented in
`docs/security/SECURITY-AUDIT.md`.

## UC-05 — Chaos scenario: leader failover under node loss

**Ator**: staff (or automated), via `POST /admin/chaos/run/node_failure_election`.

**Fluxo principal**: `chaosRunner` calls `leaderElection.simulateNodeFailure`
on the current real leader → forces a real election → asserts a
_different_ node became leader and is online — a genuine state-change
assertion, not a canned "PASS" result. If prerequisite seed data is
missing, the scenario reports `passed: false` with an explicit reason
rather than fabricating success (an explicit design rule enforced in
`chaos-runner.ts`'s own class doc comment).

## UC-06 — Onboarding wizard (confirmed simulation, documented as such)

**Ator**: a new customer or staff member walking through first-run setup.

**Fluxo principal**: `company` → `admin` → `database` → `connector` →
`secrets` → `provision` → `finish`, each a `POST /api/v1/setup/*` call
against a session-scoped `sessionId`.

**Confirmed limitation**: the `provision` step's `ProvisionEngine` never
touches the real `Tenant`/`Workspace`/`Agent`/`ApiKey` Prisma models — it
fabricates plausible IDs and unconditionally marks every task/validation
successful. A caller cannot actually fail this step. This use case
therefore does not result in a real, usable tenant today; it is UI/API
scaffolding for a future real provisioning implementation.
