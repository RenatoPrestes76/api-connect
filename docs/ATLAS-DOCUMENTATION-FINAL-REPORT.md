# Atlas — Master Documentation & Security Audit — Final Report

Date: 2026-09-06. Scope: `apps/api`, `apps/admin`, `apps/agent` (Atlas).
`apps/cloud` explicitly excluded as a separate product sharing this
monorepo. Full narrative report delivered to the user in-conversation at
the close of this audit; this file preserves it as a durable artifact.
See `docs/MASTER-TECHNICAL-DOCUMENTATION.md` for the document index.

## 1. System inventory

Atlas = a persistent-process Node backend (`apps/api`, custom HTTP
router, not Express), 37 business-logic modules, 267 route files, 583
total route registrations (559 under `routes/v1/**`, 24 in `server.ts`).
41 Prisma models, 2 additive-only migrations. Two Next.js frontends
(`apps/admin`, staff Control Plane UI) and one Ed25519-authenticated
Runtime client (`apps/agent`). Full detail: `docs/ARCHITECTURE.md`.

## 2. Requirements

26 functional requirements (RF-001..026) across Identity & Access,
Tenancy, ERP Integration, Fleet/Marketplace/Billing, Security &
Compliance, High Availability, and cross-cutting concerns; 12 categories
of non-functional requirements, several explicitly marked
**não formalizado** rather than invented. 44 business rules (BR-001..044)
classified Implementada/Inferida/Conflitante/Ausente, each with a
file:line citation. 6 use cases, full user/operational flows. See
`docs/requirements/`.

## 3. Traceability

Full RF → BR/UC/API/code/database/test matrix in
`docs/requirements/REQUIREMENTS-TRACEABILITY.md`: 15 CONFIRMED, 10
PARTIAL, 1 CONTRADICTORY, 1 PENDING (plus HISTORICAL/UNCONFIRMED
entries). Gaps consolidated in
`docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md` (GAP-01..13).

## 4. Database

41 models across 6 subsystems; only 3 modules (`control-plane`,
`runtime-registration`, `erp-integration`) plus the now-fixed
`admin-identity` touch Postgres via real `prisma.*` calls. 29 of 41
models have zero runtime consumer — documented, not treated as a defect,
since it reflects this repo's established in-memory-first convention.
Full detail: `docs/database/DATABASE-DOCUMENTATION.md`.

## 5. API

583 routes catalogued. 5 independent authentication mechanisms
(generic/admin/portal/runtime/agent) plus a safe/unsafe tenant-scoping
distinction (`requireOrgId` vs. `requireTenantId`) enforced in the code
itself. Full catalog: `docs/api/API-CATALOG.md`.

## 6. Security

8 findings (SEC-001..008). One real, cross-tenant BOLA on genuinely
Prisma-backed data (SEC-002, HIGH) found and **fixed** this cycle. One
medium-severity class of ~20 staff-gated routes with an unresolved
authorization-scoping question, documented not fixed pending a product
decision (SEC-003). One legacy unauthenticated `/admin/*` surface
documented (SEC-004). Historical ATLAS 46.26 fixes reconfirmed intact
(SEC-005). Full detail: `docs/security/SECURITY-AUDIT.md`.

## 7. Security regression tests

138+ real, executed cross-tenant/BOLA assertions, including 20 new tests
proving the SEC-002 fix. Full before/after suite numbers, the Docker-crash
flake investigation, and injection/auth re-verification:
`docs/security/SECURITY-REGRESSION-REPORT.md`.

## 8. QA

