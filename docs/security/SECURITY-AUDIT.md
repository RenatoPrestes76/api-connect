# Atlas — Security Audit

Produced by the ATLAS Master Documentation, Requirements Engineering, QA
& Security Audit. Every finding below is backed by direct code inspection
and, where marked, real test execution against a live server instance —
no finding is asserted from naming or assumption alone. Severity follows
CRITICAL / HIGH / MEDIUM / LOW / INFO per the sprint's own classification.

## Methodology

- Full read-through of `apps/api/src/routes/**` (267 files, 583 total
  route registrations including `server.ts`), every auth middleware
  (`middleware/auth.ts`, `admin-auth.ts`, `portal-auth.ts`,
  `runtime-auth.ts`, `agent-auth.ts`), and `http/tenant.ts`.
- Full read-through of all 37 `apps/api/src/modules/*` business-logic
  directories for persistence model (Prisma vs. in-memory) and existing
  hardening history.
- Direct execution of the existing 110-test BOLA/cross-tenant suite
  (`__tests__/security/security-routes.test.ts`) and the
  control-plane/runtime-registration/portal-identity suites (305
  additional tests) against a real Postgres instance.
- For findings classified as real vulnerabilities: a fix, a new
  regression test proving the fix, and a full suite re-run — never a
  finding "fixed" by assertion alone.

## Summary

| Severity | Found                                                             | Fixed this cycle                                | Documented as residual     |
| -------- | ----------------------------------------------------------------- | ----------------------------------------------- | -------------------------- |
| CRITICAL | 1 (dependency)                                                    | 0 (see below — fixing broke the test toolchain) | 1                          |
| HIGH     | 2 (BOLA on real data)                                             | 2                                               | 0                          |
| MEDIUM   | 1 (BOLA class, in-memory/staff-only data)                         | 0                                               | 1 (~20 routes, documented) |
| LOW      | 1 (durability, not confidentiality)                               | 0                                               | 1                          |
| INFO     | several (naming, non-cryptographic "signatures" used for display) | 0                                               | noted below                |

## Findings

### SEC-001 — Admin identity had no durable persistence (HIGH → FIXED, prior to this audit cycle)

Already fixed in an immediately preceding session (see
`docs/ATLAS-PRODUCTION-RUNBOOK.md`'s admin-login-recovery entry) — the
entire admin RBAC system (`modules/admin-identity`) was pure in-memory,
recreated with a new random UUID and reset password on every process
restart, which had already caused a real production incident (an admin
locked out after a redeploy). Fixed by loading/persisting
`AtlasAdminUser` via Prisma; verified in this audit to remain intact and
correctly excluded from Vitest runs (see Database Documentation's
"in-memory by design" section for why that exclusion is itself correct,
not a regression).

**Residual, confirmed by this audit**: `AtlasAdminSession`,
`AtlasLoginAttempt`, and `AtlasAdminAuditLog` — all three have a real
Prisma model, all three remain pure in-memory. A restart still silently
drops every admin session (forcing re-login, no data loss), the
login-lockout history (cosmetic — a fresh lockout window starts), and —
more materially — **the entire admin action audit trail**. For a module
whose own audit action set is used as the compliance record referenced by
nearly every other module's write handlers, this is a genuine gap.
Classified **LOW** (not MEDIUM/HIGH) because: (a) it's an availability/
durability gap, not a confidentiality or integrity breach — no data is
exposed or corrupted, just not retained across a restart; (b) fixing it
correctly requires the same category of careful, Vitest-parallelism-aware
work as SEC-001's own fix (a shared, well-known email/session table would
become cross-test-file mutable state exactly as `admin-identity-store.ts`
already documents) — not a small patch to make casually within this audit
cycle. Recommended for a dedicated follow-up.

### SEC-002 — Cross-tenant BOLA on real Prisma-backed data (HIGH → FIXED, this audit cycle)

**Routes affected** (all registered directly in `server.ts`, not under
`routes/v1/`):

