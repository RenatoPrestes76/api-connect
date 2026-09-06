# Atlas — Security Regression Report

Real, executed results from the ATLAS Master Documentation & Security
Audit. Every number below comes from an actual test run (or `pnpm audit`
invocation) against a real Postgres instance — none is estimated.

## Cross-tenant / BOLA regression suites

| Suite                                                                                           | Tests                    | Result                                               | Scope                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `__tests__/security/security-routes.test.ts`                                                    | 110                      | ✅ all passing                                       | secrets, MFA, SSO, policies, audit, data-requests, consent, certificates — cross-tenant BOLA |
| `__tests__/organizations/organizations-agents-plugins-routes.test.ts`                           | 20 (**new, this audit**) | ✅ all passing                                       | Organization/Agent/OrganizationPlugin cross-tenant BOLA (Finding SEC-002)                    |
| `__tests__/runtime-registration/tenant-association.test.ts`                                     | 8                        | ✅ all passing                                       | Runtime→Organization→Tenant scoping, including a client-supplied `tenantId` override attempt |
| `__tests__/runtime-registration/runtime-isolation.test.ts` + `runtime-operational-view.test.ts` | ~9 combined              | ✅ all passing (in isolation — see Flake Note below) | multi-client liveness/filter isolation                                                       |
| **Total real, executed tenant-isolation assertions**                                            | **138+**                 | ✅                                                   |                                                                                              |

## Full suite before vs. after this audit's changes

| Metric     | Before this cycle | After this cycle |
| ---------- | ----------------- | ---------------- |
| Test files | 91                | 92 (+1)          |
| Tests      | 1,802             | 1,822 (+20)      |
| Failures   | 0                 | 0                |
| Type-check | clean             | clean            |
| Lint       | clean             | clean            |
| Build      | clean             | clean            |

Full suite executed 4 times across this audit (baseline, post-fix,
post-dependency-change, final) — all clean except one intermediate
Docker-restart-induced transient (see below) and the two dependency
regressions caught and reverted before being accepted (see
`docs/security/SECURITY-AUDIT.md` SEC-006).

## Flake note (investigated, confirmed not a regression)

Mid-audit, Docker Desktop itself crashed (unrelated to this session's
changes — confirmed via `docker ps` returning a named-pipe connection
error) after several hours of heavy parallel tool use. This caused
transient `Can't reach database server` and 5-second test timeouts in
`runtime-registration/tenant-association.test.ts`,
`runtime-isolation.test.ts`, and `runtime-operational-view.test.ts`.
Diagnosed by: (1) confirming Docker/Postgres were genuinely down, (2)
restarting Docker Desktop + the `seltriva_postgres`/`seltriva_redis`
containers, (3) re-running the exact same failed files in isolation —
all passed cleanly. Not a code regression.

## Dependency audit (`pnpm audit`)

| Stage                                                                                                                              | Critical | High  | Moderate | Low   | Total advisories | Dependencies |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | -------- | ----- | ---------------- | ------------ |
| Before                                                                                                                             | 4        | 34    | 16       | 2     | 56               | 1,467        |
| After `pnpm audit --fix` (45 overrides)                                                                                            | 2        | 3     | 3        | 0     | 8                | 1,467        |
| After reverting 2 unsafe overrides (vitest, vite — both broke the test runner when applied)                                        | 2        | 1     | 2        | 0     | 5                | 1,467        |
| **Final** (after bounding a 3rd unsafe override — `next`, found in this audit's own Section 22 final verification pass, see below) | **2**    | **1** | **2**    | **0** | **5**            | 1,453        |

**Net real fix**: 4→2 critical (both remaining are the same "Vitest UI
arbitrary file read" advisory reported against two separate resolved
instances of vitest in the workspace — 4 distinct advisories total, not
5), 34→1 high, 16→2 moderate, 2→0 low. All remaining advisories trace to
one root cause — `vitest@2.1.9` (this repo's actual declared, working
version) pins an internal `vite@5.4.21` with its own unpatched CVEs —
fixable only by a vitest major-version upgrade, explicitly not executed
per the sprint's own "não executar migração major sem necessidade" rule
after that exact upgrade was tried and confirmed to break the test runner
(`ERR_PACKAGE_PATH_NOT_EXPORTED`, then
`__vite_ssr_exportName__ is not defined` on the next attempt). Both
overrides were reverted, and the revert itself was verified by re-running
the test suite before being accepted.

**A third instance of the identical bug class was caught during this
audit's own mandatory final re-verification** (never assume an earlier
"clean" build result still holds after further `package.json`/lockfile
edits): four open-ended `next` overrides had silently resolved `next` to
`16.3.4`, breaking `apps/admin`/`apps/cloud` type-check and build (Next 16
removed the `eslint` key from `next.config.ts`). Fixed by bounding all
four ranges to `>=15.5.21 <16.0.0` (landing on patched `15.5.25`, same
major), then re-running `pnpm install` and the entire type-check/lint/
build/test/prisma-validate/audit sequence clean. This is exactly why
Section 22's "run everything again immediately before commit" step is
mandatory rather than a formality — it caught a real, otherwise-undetected
build break that an earlier, already-stale "Build ✅ Clean" result had
missed.

**Why this residual is low real-world risk**: `vitest`/`vite` are
devDependencies only. `apps/api`'s own Dockerfile never installs or runs
either. This repo's CI and local workflows always invoke `vitest run`
(headless) — the vulnerable Vitest UI server and Vite dev server are
never started in this codebase's actual usage.

## Injection & auth surface re-verification

- Zero raw/string-concatenated SQL found in either Postgres-backed module (`control-plane`, `runtime-registration`) — Prisma's typed API used exclusively.
- Zero `exec()`/shell-string-interpolation found — all shell interaction (`scripts/production/*.mjs`) uses `execFile`/`execFileAsync`.
- One confirmed `new Function()` dynamic-code-execution site (`orchestrator/execution-engine.ts`'s `evalCondition`), gated behind staff-authored workflow definitions only — documented in `docs/security/SECURITY-AUDIT.md`, not an open injection surface today.
- All 5 authentication mechanisms (generic/admin/portal/runtime/agent) re-verified against their own test suites; no bypass found.

## Verdict

**PASS** for everything executed and fixable within this cycle's scope.
One accepted residual (dependency, low real-world exploitability,
requires a deliberate major-version migration project) documented, not
hidden, per the sprint's explicit "não esconder riscos" instruction.
