# Atlas Connect — Production Readiness Inventory

Written by ATLAS 46.38 (Production Infrastructure Handoff & Go-Live Lock),
Phase 1. This is a verifiable inventory of what exists in this repository
today versus what depends on infrastructure outside it. Every "READY" row
below is backed by a file, a test, or a command that can be pointed to —
not an assumption. **Documentation is not infrastructure evidence**: a doc
describing a procedure is READY as documentation, never as proof that the
procedure has been executed against something real.

## Aplicação

| Component                                                    | Status | Evidence                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API (`apps/api`)                                             | READY  | Builds via `pnpm build` to `apps/api/dist/index.js`; boots with real Postgres, verified via Docker (46.31–46.32)                                                                                                                                    |
| Agent Runtime client (`apps/agent/src/atlas-runtime-client`) | READY  | Ed25519 identity (`identity.ts`), signed protocol (`protocol.ts`), real HTTP client (`client.ts`); driven end-to-end by `production:client-zero` (verified 46.37)                                                                                   |
| Control Plane (tenant/org provisioning)                      | READY  | `control-plane-store.ts`; race-safe under concurrency (fixed in commit `f903297`)                                                                                                                                                                   |
| Prisma schema + migrations                                   | READY  | `packages/database/prisma/migrations/`: exactly 2 migrations (`20260824000000_init_baseline`, `20260828004554_add_runtime_registration`), both additive-only (confirmed: zero `DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/`DELETE FROM` in migration SQL) |
| `/health`                                                    | READY  | Uses `pingDB()` (real `SELECT 1` round-trip, not the `$connect()` no-op) — proven against a real outage in `db-real-outage-recovery.test.ts`                                                                                                        |
| `/ready`                                                     | READY  | Same `pingDB()` fix applies to `live-ready.ts`                                                                                                                                                                                                      |

## Segurança

| Component                             | Status        | Evidence                                                                                                                                                                                           |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication (admin/portal/runtime) | READY         | Three separate JWT schemes (`ADMIN_JWT_SECRET`/`PORTAL_JWT_SECRET`/`RUNTIME_JWT_SECRET`), each with its own secret — no shared signing key across identity types                                   |
| Authorization / tenant isolation      | READY         | `http/tenant.ts`'s `requireTenantId`/`requireOrgId`; regression-tested every sprint                                                                                                                |
| Runtime authentication                | READY         | Ed25519 keypair per runtime (`identity.ts`), signed registration/heartbeat payloads (`protocol.ts`'s `signPayload`)                                                                                |
| Secrets management (fail-loud)        | READY         | `services/production-secrets.ts` — 8 required production secrets + CORS allowlist, refuses boot if any missing when `NODE_ENV=production` (verified via real container boot, not just a unit test) |
| ERP credential encryption             | READY         | `ATLAS_MASTER_KEY` — 64 hex chars, consumed by `@seltriva/aegis`                                                                                                                                   |
| CORS                                  | READY         | Allowlist-only (`CORS_ALLOWED_ORIGINS`), wildcard-with-credentials structurally impossible (no `Access-Control-Allow-Credentials` header ever set)                                                 |
| Cookies / tokens                      | READY         | No session cookie usage found; bearer-token JWTs only                                                                                                                                              |
| Security headers                      | READY         | `middleware/security-headers.ts`                                                                                                                                                                   |
| Secret values in Git                  | READY (clean) | Zero tracked `.env` files, zero private keys, zero API-key-shaped strings — reconfirmed via grep every sprint                                                                                      |

## Operação

| Command                       | Status             | Purpose                                                                                                                                         |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm production:preflight`   | READY              | Repository/Environment/Database/Hosting/Domain/HTTPS checks, fail-loud under `--production`                                                     |
| `pnpm production:deploy`      | READY              | Orchestrates precheck→build→migration-status→deploy→health→readiness→smoke (46.38: migration step is now a real read-only check, not a comment) |
| `pnpm production:migrate`     | READY              | `--production --yes` gated, `prisma migrate deploy` only, refuses local `DATABASE_URL`                                                          |
| `pnpm production:verify`      | READY              | Final Go-Live gate table; never collapses `EXTERNAL/DEFERRED` into `PASS`                                                                       |
| `pnpm production:client-zero` | READY              | Verified end-to-end against a real local server (46.37); refuses local target under `--production`                                              |
| `pnpm production:rollback`    | READY              | `--production --yes` gated; honest `EXTERNAL/DEFERRED` with `NullProvider` — never simulates                                                    |
| `pnpm production:domain`      | READY              | Real DNS lookup against the two official hostnames                                                                                              |
| `pnpm production:dry-run`     | READY (new, 46.38) | Validates the whole pipeline's structure and fail-loud protections without touching real infrastructure — always reports `DRY_RUN_ONLY`         |

## Infraestrutura externa

| Item                                            | Status            | Detail                                                                                                                                                                                                 |
| ----------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosting (compute)                               | EXTERNAL_REQUIRED | `render.yaml` is a specification only; no provisioned service detected (`RENDER`/`RENDER_SERVICE_ID` absent)                                                                                           |
| Managed PostgreSQL                              | EXTERNAL_REQUIRED | Local dev Postgres only; no managed instance exists                                                                                                                                                    |
| `DATABASE_URL` (production value)               | EXTERNAL_REQUIRED | Depends on the managed PostgreSQL instance above                                                                                                                                                       |
| Domain (`atlasappruntime.com.br`)               | EXTERNAL_REQUIRED | Confirmed genuinely unregistered via real DNS lookups (`dns/promises.lookup`)                                                                                                                          |
| DNS                                             | EXTERNAL_REQUIRED | No records can exist before the domain is registered                                                                                                                                                   |
| HTTPS / TLS                                     | EXTERNAL_REQUIRED | Depends on hosting + domain being real first                                                                                                                                                           |
| Real secrets (the 8 production-required values) | EXTERNAL_REQUIRED | Must be generated once (e.g. `openssl rand -hex 32`) and loaded into the hosting platform's secret manager — never committed                                                                           |
| Backup                                          | EXTERNAL_REQUIRED | `modules/ha/backup-service.ts` writes local JSON snapshots of Control Plane data to `.data/backups/` for local dev/testing only — not a real database-level backup against a managed Postgres instance |
| Restore                                         | EXTERNAL_REQUIRED | Same — depends on the managed database provider's own restore procedure                                                                                                                                |
| Monitoring                                      | EXTERNAL_REQUIRED | No platform chosen                                                                                                                                                                                     |
| Alerting                                        | EXTERNAL_REQUIRED | No platform chosen                                                                                                                                                                                     |
| Real admin credentials                          | EXTERNAL_REQUIRED | `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` exist as a bootstrap mechanism in code; the actual real-world values must be generated and rotated once production exists                                     |
| `.vercel/project.json` linkage                  | NOT_APPLICABLE    | A real project-ID linkage file exists but proves no active deployment by itself — not treated as evidence of anything beyond "a Vercel project was once linked"                                        |

## Summary

Everything inside this repository's control (Aplicação, Segurança, Operação)
is READY. Every item requiring infrastructure this repository cannot
provision itself is EXTERNAL_REQUIRED. Nothing here is BLOCKED — there is
no known defect preventing production entry once external infrastructure
exists.