- `GET/PUT/DELETE /api/v1/organizations/:id`, `GET /api/v1/organizations/:id/workspaces`, `GET /api/v1/organizations/:id/members` (`routes/v1/organizations.ts`)
- `GET/DELETE /api/v1/agents/:id`, `POST /api/v1/agents/:id/heartbeat`, `GET /api/v1/agents/:id/heartbeats`, `POST /api/v1/agents/register` (`routes/v1/agents.ts`)
- `GET/POST/DELETE /api/v1/organizations/:orgId/plugins*` (`routes/v1/plugins.ts`)

**Root cause**: these routes sit behind only the generic Supabase-style
`authMiddleware` (any authenticated user, any organization) with **no
per-route ownership wrapper at all** — a structural gap distinct from
every other module audited, where at minimum a `requirePermission`/
`requireOrgId` call exists even if occasionally misapplied. `agents.ts`
and `plugins.ts` additionally read `organizationId`/`orgId` directly from
the URL param or request body (`ctx.params['orgId'] ?? ctx.orgId` — the
client-supplied value taking _precedence_ over the session-derived one).

**Confirmed real impact** (verified by direct code read of
`services/organization.service.ts` and `routes/v1/plugins.ts` — these are
genuine Prisma queries against the real `Organization`/`Agent`/
`OrganizationPlugin` tables, not in-memory demo data): any authenticated
user, in any organization, could:

- Read any other organization's name/tier/settings/workspace list, and
  **member list including email addresses and display names**.
- Rename or soft-delete any other organization.
- Read/retire any other organization's registered `Agent` (hostname, IP
  address, telemetry).
- Forge a heartbeat for any other organization's agent.
- Register a new agent _under a spoofed organizationId_ belonging to
  another tenant.
- Install or uninstall marketplace plugins into any other organization.

