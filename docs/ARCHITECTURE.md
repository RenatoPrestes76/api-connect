# Atlas — Architecture

Rewritten by the ATLAS Master Documentation & Security Audit. The
previous version of this file (preserved in git history) described a
generic "Seltriva Connect" starter architecture (Express backend, a
5-app monorepo, Redis as an active cache layer, an 80% coverage target)
that had already drifted far from the real system by the time of this
audit — it never mentioned `apps/admin`, described a backend framework
this codebase doesn't use, and stated a coverage target that was never
formalized in tooling. Everything below is verified against the current
codebase, not carried over from the previous version.

## What Atlas is

Atlas is a multi-tenant platform-connection product: customers register
an on-premise **Atlas Runtime** (an Ed25519-authenticated agent process)
against Atlas's **Control Plane**, which then discovers the customer's
ERP database schema, maps it to a canonical business model, and executes
governed read/write operations against it on the customer's behalf — all
without Atlas's own backend ever holding a direct network path to the
customer's ERP. The backend also hosts a large operational surface
(security/compliance dashboards, fleet management, billing, an
AI-assisted workflow builder, and more) built up incrementally across
many prior "ATLAS N.NN" sprints, at varying levels of real persistence —
see the "Persistence Reality" table below, which is this document's most
important contribution.

**Scope boundary, stated explicitly per this audit's own instructions**:
Atlas = `apps/api` (backend), `apps/admin` (Control Plane staff UI),
`apps/agent` (the Runtime client). `apps/cloud` is a separate product
(own database `seltriva_cloud`, own Prisma schema subset, own Vercel
deployment) that happens to share this monorepo and the `@seltriva/*`
package namespace — referenced here only where it clarifies a real
architectural fact (e.g. why two overlapping Prisma schemas exist), never
audited as part of Atlas itself. `apps/web`, `apps/studio`,
`apps/developer-portal`, `apps/docs`, `apps/runtime-installer` are
Atlas-adjacent frontends/tools of varying completeness, out of this
audit's route/module-level scope.

## Monorepo structure (verified)

