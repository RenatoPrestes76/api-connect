# Atlas — Master Technical Documentation (Index)

Single entry point into Atlas's documentation set, produced by the ATLAS
Master Documentation, Requirements Engineering, QA & Security Audit
(2026-09-06). This file does not duplicate content — it points to the
document that owns each subject, states what changed in this audit
cycle, and gives a one-paragraph orientation for a reader who has never
seen this repository.

**Scope**: Atlas = `apps/api`, `apps/admin`, `apps/agent`. `apps/cloud`
is a separate product sharing this monorepo — excluded from everything
below except where explicitly noted for architectural clarity.

**Evidence discipline**: every claim in every document listed here was
verified directly against source code, the Prisma schema, migrations,
real test runs, or real tool output (`pnpm audit`, `tsc`, `eslint`,
`vitest`) at the time of writing — never inferred from a prior
document's claim or from a name. Where something could not be verified,
the relevant document says so explicitly rather than guessing.

## Start here

| If you need to...                                                                 | Read                                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Get a new machine running Atlas locally and understand what you're looking at     | [`HANDOVER.md`](HANDOVER.md)                                                                                               |
| Understand the system end-to-end (stack, modules, persistence reality, pipelines) | [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                                                       |
| Know what the system is supposed to do, by requirement                            | [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)                                                             |
| Know which business rules are real vs. inferred vs. conflicting                   | [`requirements/BUSINESS-RULES.md`](requirements/BUSINESS-RULES.md)                                                         |
| Walk through a concrete scenario end-to-end                                       | [`requirements/USE-CASES.md`](requirements/USE-CASES.md), [`requirements/USER-FLOWS.md`](requirements/USER-FLOWS.md)       |
| Trace a requirement to its code/test/database evidence                            | [`requirements/REQUIREMENTS-TRACEABILITY.md`](requirements/REQUIREMENTS-TRACEABILITY.md)                                   |
| See what's missing, inconsistent, or backlog-worthy                               | [`requirements/REQUIREMENTS-GAP-ANALYSIS.md`](requirements/REQUIREMENTS-GAP-ANALYSIS.md)                                   |
| Understand the database schema and what's actually persisted                      | [`database/DATABASE-DOCUMENTATION.md`](database/DATABASE-DOCUMENTATION.md)                                                 |
| Look up any of the 583 API routes                                                 | [`api/API-CATALOG.md`](api/API-CATALOG.md)                                                                                 |
| Understand the security posture, findings, and fixes                              | [`security/SECURITY-AUDIT.md`](security/SECURITY-AUDIT.md)                                                                 |
| See the real before/after test numbers for this audit                             | [`security/SECURITY-REGRESSION-REPORT.md`](security/SECURITY-REGRESSION-REPORT.md)                                         |
| Check test/type-check/lint/build/coverage status                                  | [`qa/QA-TEST-REPORT.md`](qa/QA-TEST-REPORT.md)                                                                             |
| Run or operate Atlas in production                                                | [`OPERATIONS.md`](OPERATIONS.md), [`deployment/production-first-deployment.md`](deployment/production-first-deployment.md) |
| See the full audit's closing report and verdict                                   | [`ATLAS-DOCUMENTATION-FINAL-REPORT.md`](ATLAS-DOCUMENTATION-FINAL-REPORT.md)                                               |

## What Atlas is (one paragraph)

Atlas is a multi-tenant platform that connects a customer's on-premise
ERP database to a hosted Control Plane via an Ed25519-authenticated
Runtime agent, discovers and classifies the ERP's schema into a
canonical business model, and executes governed read/write operations
against it — alongside a large operational surface (fleet management,
security/compliance, billing, connector marketplace, an AI-assisted
workflow builder) built incrementally across many prior sprints, most of
it still in-memory rather than database-backed by deliberate,
documented convention. `ARCHITECTURE.md`'s persistence table is the
single fact most likely to change a new reader's assumptions.

## What changed in this audit cycle

- **Fixed**: a real cross-tenant BOLA (Finding SEC-002 / GAP-01) in
  `organizations.ts`/`agents.ts`/`plugins.ts` — any authenticated user
  could read/modify/delete another tenant's Organization, Agent, or
  installed Plugin records by ID. Fixed with session-derived `orgId`
  checks; proven with 20 new regression tests
  (`__tests__/organizations/organizations-agents-plugins-routes.test.ts`).
- **Fixed**: a dependency audit pass (`pnpm audit --fix`) reduced 56
  advisories to 5, with two unsafe auto-proposed overrides (vitest,
  vite) caught by test-suite regression and reverted before being
  accepted — see SEC-006.
- **Rewritten**: `ARCHITECTURE.md` (previous version described a system
  that no longer exists — Express, no `apps/admin`, a never-formalized
  80% coverage target).
- **Documented, not fixed** (require a product/architecture decision
  outside this audit's authority to make safely): staff-gated
  cross-tenant route scoping (GAP-02), the legacy unauthenticated
  `/admin/*` surface (GAP-03), HA restore's misleading per-tenant
  signature (GAP-09). See `REQUIREMENTS-GAP-ANALYSIS.md` for the full,
  prioritized list.
- **Created from scratch**: the entire `docs/requirements/` tree,
  `docs/database/DATABASE-DOCUMENTATION.md`, `docs/api/API-CATALOG.md`,
  `docs/security/SECURITY-AUDIT.md` and
  `SECURITY-REGRESSION-REPORT.md`, `docs/qa/QA-TEST-REPORT.md`,
  `docs/OPERATIONS.md`, `docs/HANDOVER.md` — none of these existed
  before this audit in a form that reflected the current codebase.

## Document map (full)

```
docs/
├── ARCHITECTURE.md                          system architecture, persistence reality
├── HANDOVER.md                              operational handover for a new maintainer
├── MASTER-TECHNICAL-DOCUMENTATION.md        this file
├── OPERATIONS.md                            what's real for running/observing Atlas
├── ATLAS-DOCUMENTATION-FINAL-REPORT.md      this audit's closing report
├── requirements/
│   ├── REQUIREMENTS.md                      RF-001..026, RNF table
│   ├── BUSINESS-RULES.md                    BR-001..044, classified
│   ├── USE-CASES.md                         UC-01..06
│   ├── USER-FLOWS.md                        step-by-step operational flows
│   ├── REQUIREMENTS-TRACEABILITY.md         RF → BR/UC/API/code/DB/test matrix
│   └── REQUIREMENTS-GAP-ANALYSIS.md         GAP-01..13, prioritized
├── database/
│   └── DATABASE-DOCUMENTATION.md            41 models, migrations, persistence column
├── api/
│   └── API-CATALOG.md                       583 routes, auth architecture
├── security/
│   ├── SECURITY-AUDIT.md                    SEC-001..008
│   └── SECURITY-REGRESSION-REPORT.md        before/after test + audit numbers
├── qa/
│   └── QA-TEST-REPORT.md                    suite/type-check/lint/build/coverage
└── deployment/                              (pre-existing, reconfirmed still accurate)
    ├── production-first-deployment.md
    ├── production-environment-contract.md
    ├── go-live-checklist.json
    └── external-infrastructure-handoff.md
```

## Documents intentionally not duplicated here

`docs/ATLAS-PRODUCTION-RUNBOOK.md`, `docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md`,
`docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`, and other prior
per-sprint documents remain in place and were used as evidence sources
— re-verified against current code where cited, not rewritten, per this
audit's own "update rather than duplicate" instruction.