**Fix applied**: every `:id`/`:orgId`-scoped handler now requires the
caller's session-derived `ctx.orgId` to match the requested resource's
owning organization, returning `404 NOT_FOUND` (not `403`) on mismatch —
matching this codebase's own pre-existing convention
(`billing/invoices.ts`'s `inv.tenantId !== tenantId` check) of not
revealing whether a given id exists to a caller who doesn't own it.
`registerAgent` no longer trusts a body-supplied `organizationId` at all —
it always uses the caller's own `ctx.orgId`.

**Explicitly not fixed, documented as residual**: `GET /api/v1/organizations`
(list-all, unscoped, paginated) and `POST /api/v1/organizations` (create).
Neither has a "self" to scope to — list-all is inherently cross-tenant,
create is pre-tenant. The only real consumer found
(`apps/cloud/src/api/index.ts` — a separate product outside this audit's
declared scope) could not be safely restricted without auditing its own
authorization model, which this audit does not have visibility into.
Restricting `list` to admin-only without that visibility risks breaking a
legitimate, already-deployed integration; leaving it open is a real but
lower-severity information-disclosure (org name/slug/tier, no secrets, no
member PII) rather than the read/write/delete-of-PII risk the fixed
routes carried. See `docs/security/REQUIREMENTS-GAP-ANALYSIS.md`.

**Test coverage added**: `apps/api/src/__tests__/organizations/organizations-agents-plugins-routes.test.ts` —
20 new tests, all passing, covering every fixed handler with a genuine
cross-tenant attempt (real second `Organization` row, real second
session) asserting `404`, plus same-tenant-succeeds assertions so the fix
doesn't overcorrect into blocking legitimate self-service access.

### SEC-003 — Body/query-supplied organizationId with no cross-check, in staff-gated or in-memory-only modules (MEDIUM, documented, not fixed)

Roughly 20 "create/build/analyze/trigger" entry points across
`canonical-model`, `sql-generator`, `query-planner`, `semantic-mapping`,
`erp-metadata`, `connector-management`, `runtime-connector-execution`,
`message-delivery`, `job-orchestration`, `ha`, `fleet`, `governance`,
`regions`, and `operations` take an `organizationId`/`tenantId`/
`runtimeId` from the request body or query string with no check that it
belongs to the caller. Full route-level list: `docs/api/API-CATALOG.md`.

**Why MEDIUM, not HIGH, and why not fixed in this cycle**: every one of
these routes is gated by `requirePermission(x)` (a real Atlas Control
Plane staff credential, not a customer session) **or** backed entirely by
confirmed in-memory demo/seed data with no real per-tenant secret at risk
(`governance`, `ha`, `regions`, `operations` are all 100% in-memory,
verified by grep for `prisma.` in each module — zero hits). The realistic
attacker here is already an authenticated staff member with a
`requirePermission`-granted role, not an arbitrary internet user — a much
smaller, already-vetted population, and cross-tenant access by staff
performing legitimate platform operations is, in several of these routes,
the intended shape (e.g. `control-plane`'s admin routes are deliberately
cross-tenant). Distinguishing "staff acting cross-tenant by design" from
"staff exploiting a missing check to touch a tenant outside their
assigned scope" would require a scoping/delegation model this codebase
does not currently have (Atlas admin roles are platform-wide, not
per-tenant-assigned) — introducing one is a real architectural decision
outside this audit's "document and fix what's safe" mandate. Recorded
here, with full evidence, as a genuine target for a dedicated
authorization-model hardening sprint.

### SEC-004 — Top-level `/admin/*` (legacy) has no admin credential at all (MEDIUM, documented)

`routes/v1/admin/agents.ts` and `activation-tokens.ts` (mounted under
`/admin/agents*`, `/admin/companies/:companyId/agents`,
`/admin/activation-tokens*`, `/admin/dashboard/*`) are the one module in
the entire route surface with **neither** the generic-auth bypass nor a
`requirePermission` wrapper — reachable by any authenticated Supabase
user or dev API key, not specifically staff, despite the `/admin/` path
prefix implying otherwise. Confirmed real, Prisma-backed `AtlasAgent`
data. Not fixed in this cycle: unlike SEC-002, there is no obvious
"self-ownership" scoping model for this legacy surface (there's no
customer-facing session concept for `AtlasAgent`/`ActivationToken` at
all — they're inherently staff-only concepts), so the correct fix is
adding `requireAdminAuth`/`requirePermission`, which changes the required
credential type for any existing caller — a behavior change judged too
risky to make blind, with zero test coverage to verify against (confirmed:
zero tests reference these routes). Recommended fix and required manual
verification steps are in `docs/security/REQUIREMENTS-GAP-ANALYSIS.md`.

### SEC-005 — Historical BOLA fixes confirmed still intact (verified, no action needed)

The following ATLAS 46.26-era fixes were re-verified by reading current
source (not trusting the historical fix comment alone) and, where a test
exists, re-running it:

- `portal/connectors.ts`, `portal/dashboard.ts` — confirmed to use
  `requirePortalAuth` + session-derived `ctx.portalOrganizationId`, not
  the client-suppliable `requireTenantId` their own comments describe as
  the historical vulnerability.
- `portal-identity-store.ts`'s `updateOrganization` mass-assignment
  allowlist (blocks `id`/`controlPlaneOrganizationId`/`createdAt` from
  client patches).
- `control-plane-store.ts`'s `updateProject` mass-assignment allowlist.
- `connectors-store.ts`'s `updateConnector`/`updateParameter`
  mass-assignment allowlists.
- `titan-store.ts`'s `patchFlag` provenance-field re-pinning.
- `security-store.ts`'s `updatePolicy` mass-assignment allowlist.
- The full 110-test `security-routes.test.ts` BOLA suite (secrets, MFA,
  SSO, policies, audit, data-requests, consent, certificates) — **all
  passing**, re-run in this audit cycle.
- `portal/support.ts`, `security/mfa.ts`/`sso.ts`/`policies.ts`/
  `certificates.ts`/`risk.ts`/`consent.ts` — every single-resource
  operation confirmed to carry an explicit ownership check
  (`c.tenantId !== tenantId`-shaped guard) before this audit trusted it.

### SEC-006 — Dependency vulnerabilities (see full detail in `docs/security/SECURITY-REGRESSION-REPORT.md`)

`pnpm audit` before this cycle: 4 critical, 34 high, 16 moderate, 2 low
(56 total, 1467 dependencies). Fixed via `pnpm audit --fix` (adds
`pnpm.overrides` forcing patched versions of vulnerable _transitive_
dependencies — no direct dependency's declared major version changed):
43 of 45 proposed overrides applied and verified safe (full build +
92-file/1822-test suite re-run clean). **Two overrides reverted after
real breakage was found by actually running the suite, not assumed
safe**: forcing `vitest` to `>=3.2.6` resolved to `vitest@5.0.0` in
practice (no compatible 3.x/4.x satisfied the constraint), and forcing
`vite` to `>=6.4.3` independently resolved as high as `vite@8.2.2` — both
far outside what `vitest@2.1.9` (this repo's actual declared version,
confirmed via every package's own `package.json`) internally expects.
Together they broke the test runner outright
(`ERR_PACKAGE_PATH_NOT_EXPORTED`, then `__vite_ssr_exportName__ is not
defined` after reverting only the first one — confirmed by direct
execution each time, including after a full `pnpm install --force`
re-link, which ruled out a stale-cache explanation before concluding the
override itself was the cause). Both reverted per this sprint's own
explicit instruction not to force a high-risk major migration without
necessity; verified fixed by re-running the suite after each revert.

**A third instance of the same open-ended-range bug was caught in this
audit's own final pre-commit verification pass** (Section 22/16), after
the two above had already been fixed: four `next` overrides
(`"next@>=13.0.0 <15.5.21": ">=15.5.21"` and three siblings) had no upper
bound, and resolved `next` to `16.3.4` — a major version that removed
support for the `eslint` key in `next.config.ts`, breaking `apps/admin`
and `apps/cloud`'s type-check and build (`error TS2353: ... 'eslint' does
not exist in type 'NextConfig'`). This was not caught by the earlier
`pnpm audit --fix` verification pass because that pass's `pnpm build` run
happened before this exact override combination was locked into the
lockfile; a full `pnpm build` was not re-run again until this audit's
final Section 22 check, which is precisely why that final check exists as
a mandatory step rather than trusting an earlier "clean" result. Fixed the
same way as the vitest/vite cases: bounded each range to
`>=15.5.21 <16.0.0`, re-ran `pnpm install`, confirmed `next` resolves to
`15.5.25` (patched, same major), and re-verified type-check/lint/build all
clean and the full 92-file/1822-test suite still passing.

**Residual, confirmed root cause**: `vitest@2.1.9` pins its own internal
`vite@5.4.21` — the source of all 4 distinct remaining advisories (1
critical "Vitest UI server arbitrary file read" — counted twice by
`pnpm audit` because it matches two separately-resolved `vitest`
instances in the workspace, giving 2 critical in the raw count — 1 high
"`server.fs.deny` bypass on Windows," 2 moderate "Path Traversal in
Optimized Deps" / "NTLMv2 hash disclosure"). All four can only be closed by a genuine
`vitest` major-version upgrade (2.x → a version whose own internal `vite`
dependency is patched), which is exactly the migration just proven to
break this repo's test runner without further, deliberate compatibility
work. **Real-world exploitability in this repo is low**: `vitest` and its
internal `vite` are devDependencies only (never shipped to any production
artifact — confirmed by inspecting `apps/api`'s own Dockerfile, which
never installs or runs vitest), and this repo's CI/local workflows always
run `vitest run` (headless) — the vulnerable Vitest UI server and Vite
dev server are never started in this codebase's actual usage. Documented
as an accepted residual risk requiring a deliberate, tested
major-version migration of vitest across the whole monorepo — real
technical backlog, not something to force blindly inside a documentation/
audit sprint.

### SEC-007 — CI's security gate is non-blocking (INFO/LOW, documented, pre-existing)

`.github/workflows/ci.yml`'s `security` job runs `pnpm audit --audit-level=moderate` with `continue-on-error: true` — confirmed still true today (this exact gap was already flagged in the July 2026
`docs/ARCHITECTURE-AUDIT.md`). A moderate-or-worse dependency finding
never blocks a merge to `master`. Not changed in this cycle (flipping
`continue-on-error` to `false` would immediately turn today's residual
critical Vitest finding, SEC-006, into a red pipeline — a policy decision
for the user to make deliberately, not a side effect of a documentation
audit). Recommended in `docs/security/REQUIREMENTS-GAP-ANALYSIS.md`.

### SEC-008 — Non-cryptographic "signatures" presented as tamper-evidence (INFO)

Two modules compute something styled like a real cryptographic signature
but are not one:

- `modules/governance/governance-store.ts`'s `sign()` — a 32-bit rolling
  hash (`Math.imul` mix) formatted as `sha256:<8-hex>atlas`, used to give
  every audit-log entry the _appearance_ of a tamper-evident hash chain.
- `modules/marketplace/security.ts`'s `verifySignature()` — explicitly
  commented "Demo: deterministic checksum derivation," checks
  `checksum === 'cs-${connectorId}-${version}'`, fully derivable from
  public inputs.

Both are confirmed in-memory-only demo/seed subsystems (no real customer
data or real package distribution flows depend on either), so this is
informational, not a live vulnerability — flagged because both modules'
own framing (governance/compliance, package integrity) could reasonably
lead a future maintainer to trust these as real security controls if not
told otherwise.

## Authentication mechanisms audited (all confirmed real, working as designed)

- **Admin** (`admin-identity`): bcrypt (cost 12) + HS256 JWT, 15-min
  access / 7-day refresh, 5-attempts/15-min lockout. Persisted (fixed,
  SEC-001).
- **Portal** (`portal-identity`): bcrypt (cost 12) + HS256 JWT, single
  24h token (no refresh flow, deliberate — documented distinction from
  admin-identity), 5-attempts/15-min lockout, **not IP-inclusive by
  design** for MFA-adjacent rate limiting (`security/rate-limiter.ts`) to
  close a header-spoofing lockout-reset bypass.
- **Runtime** (`runtime-registration`): Ed25519 request signing +
  replay-rejection (single-last-accepted-signature comparison) for the
  registration/heartbeat/job/message/execution-result write path; a
  secondary, independent JWT session mode (15-min access/30-day refresh)
  for self-service reads.
- **Agent** (legacy, `agent-auth.ts`): opaque `Bearer aat_...` token,
  scoped to exactly 3 paths (`/api/v1/heartbeat`, `/sync-status`, `/me`).

No authentication bypass, forged-token acceptance, or missing-signature
acceptance was found in any of the four real mechanisms above.

## Injection surface reviewed

- **SQL injection**: not applicable to the two Postgres-backed modules —
  both `control-plane` and `runtime-registration` use Prisma's typed
  query API exclusively; zero raw `$queryRawUnsafe`/string-concatenated
  SQL found anywhere in `apps/api/src`.
- **Command injection**: `execFile`/`execFileAsync` (never `exec`/shell
  string interpolation) used throughout `scripts/production/*.mjs` — the
  one place this audit found shell interaction. No occurrence of
  unsanitized user input reaching a shell command in the request-handling
  path.
- **Path traversal**: `modules/ha/backup-service.ts` writes to a fixed,
  server-controlled `.data/backups/<id>.json` path where `<id>` is
  server-generated (`genId()`), never client-supplied — no traversal
  surface.
- **`eval`/dynamic code execution**: one confirmed instance —
  `modules/orchestrator/execution-engine.ts`'s `evalCondition` uses
  `new Function(...)` to evaluate a workflow's condition-expression
  string against its own execution context. The workflow definition
  itself is created via `requirePermission`-gated staff/admin routes, not
  arbitrary end-user input — same staff-trust-boundary reasoning as
  SEC-003, documented as a residual worth revisiting if workflow
  authoring is ever opened to lower-trust users.
- **XSS**: no server-rendered HTML with unescaped user input found in
  `apps/api` (a pure JSON API); out of scope for the frontends
  (`apps/admin`/`apps/web`/etc.), which were not part of this audit's
  declared Atlas backend scope.

## Tenant isolation — explicit test evidence

Real, passing tests exist proving cross-tenant isolation for: secrets
(read/decrypt/rotate/delete), MFA (setup/verify/disable/backup-codes),
SSO providers, policies (including privilege-widening BOLA), audit
entries, DSAR data requests, consent records, certificates (110 tests,
`security-routes.test.ts`); Runtime→Organization→Tenant association
including a client-supplied `tenantId` override attempt (8 tests,
`tenant-association.test.ts`); multi-client liveness/filter isolation
(`registration-idempotency.test.ts` and related); and — new in this
audit — Organization/Agent/Plugin cross-tenant access (20 tests, see
SEC-002). Total real, executed, evidence-backed tenant-isolation
assertions: **138+ tests**, all passing at the time of this report.