- **Package manager / build**: pnpm workspaces + Turborepo.
  `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `connectors/*`.
- **Apps** (9): `admin`, `agent`, `api`, `cloud`, `developer-portal`,
  `docs`, `runtime-installer`, `studio`, `web`.
- **Packages** (33 under `packages/`, plus `connectors/erp-provider`):
  shared libraries — identity/crypto (`aegis`), governance, HA-adjacent
  primitives (`titan`), billing, connector SDK/registry, database
  adapters, AI/semantic engines, and the plugin-authoring toolchain
  (`plugin-sdk`, `cli`, `generator`, `templates`, `validator`).
- **`apps/api`**: the real backend. A persistent Node process (custom
  HTTP router in `http/router.ts` — **not Express**, despite the
  previous architecture doc's claim), 37 business-logic modules under
  `src/modules/`, 267 route files under `src/routes/v1/` plus a handful
  registered directly in `src/server.ts`. Deployed via
  `docker/Dockerfile.api` — architecturally incompatible with serverless
  (WebSocket hub, leader-election, autoscaler, in-memory state), so it
  runs on a persistent-process host (Docker), never Vercel.

## Technology stack (verified, corrected)

| Layer                      | Technology                                                                       | Evidence                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend HTTP               | Custom router (`apps/api/src/http/router.ts`)                                    | No `express` dependency in `apps/api/package.json`                                                                                                          |
| Backend runtime            | Node.js (persistent process)                                                     | `docker/Dockerfile.api`, `apps/api/src/index.ts`                                                                                                            |
| Database                   | PostgreSQL via Prisma                                                            | `packages/database/prisma/schema.prisma`, 2 real migrations                                                                                                 |
| Cache                      | **Not actually used**                                                            | `REDIS_URL` is provisioned in `docker-compose.yml` for local dev but read by zero application code — confirmed by repo-wide grep, reconfirmed in this audit |
| Auth                       | 5 independent mechanisms (generic Supabase-style, admin, portal, runtime, agent) | See `docs/api/API-CATALOG.md`'s "Global authentication architecture"                                                                                        |
| Frontend (admin/web/cloud) | Next.js 15, React 19                                                             | `pnpm-workspace.yaml`'s catalog                                                                                                                             |
| CI/CD                      | GitHub Actions (`ci.yml`, `format.yml`)                                          | `.github/workflows/`                                                                                                                                        |
| Container runtime          | Docker                                                                           | `docker/Dockerfile.api`, `docker-compose.yml`                                                                                                               |

## Persistence reality — the 37 business-logic modules

The single most important architectural fact this audit surfaced: of the
37 modules under `apps/api/src/modules/`, **only 3 touch Postgres**.
Every other module is a fully-functional, route-wired, in-memory
singleton — not dead code, not a stub, but not durable across a process
restart either. This table is the ground truth; do not infer persistence
from a module's name or from the existence of a same-named Prisma model
(29 of the schema's 41 models have zero runtime consumer — see
`docs/database/DATABASE-DOCUMENTATION.md`).

| Module                 | Persistence                                                                           | Module                        | Persistence                                            |
| ---------------------- | ------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| `control-plane`        | **Postgres** (Tenant, Organization only)                                              | `job-orchestration`           | In-memory                                              |
| `runtime-registration` | **Postgres** (RuntimeRegistration)                                                    | `helios`                      | In-memory                                              |
| `erp-integration`      | **Postgres** (ErpIntegration)                                                         | `marketplace`                 | In-memory                                              |
| `admin-identity`       | **Partial** (AtlasAdminUser + AtlasAdminRole only — fixed in this audit, see SEC-001) | `message-delivery`            | In-memory                                              |
| `security`             | In-memory                                                                             | `observatory`                 | In-memory                                              |
| `ha`                   | In-memory (+ real disk-backed backup files)                                           | `onboarding`                  | In-memory (fully simulated "provisioning")             |
| `governance`           | In-memory                                                                             | `operations`                  | In-memory                                              |
| `erp-connectivity`     | In-memory                                                                             | `orchestrator`                | In-memory                                              |
| `erp-metadata`         | In-memory                                                                             | `portal`                      | In-memory                                              |
| `fleet-ops`            | In-memory                                                                             | `portal-identity`             | In-memory (links to real Postgres via `control-plane`) |
| `gateway`              | In-memory                                                                             | `prometheus`                  | In-memory                                              |
| `ai-copilot`           | In-memory                                                                             | `query-execution`             | In-memory                                              |
| `billing`              | In-memory                                                                             | `query-planner`               | In-memory                                              |
| `canonical-model`      | In-memory                                                                             | `regions`                     | In-memory                                              |
| `chaos`                | In-memory                                                                             | `release`                     | In-memory                                              |
| `connector-management` | In-memory                                                                             | `runtime-connector-execution` | In-memory                                              |
| `connectors`           | In-memory                                                                             | `semantic-mapping`            | In-memory                                              |
| `titan`                | In-memory                                                                             | `sql-generator`               | In-memory                                              |
| `workflow-builder`     | In-memory (templates only — see below)                                                |                               |                                                        |

**Practical consequence**: every in-memory module resets to its seed/demo
data on every `apps/api` restart. This is a deliberate, documented,
repo-wide convention (`docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md`) —
build the module with an in-memory store first, wire real Prisma
persistence in a dedicated migration sprint, per module, as needed — not
an oversight. It is, however, a fact anyone operating Atlas in production
needs to know explicitly, which is exactly why this audit surfaces it
here rather than leaving it implicit.

## Real pipelines confirmed end-to-end

Three genuine, connected multi-module pipelines were traced and verified
(not just individually plausible modules):

1. **ERP schema → SQL execution pipeline**: `erp-metadata` (schema
   discovery) → `semantic-mapping` (business-entity classification) →
   `canonical-model` (approved business model) → `query-planner`
   (validated intent) → `sql-generator` (dialect-specific SQL, 7
   dialects) → `query-execution` (dispatch to Runtime, retry/timeout,
   result pagination). Each stage does distinct, non-overlapping work;
   confirmed via direct import-chain inspection, not inferred from
   naming.
2. **Runtime enrollment → operation pipeline**: `runtime-registration`
   (Ed25519 identity + activation key) → heartbeat/liveness → job
   dispatch (`job-orchestration`, `message-delivery`,
   `runtime-connector-execution`) → result reporting with idempotency and
   replay protection throughout.
3. **Fleet observability pipeline**: `fleet-ops` decorates
   `control-plane`'s `Agent`/`Deployment` records with heartbeats, health
   snapshots, alerts, and deployment-job orchestration — it owns no
   runtime data of its own.

## Naming/ownership overlaps (real, not bugs — documented so they aren't mistaken for one)

- **Three unrelated "agent"/"runtime" concepts** coexist: `AtlasAgent`
  (legacy Runtime Installer flow, `packages/agent-provisioning`), the
  real-Postgres `Agent` model (`control-plane`'s fleet concept, fixed for
  tenant isolation in this audit), and `RuntimeRegistration` (the Ed25519
  canonical Runtime, `runtime-registration`). No code links them.
- **`modules/workflow-builder`** only owns a template catalog and version
  history — the actual AI-plan-generation and simulation logic lives in
  the `@seltriva/workflow-builder` package and `modules/orchestrator`,
  reached directly by `routes/v1/workflow-builder/{plan,simulate}.ts`,
  bypassing `wb-store.ts` entirely.
- **`modules/titan`** backs `/v1/ops/*` routes; there is no
  `/v1/titan/*` route surface — module name and route surface don't
  match.
- **`modules/prometheus`** is an internal code-name for an AI-ops
  dashboard, unrelated to the real Prometheus monitoring product — no
  scrape endpoint, no PromQL; its "copilot" is a keyword-matched
  canned-response router, not an LLM call.
- **Two Prisma schemas exist** — `packages/database/prisma/schema.prisma`
  (41 models, `apps/api`'s source of truth) and
  `apps/cloud/prisma/schema.prisma` (28 models, a manually-maintained
  subset, against `apps/cloud`'s own separate database). Confirmed: every
  model name in the `cloud` schema also exists in the `database` schema;
  no reverse drift found in a name-level comparison. This is
  `apps/cloud`-scoped technical debt, not an Atlas concern, mentioned
  here only for completeness.

## Deployment topology

- `apps/api`: Docker container, `docker/Dockerfile.api`, deployed via
  Render (per `render.yaml`) or any equivalent host that can run an
  arbitrary Docker image and keep a persistent process alive.
- `apps/admin`, `apps/web`, `apps/cloud`, `apps/studio`, `apps/docs`: each
  its own Vercel project (Next.js serverless), proxying to `apps/api` via
  server-side Next.js API routes for anything requiring the backend's
  own session/JWT secrets.
- `apps/agent`: distributed as an installable client (`runtime-installer`
  bootstraps it), runs on customer infrastructure, never inside Atlas's
  own hosting.
- Full production-readiness state (what's real infrastructure vs. still
  external-required) is tracked separately and continuously in
  `docs/deployment/production-first-deployment.md` and
  `docs/deployment/go-live-checklist.json` — not duplicated here.

## Security architecture summary

See `docs/security/SECURITY-AUDIT.md` for the full audit. In summary: 5
independent authentication mechanisms (generic/admin/portal/runtime/
agent), 2 tenant-scoping primitives with an explicit safe/unsafe
distinction documented in the code itself (`requireOrgId` vs.
`requireTenantId`), Ed25519 request signing for the highest-trust Runtime
write path, envelope encryption (AES-256-GCM via `@seltriva/aegis`) for
ERP credentials and connector secrets, and a real, currently-passing
138+-test cross-tenant isolation suite.
