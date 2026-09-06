# Atlas — QA / Software Quality Report

Real, executed results only. No coverage percentage is stated unless it
comes from an actual tool run.

## Test suite (apps/api)

- **92 test files, 1,822 tests, 0 failures** (final baseline, this audit).
- Includes real-Docker integration tests: `graceful-shutdown.test.ts`
  (real `docker stop`, real SIGTERM, confirmed clean exit),
  `production-fail-loud.test.ts` (real container boot refuses to start
  without required secrets; boots correctly with a full secret set),
  `db-real-outage-recovery.test.ts` (real Postgres container stopped
  mid-life, `/health`/`/ready` correctly detect it).
- 20 new tests added this cycle (`organizations-agents-plugins-routes.test.ts`), proving the SEC-002 BOLA fix.

## Type-check, lint, build

| Check         | Command                                    | Result                                                                                                                                                          |
| ------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type-check    | `pnpm type-check` (`turbo run type-check`) | ✅ Clean (final re-run)                                                                                                                                         |
| Lint          | `pnpm lint` (`eslint . --max-warnings 0`)  | ✅ Clean (after auto-fixing 20 prettier formatting issues introduced by this audit's own fixes)                                                                 |
| Build         | `pnpm build`                               | ✅ Clean (final re-run — an intermediate `pnpm build` had failed due to an unbounded `next` dependency override; see `docs/security/SECURITY-AUDIT.md` SEC-006) |
| Prisma schema | `prisma validate`                          | ✅ Valid                                                                                                                                                        |

All four checks above were re-run together, from a clean state, as this
audit's mandatory final pre-commit verification (Section 22) — not
carried over from an earlier, potentially-stale run. This caught a real
build break (the `next` override) that an earlier build pass had missed.

## Coverage

`apps/api/vitest.config.ts` defines **real, enforced** coverage
thresholds — but scoped narrowly, not repo-wide:

```
include: ['src/routes/v1/atlas/**/*.ts', 'src/routes/v1/admin/**/*.ts', 'src/middleware/agent-auth.ts']
thresholds: { statements: 90, lines: 90, functions: 88, branches: 85 }
```

**No global coverage percentage is claimed or enforced for the rest of
the 267-route, 37-module codebase.** The previous version of
`docs/ARCHITECTURE.md` stated "minimum 80% coverage target" — this audit
found no tooling enforcing that number anywhere and has removed the claim
from the rewritten architecture doc. Stating a fabricated global coverage
number would violate this audit's own "não inventar cobertura" rule.

## Areas with zero test coverage (confirmed by direct search, not estimated)

Every one of the following modules has real, route-wired logic and zero
dedicated test file: `erp-connectivity`, `erp-metadata`,
`semantic-mapping`, `canonical-model`, `query-planner`/`sql-generator`/
`query-execution` (the full ERP pipeline), `connector-management`,
`connectors`, `fleet-ops`, `billing`, `helios`, `marketplace`,
`message-delivery`, `observatory`, `operations`, `orchestrator`,
`portal`, `prometheus`, `regions`, `release`, `runtime-connector-execution`,
`titan`, `workflow-builder`, `governance`, `onboarding`,
`routes/v1/admin/{agents,activation-tokens}.ts` (the legacy, unauthenticated
`/admin/*` surface — Finding SEC-004). This does not mean these modules
are broken — several were manually/logically verified during this audit's
module inventory pass — but there is no automated regression net for any
of them today.

**Well-tested areas**, for contrast: `admin-identity` (31 tests),
`security` (110+ tests across secrets/MFA/SSO/policies/audit/consent),
`runtime-registration` (14 files), `control-plane` (multiple files
covering tenancy/persistence/CRUD), `portal-identity`, and — new —
`organizations`/`agents`/`plugins` (20 tests).

## Fragile / mock-reliant tests

None found using mocks to mask a real infrastructure dependency — this
codebase's own established convention (confirmed across every test file
read in this audit) is to skip cleanly (not fake-pass) when a real
dependency like Docker is unavailable, rather than mocking around it. No
change needed here.

## Dependency security

See `docs/security/SECURITY-REGRESSION-REPORT.md` for full `pnpm audit`
before/after detail: 56→5 advisories, 4→2 critical (residual is a
dev-tooling-only, low-real-world-risk finding requiring a deliberate
major-version migration, not executed this cycle).

## CI/CD verification

- `.github/workflows/ci.yml` triggers correctly on `master` (a real
  branch-name bug — `[main, develop]` — found in a prior, July 2026 audit
  was already fixed in an earlier ATLAS sprint; reconfirmed still correct
  today).
- 3 jobs: `build` (lint/type-check/build/format), `test` (full suite
  against real Postgres/Redis services + a real Docker image build),
  `security` (`pnpm audit --audit-level=moderate`, `continue-on-error: true`
  — confirmed this never blocks a merge; documented as Finding SEC-007,
  not changed this cycle since flipping it would immediately redden the
  pipeline on the accepted GAP-05 residual).

## Verdict

**PASS.** All executable checks (suite, type-check, lint, build, Prisma
validate) are clean at the time of this report. Coverage gaps and the one
dependency residual are documented, not hidden.