**Final, re-verified state**: type-check clean, lint clean, build clean
(after fixing a `next` dependency-override regression caught in this
audit's own final check — see §11), Prisma schema valid, full
`apps/api` suite **92 files / 1,822 tests / 0 failures**. Coverage is
enforced only for a narrow, explicit scope (`vitest.config.ts`) — no
global percentage is claimed. Full detail: `docs/qa/QA-TEST-REPORT.md`.

## 9. Dependency security

`pnpm audit`: 56 advisories (4 critical) before this cycle → **5
advisories (2 critical, both the same Vitest-UI finding against two
resolved instances), 1 high, 2 moderate** after. All residual findings
trace to `vitest@2.1.9`'s own internally-pinned `vite@5.4.21` —
devDependency-only, never shipped, never run in headless CI/local usage.
A coordinated major-version migration is the only real fix and was
deliberately not forced this cycle after two attempts (`vitest`, `vite`
overrides) broke the test runner and were reverted, verified by
re-running the suite each time.

## 10. CI/CD

`.github/workflows/ci.yml` triggers correctly on `master` (a prior,
already-fixed branch-name bug reconfirmed still fixed). `security` job
runs `pnpm audit --audit-level=moderate` with `continue-on-error: true`
— confirmed this never blocks a merge (SEC-007/GAP-06), left unchanged
pending a deliberate user decision, since flipping it would immediately
redden the pipeline on the accepted §9 residual.

## 11. Corrections performed this cycle

1. **SEC-002 BOLA fix** — `organizations.ts`, `agents.ts`, `plugins.ts`,
   with 20 new regression tests.
2. **Dependency audit applied** — 43 safe overrides accepted; 2 unsafe
   ones (vitest, vite) reverted after breaking the test runner.
3. **A third instance of the same unbounded-override bug**, this one in
   `next`, was caught during this audit's own **mandatory final
   re-verification pass** (immediately before commit) — it had silently
   jumped Next.js to a major version that broke `apps/admin`/`apps/cloud`
   builds. Bounded to stay within the patched 15.x line
   (`>=15.5.21 <16.0.0` → resolves to `15.5.25`) and reconfirmed clean.
   This is the clearest concrete justification in this cycle for why the
   final-recheck step is not a formality: an earlier, already-stale
   "Build ✅ Clean" claim would otherwise have shipped a broken build.
4. **Stale `schema.prisma` comment** describing `admin-identity` as
   in-memory, corrected to reflect its actual (partially persisted)
   state.
5. **`docs/ARCHITECTURE.md` rewritten** — the previous version described
   a system that no longer exists (Express, missing `apps/admin`, a
   never-formalized 80% coverage target).

Every fix above added or reused a real regression test and was verified
by an actual re-run, not asserted. No security control was removed to
resolve a finding.

## 12. Documentation created/updated

Created: `docs/HANDOVER.md`, `docs/MASTER-TECHNICAL-DOCUMENTATION.md`,
`docs/OPERATIONS.md`, `docs/ATLAS-DOCUMENTATION-FINAL-REPORT.md` (this
file), the entire `docs/requirements/` tree, `docs/database/`, `docs/api/`,
`docs/security/`, `docs/qa/`. Rewritten in place: `docs/ARCHITECTURE.md`
(old root-level file replaced, no duplicate left under a subdirectory).
Pre-existing documents (`docs/ATLAS-PRODUCTION-RUNBOOK.md`,
`docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md`,
`docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`, `docs/deployment/*`)
were used as verified evidence sources and left untouched, not
duplicated.

## 13. Residual risks

See `docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md` for the full,
severity-ranked list (GAP-01..13). Highest-priority open items, all
requiring a product/architecture decision rather than a blind code
change: authorization-scoping model for ~20 staff-gated cross-tenant
routes and the legacy `/admin/*` surface (GAP-02/GAP-03); HA
restore/recovery-test's misleading per-tenant-looking signature that is
actually platform-global (GAP-09); the vitest/vite dependency residual
requiring a coordinated major-version migration (GAP-05).

## 14. Future roadmap (explicitly not started this cycle)

Persisting the remaining `admin-identity` tables (sessions, login
attempts, audit log) using the same Vitest-parallelism-safe technique
already validated for `AtlasAdminUser` (GAP-04); real per-tenant HA
backup/restore scoping (GAP-09); real onboarding-wizard provisioning
(GAP-10); a decision on `modules/billing/rate-limiter.ts` — wire it in
or remove it (GAP-11). None of these represent a defect requiring
immediate action; all are documented backlog.

## 15. Final verdict

**PASS.** Every executable check — type-check, lint, build, Prisma
validate, and the full 1,822-test suite — is clean as of this audit's
final, mandatory re-verification (not an earlier, potentially-stale run).
The one real security defect found with unambiguous evidence (SEC-002)
was fixed and proven with new tests. Findings requiring a product
decision, rather than a code change, are documented rather than guessed
at or silently left undocumented. No fabricated coverage numbers, no
invented requirements, no functionality added solely to fill out
documentation.

## 16. Next step

**NO NEW SPRINT REQUIRED — DOCUMENTATION PHASE COMPLETE.**

All work has been committed locally (`b2f04cc`) but **not pushed** —
push requires explicit confirmation per this session's own operating
rules for actions visible to others. The residual findings in §13/§14
are real but none rises to a "must fix now" bar: each either requires a
product decision this audit has no authority to make unilaterally, or is
low real-world risk and explicitly deferred with reasoning, not hidden.
A new sprint should be opened only if the user decides, on the merits in
§13/§14, that one of those items has become urgent — not automatically.
