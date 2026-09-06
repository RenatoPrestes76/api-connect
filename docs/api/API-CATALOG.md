# Atlas — API Catalog

Produced by the ATLAS Master Documentation & Security Audit. Counts and
auth classifications below come from a full read-through of every file
under `apps/api/src/routes/**/*.ts` (267 files) plus the routes registered
directly in `apps/api/src/server.ts`, cross-referenced against
`apps/api/src/http/router.ts`, `apps/api/src/http/tenant.ts`, and all five
auth middlewares (`middleware/auth.ts`, `admin-auth.ts`, `portal-auth.ts`,
`runtime-auth.ts`, `agent-auth.ts`).

## Total route count

**583 distinct HTTP route registrations**:

- 559 registered across `apps/api/src/routes/**` (a raw grep for
  `router\.(get|post|put|patch|delete)\(` finds 552 source lines; the
  discrepancy is `routes/v1/fleet/runtime-ops.ts`'s single `router.post()`
  call inside a `for (const action of REMOTE_ACTIONS)` loop, which
  registers 8 distinct paths — restart/update/reinstall/sync-now/
  clear-cache/force-heartbeat/disable/enable — from one source line).
- 24 registered directly in `server.ts` (health/live/ready ×6,
  `/api/v1/organizations*` ×10, `/api/v1/agents*` ×6,
  `/api/v1/plugins*` ×2) — outside the `routes/` tree entirely.

## Global authentication architecture

Every request passes through `router.use(authMiddleware)` first
(`server.ts:176`) — the generic Supabase-style layer
(`middleware/auth.ts`) that requires a valid `Authorization: Bearer`
Supabase JWT or `X-Api-Key`, and sets `ctx.userId`/`ctx.orgId` from the
verified token's `app_metadata.organization_id`. It is bypassed only for
paths listed in `PUBLIC_PATHS` (exact match) or `PUBLIC_PATH_PREFIXES`
(prefix match) inside `auth.ts`.

Four additional, **opt-in** auth layers exist, each independent (own JWT
secret, own claims, own middleware file):

| Layer   | File                                                                           | Sets                                                    | Used by                                                                            |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Admin   | `middleware/admin-auth.ts` — `requireAdminAuth`/`requirePermission(x)`         | `ctx.adminUserId/adminEmail/adminRole/adminPermissions` | Control Plane staff routes (`/admin/*`)                                            |
| Portal  | `middleware/portal-auth.ts` — `requirePortalAuth`/`requirePortalPermission(x)` | `ctx.portalOrganizationId` etc.                         | Customer self-service routes (`/api/v1/portal/*`)                                  |
| Runtime | `middleware/runtime-auth.ts` — `requireRuntimeAuth`                            | `ctx.runtimeId/runtimeOrganizationId`                   | Runtime self-service JWT session routes                                            |
| Agent   | `middleware/agent-auth.ts` — global, but scoped to `AGENT_PROTECTED_PATHS`     | —                                                       | `/api/v1/heartbeat`, `/api/v1/sync-status`, `/api/v1/me` (legacy Atlas Agent flow) |

A fifth pattern — **inline Ed25519 signature verification** — gates
Runtime→backend write paths that don't go through a session at all
(registration, heartbeat, job/message/execution result reporting): the
request body is verified against the Runtime's registered public key
per-request, no bearer token involved. This is the mechanism backing
`runtime-registration`, `job-orchestration`, `message-delivery`,
`erp-connectivity`'s runtime-report endpoints, and
`runtime-connector-execution`.

Two tenant-scoping primitives exist in `http/tenant.ts`, with an explicit,
load-bearing distinction:

- **`requireTenantId(ctx, bodyTenantId?)`** reads a **client-supplied**
  `x-tenant-id` header/query/body value — its own doc comment states this
  is unsafe for authorization ("a real BOLA was found and fixed where
  routes used this value directly"). Confirmed still in use in exactly 3
  files today, all reviewed in this audit and confirmed safe: `ops/queues.ts`
  (documented attribution-only, never an authz check),
  `portal/connectors.ts` and `portal/dashboard.ts` (both historical
  references in comments only — the actual code was fixed in ATLAS 46.26
  to use session-derived `ctx.portalOrganizationId` instead; verified by
  reading the current source, not the comment).
- **`requireOrgId(ctx)`** reads `ctx.orgId`, session-derived from the
  verified JWT — safe for authorization. Used throughout `billing`,
  `security`, and (now, after this audit's fixes) `organizations.ts`/
  `agents.ts`/`plugins.ts`.

## Route count and auth model by top-level module

| Module (routes/v1/)                                                                                                                                                                                         | Approx. routes | Dominant auth model                                                                                                                                                                                                                                                                            | Notes                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `security`                                                                                                                                                                                                  | 41             | `requireOrgId` (session-scoped) throughout, except 2 platform-wide routes                                                                                                                                                                                                                      | Best-scoped module in the API — every single-resource operation has an explicit ownership check                                     |
| `control-plane`                                                                                                                                                                                             | 35             | `requirePermission('companies.*'/'projects.*'/etc.)`                                                                                                                                                                                                                                           | Staff-only by design (cross-tenant is the intended shape)                                                                           |
| `fleet`                                                                                                                                                                                                     | ~34            | `requirePermission('runtime.*'/'dashboard.view'/etc.)`                                                                                                                                                                                                                                         | Staff-only; individual runtime/deployment/policy `:id`s are not cross-checked against caller (acceptable — caller is already staff) |
| `helios`                                                                                                                                                                                                    | 30             | Generic-only, no wrapper                                                                                                                                                                                                                                                                       | Event-mesh dashboard; tenant scoping present via `util.ts`'s `tenantOf`/`assertTenantAccess` on most (not all) sub-routes           |
| `portal` (incl. `gateway/`)                                                                                                                                                                                 | ~38            | `requirePortalAuth`/`requirePortalPermission(x)`                                                                                                                                                                                                                                               | Consistently session-scoped; ownership checks present on every ticket/connector/API-key/rate-limit lookup                           |
| `observatory`                                                                                                                                                                                               | 24             | Generic-only, no wrapper                                                                                                                                                                                                                                                                       | Backed entirely by in-memory demo data (no real per-tenant customer data at risk)                                                   |
| `hub`                                                                                                                                                                                                       | 24             | Generic-only, no wrapper                                                                                                                                                                                                                                                                       | Same — in-memory demo data                                                                                                          |
| `ops`                                                                                                                                                                                                       | 20             | `requirePermission('ops.read'/'ops.manage')`                                                                                                                                                                                                                                                   | Staff-only                                                                                                                          |
| `admin-identity`                                                                                                                                                                                            | 6              | Mixed — login/logout/refresh are intentionally public (credential-gated), `/me`+`/change-password` are `requireAdminAuth`, `/audit-log` is `requirePermission('audit.read')`                                                                                                                   |                                                                                                                                     |
| `runtime-registration`                                                                                                                                                                                      | 17             | Mixed — public registration/heartbeat (Ed25519-signed), `requireRuntimeAuth` for self-service, `requirePermission('runtime-registration.*')` for staff admin                                                                                                                                   |                                                                                                                                     |
| `billing`                                                                                                                                                                                                   | 19             | `requireOrgId` for self-service, `requirePermission('billing.manage')` for admin/webhook                                                                                                                                                                                                       | One residual gap: `POST /license/validate` takes `tenantId` from body unchecked (documented below)                                  |
| `canonical-model`, `sql-generator`, `query-planner`, `semantic-mapping`, `erp-metadata`, `erp-connectivity`, `connector-management`, `runtime-connector-execution`, `message-delivery`, `job-orchestration` | ~55 combined   | `requirePermission(x)` for the "create/build/analyze" entry point, but `organizationId`/`profileId`/`runtimeId` taken from body with **no cross-check** against caller identity on most of these; **the sibling `get`/`history` endpoints in the same files, by contrast, do check ownership** | Real, consistent pattern flagged in `docs/security/SECURITY-AUDIT.md` Finding SEC-003                                               |
| `query-execution`                                                                                                                                                                                           | 6              | `requirePermission` + real ownership checks (`organizationId`/`:id` cross-checked)                                                                                                                                                                                                             | The most consistently guarded of the pipeline modules                                                                               |
| `governance`, `ha`, `regions`, `operations`, `prometheus`, `release`, `orchestrator`, `marketplace`, `discovery`, `copilot`, `setup`                                                                        | ~85 combined   | Generic-only, no wrapper anywhere in these modules                                                                                                                                                                                                                                             | 100% in-memory demo/seed data confirmed for all — no real customer data at risk, but also no defense-in-depth if that ever changes  |
| `admin` (top-level, distinct from `admin-identity`)                                                                                                                                                         | 11             | **None** — no bypass, no wrapper; reachable by any authenticated Supabase user, not specifically staff                                                                                                                                                                                         | Real `AtlasAgent`/company data; flagged in Finding SEC-003                                                                          |
| server.ts-registered (`organizations`, `agents`, `plugins`)                                                                                                                                                 | 24             | **Fixed in this audit** — was none, now `ctx.orgId`-scoped self-ownership                                                                                                                                                                                                                      | Finding SEC-002, real Prisma-backed data, closed with tests                                                                         |

## Endpoints with zero authentication (informational, by design)

Confirmed benign — health/spec/first-credential endpoints:
`GET /health`, `/api/v1/health`, `/live`, `/api/v1/live`, `/ready`,
`/api/v1/ready`, `/api/v1/atlas/openapi`, `POST /admin/auth/login`,
`POST /api/v1/portal/auth/register`, `POST /api/v1/portal/auth/login`.

Public but gated by an inline Ed25519 signature or a one-time possession
token (activation key, refresh token, invite token) rather than one of the
four named wrapper functions — by design, not a gap:
`/api/v1/activate`, `/api/v1/provision`, `/runtime/register`,
`/runtime/heartbeat`, `/runtime/auth/token`, `/runtime/auth/refresh`,
`/runtime/auth/revoke`, `/runtime/jobs`, `/jobs/result`, `/messages/ack`,
`/erp-connectivity/health-report`, `/erp-connectivity/diagnostics-report`,
`/admin/auth/logout`, `/admin/auth/refresh`,
`/api/v1/portal/invites/:token`, `/api/v1/portal/invites/:token/accept`.

## Cross-tenant BOLA findings (see `docs/security/SECURITY-AUDIT.md` for full detail)

Three real, confirmed classes of finding, two fixed in this audit cycle:

1. **Fixed (Finding SEC-002)**: `routes/v1/organizations.ts` (get/update/
   delete/workspaces/members) and `routes/v1/plugins.ts`
   (list/install/uninstall) trusted a client-supplied `:id`/`:orgId`
   against real Prisma-backed `Organization`/`Agent`/`OrganizationPlugin`
   data with no ownership check. `routes/v1/agents.ts` had the identical
   pattern plus an `organizationId`-spoofing gap on registration. All
   fixed to require the caller's session-derived `ctx.orgId` to match; 20
   new regression tests added
   (`__tests__/organizations/organizations-agents-plugins-routes.test.ts`).
2. **Documented, not fixed (Finding SEC-003)**: ~20 "create/build/analyze"
   entry points across the ERP/query pipeline modules (canonical-model,
   sql-generator, query-planner, semantic-mapping, erp-metadata,
   connector-management, runtime-connector-execution, message-delivery,
   job-orchestration, ha, fleet, governance, regions, operations) take an
   `organizationId`/`tenantId`/`runtimeId` from the request body/query with
   no cross-check against the caller's session. Left undecided in this
   audit specifically because most of these modules are staff-only
   (`requirePermission`-gated) or backed by non-sensitive in-memory demo
   data — see the full per-route list and severity reasoning in
   `docs/security/SECURITY-AUDIT.md`.
3. **Documented, not fixed (residual)**: `GET /api/v1/organizations` (list)
   and `POST /api/v1/organizations` (create) remain unscoped by design —
   the only real consumer found (`apps/cloud`, a separate product outside
   this audit's scope) could not be safely re-scoped without auditing its
   own authorization model, which is out of scope here. See
   `docs/security/REQUIREMENTS-GAP-ANALYSIS.md`.

## Naming/ownership overlaps found (not bugs, but real sources of confusion)

- **"Runtime" means three different things** in this codebase: the legacy
  `AtlasAgent` (Runtime Installer flow), the real-Postgres `Agent` model
  (control-plane's fleet concept), and `RuntimeRegistration` (the Ed25519
  canonical Runtime). No code links them.
- **`/api/v1/workflow-builder/*` and `/api/v1/orchestrator/workflows/*`
  routes both exist**, but `modules/workflow-builder/wb-store.ts` only
  owns templates/version-history — the actual AI-plan/simulate logic lives
  in the `@seltriva/workflow-builder` package and `modules/orchestrator`.
- **"titan" (module) has no `/v1/titan/*` routes** — it backs `/v1/ops/*`
  entirely; the module and route-surface names don't match.
- **"prometheus" (module) is unrelated to the real Prometheus product** —
  an internal code-name for an AI-ops dashboard with a keyword-matched
  canned-response "copilot," not an LLM integration or metrics scraper.

## Cross-reference

- Per-module business logic, persistence, and business rules:
  `docs/ARCHITECTURE.md`
- Full security methodology and findings: `docs/security/SECURITY-AUDIT.md`
- Database model ownership: `docs/database/DATABASE-DOCUMENTATION.md`
