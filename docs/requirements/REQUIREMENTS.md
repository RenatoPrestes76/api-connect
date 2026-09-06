# Atlas — Requirements

Produced by the ATLAS Master Documentation & Security Audit. Every
requirement below is extracted from real code, tests, or the database
schema — none is aspirational. Each RF cites the file(s) implementing it
and, where one exists, the test proving it. RNFs that have no formal SLA
in this codebase are marked **"Não formalizado"** rather than a
fabricated number, per the sprint's explicit instruction.

## RF — Requisitos Funcionais

### Identity & Access

**RF-001 — Admin (Control Plane staff) authentication**

- Ator: Atlas Control Plane staff member.
- Pré-condição: a seeded or previously-created `AtlasAdminUser` exists.
- Comportamento: `POST /admin/auth/login` verifies email + bcrypt password hash, issues a 15-min access JWT + 7-day refresh JWT, enforces a 5-attempts/15-min lockout.
- Pós-condição: session established; `mustChangePassword` flagged on first login with the seed password.
- Componentes: `modules/admin-identity/*`. API: `routes/v1/admin-identity/index.ts`. Banco: `AtlasAdminUser` (persisted, fixed in this audit). Teste: `__tests__/admin-identity/admin-auth.test.ts` (31 tests, passing).

**RF-002 — Admin RBAC (7 roles, ~90 permissions)**

- SUPER_ADMIN, ATLAS_ADMIN, SUPORTE, CUSTOMER_SUCCESS, COMERCIAL, DEVOPS, AUDITOR — each with a fixed permission grant list.
- Componentes: `modules/admin-identity/permissions.ts`. Evidência: `PERMISSION_CATALOG` (all `resource.action` pairs), `ROLE_PERMISSIONS`.

**RF-003 — Customer self-service (portal) authentication**

- Ator: a customer organization's own user.
- Comportamento: `POST /api/v1/portal/auth/register` creates an org + owner in one call; `POST /api/v1/portal/auth/login` issues a single 24h session JWT (no refresh flow, deliberate design choice).
- Componentes: `modules/portal-identity/*`. Teste: portal-identity test suite (passing).

**RF-004 — Runtime enrollment (Ed25519)**

- Ator: an `apps/agent` Runtime process running on customer infrastructure.
- Pré-condição: a valid, unexpired, unused activation key issued by staff.
- Comportamento: `POST /runtime/register` verifies an Ed25519-signed payload, creates a `RuntimeRegistration` row keyed by machine fingerprint + public key (both unique).
- Componentes: `modules/runtime-registration/*`. Banco: `RuntimeRegistration` (Postgres). Teste: `registration-idempotency.test.ts` (fingerprint/public-key uniqueness, including a real concurrent-race test relying on the DB unique constraint, not application logic).

**RF-005 — Runtime heartbeat & liveness classification**

- Comportamento: `POST /runtime/heartbeat` (Ed25519-signed, replay-rejected via last-accepted-signature comparison) updates `lastHeartbeat`; liveness is computed fresh on every read (`classifyLiveness`) as ONLINE (≤60s) / STALE (≤5min) / OFFLINE, never stored as a column.
- Componentes: `modules/runtime-registration/liveness.ts`. Teste: `runtime-isolation.test.ts`, `runtime-operational-view.test.ts`.

### Tenancy & Organization

**RF-006 — Tenant/Organization hierarchy**

- A `Tenant` may hold multiple `Organization`s (e.g. separate legal entities under one contract); an `Organization` may exist with `tenantId = null` (`PENDING_TENANT_ASSIGNMENT`, an honest, valid state, not an error).
- Componentes: `modules/control-plane/tenancy.repository.ts`. Banco: `Tenant`, `Organization` (real FK, `onDelete: SetNull`). Teste: `tenant-association.test.ts` (8 tests).

**RF-007 — Organization self-service CRUD**

- `GET/PUT/DELETE /api/v1/organizations/:id` + workspaces/members sub-resources.
- **Fixed in this audit** (Finding SEC-002): now enforces `ctx.orgId === :id` (a caller may only act on its own organization). Teste: `organizations-agents-plugins-routes.test.ts` (new, 20 tests).

**RF-008 — Agent (fleet) registration & lifecycle**

- `POST /api/v1/agents/register`, heartbeat, retire.
- **Fixed in this audit**: `organizationId` can no longer be spoofed via request body; always the caller's own `ctx.orgId`. Teste: same file as RF-007.

### ERP Integration

**RF-009 — ERP integration mode toggle (OFF/ON)**

- Ator: Control Plane staff, per organization.
- Comportamento: sets `ErpIntegration.integrationType`; `permite_escrita` (write permission) is hardcoded `false` unconditionally — no ERP write path exists in this mode toggle regardless of configuration.
- Componentes: `modules/erp-integration/*`. Banco: `ErpIntegration` (Postgres).

**RF-010 — ERP connection profile management**

- Ator: staff (`requirePermission`) or the Runtime itself (self-service, session-scoped).
- Comportamento: stores host/port/credentials (AES-256-GCM encrypted) per profile; Runtime reports health/diagnostics back via Ed25519-signed, replay-protected requests.
- Componentes: `modules/erp-connectivity/*`. Persistência: in-memory (no Prisma model exists for this domain).

**RF-011 — ERP schema discovery**

- Comportamento: staff requests discovery against a profile; Runtime performs the real introspection and reports the raw schema; `erp-metadata` computes a checksum, skips reclassification if unchanged, else runs ATHENA's `DatabaseScanner`.
- Componentes: `modules/erp-metadata/*`. Persistência: in-memory.

**RF-012 — Semantic mapping (business-entity classification)**

- Comportamento: `refineClassification` applies a pattern-dictionary rule engine (line-item detection, brand/unit/warehouse/payment/employee/variant heuristics) to ATHENA's structural output, producing confidence-scored suggestions with conflict detection; staff approve/override/reject.
- Componentes: `modules/semantic-mapping/*`.

**RF-013 — Canonical Business Model build/approve/rollback**

- Comportamento: aggregates approved semantic mappings across all of an org's ERP profiles into one versioned CBM; `approve`/`rollback` both hard-fail with `MODEL_ORGANIZATION_MISMATCH` if the model's `name` field (doubling as the org key) doesn't match.
- Componentes: `modules/canonical-model/*`.

**RF-014 — Query planning, SQL generation, and execution**

- The full ERP-agnostic pipeline: RF-013's CBM → validated query intent (`query-planner`) → dialect-specific parameterized SQL (`sql-generator`, 7 dialects) → dispatch to Runtime and result pagination (`query-execution`).
- Componentes: `modules/{query-planner,sql-generator,query-execution}/*`. All parameterized (no string-concatenated SQL, confirmed).

**RF-015 — Governed ERP write execution (Price Markdown)**

- Comportamento: `runtime-connector-execution` builds an Execution Plan, allow-lists payload fields per action type (`PRICE_MARKDOWN` → `productId`/`newPrice`/`previousPrice` only), dispatches to Runtime with circuit-breaking, and supports automatic rollback (only for actions in `REVERSIBLE_ACTIONS`) by re-running the same pipeline with swapped values.
- Componentes: `modules/runtime-connector-execution/*`.

### Fleet, Marketplace, Billing

**RF-016 — Connector catalog & installation lifecycle**

- Componentes: `modules/connectors` (catalog: definitions, versions, HMAC-signed packages, parameters, templates) + `modules/connector-management` (per-runtime installation: assign/update/rollback with automatic rollback on failure).

**RF-017 — Fleet operations dashboard & remote commands**

- Componentes: `modules/fleet-ops` — heartbeat/health ingestion, alert de-duplication, deployment-job orchestration (approval-gated, strategy-based rollout with auto-rollback), a horizontal autoscaler.

**RF-018 — Billing/subscription/license simulation**

- Componentes: `modules/billing` — plan changes, license HMAC validation, usage metering, a simulated Stripe checkout flow. **Confirmed dead code**: `modules/billing/rate-limiter.ts` — fully implemented, never invoked by any route.

### Security & Compliance (Control Plane surface)

**RF-019 — Secrets management with envelope encryption**

- Comportamento: create/list/decrypt/rotate/delete, all `requireOrgId`-scoped with explicit ownership checks; automatic rotation scheduler (60s tick, 24h lead window).
- Componentes: `modules/security/security-store.ts`, `secret-rotation.ts`. Teste: 20+ dedicated BOLA tests in `security-routes.test.ts`.

**RF-020 — MFA (TOTP)**

- Comportamento: setup/verify/disable/backup-codes, rate-limited independently for setup vs. verify, keyed by `(tenantId, userId)` — deliberately not IP-inclusive to close a spoofing bypass.
- Componentes: `modules/security/security-store.ts`, `rate-limiter.ts`.

**RF-021 — Policy engine (ABAC/RBAC evaluation)**

- Componentes: `modules/security/security-store.ts`'s `updatePolicy`/evaluate — explicit mass-assignment allowlist (ATLAS 46.26 fix, re-verified intact in this audit).

**RF-022 — Compliance controls, DSAR, consent**

- Comportamento: LGPD/GDPR/SOC2/ISO27001 control tracking, 30-day DSAR deadline, consent grant/revoke.
- Componentes: `modules/security/security-store.ts`.

### High Availability

**RF-023 — Leader election & failover**

- Comportamento: strict-majority quorum required for automatic election; 15s heartbeat timeout, 5s monitor tick.
- Componentes: `modules/ha/leader-election.ts`, `failover-engine.ts`.

**RF-024 — Backup & disaster recovery**

- Comportamento: real disk-backed backup files (`.data/backups/<id>.json`) with SHA-256 checksum verification on restore; retention 30/14/7 days (full/snapshot/incremental) — **all types capture identical full-state payloads today**, retention window is the only real difference (documented limitation in source).
- **Confirmed gap** (not a bug per se, but load-bearing): `restore(backupId, tenantId, environment)` takes a `tenantId` param but the actual mutation (`controlPlaneStore.importSnapshot`) replaces global in-memory state for every tenant — the parameter is attribution-only, not a real per-tenant scope. See `docs/security/SECURITY-AUDIT.md`.
- Componentes: `modules/ha/backup-service.ts`, `recovery-service.ts`.

### Cross-cutting

**RF-025 — Chaos engineering test harness**

- Comportamento: 6 deterministic scenarios (node-failure election, deployment rollback, region failover, autoscaler load-spike, backup/restore, LB failover) that trigger REAL state changes in `ha`/`fleet-ops`/`control-plane`/`regions` and assert on observed outcomes — not a stub.
- Componentes: `modules/chaos/chaos-runner.ts`.

**RF-026 — First-run onboarding wizard**

- **Confirmed simulation, not real provisioning**: `ProvisionEngine.provision()` generates plausible-looking fake IDs and unconditionally marks all 11 tasks / 9 validations as successful — never touches the real `Tenant`/`Workspace`/`Agent`/`ApiKey` Prisma models.
- Componentes: `modules/onboarding/*`, routes under `routes/v1/setup/`.

## RNF — Requisitos Não Funcionais

| Categoria       | Requisito                                                                                         | Status                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança       | Senhas com bcrypt custo 12; JWTs assinados (HS256); Ed25519 para Runtime; secrets com AES-256-GCM | Formalizado, verificado no código                                                                                                                                                                                                                                                                                                        |
| Segurança       | Rate limiting de login (5/15min admin e portal, 10/15min runtime)                                 | Formalizado, verificado no código                                                                                                                                                                                                                                                                                                        |
| Disponibilidade | Uptime/SLA da API em produção                                                                     | **Não formalizado** — nenhum SLA contratual encontrado no código ou documentação                                                                                                                                                                                                                                                         |
| Desempenho      | Tempo de resposta da API                                                                          | **Não formalizado** — `modules/prometheus`'s SLO targets (P95 ≤300ms etc.) são dados de demonstração fixos, não medidos ao vivo nem contratuais                                                                                                                                                                                          |
| Observabilidade | Logs estruturados JSON, `X-Request-Id` de correlação                                              | Formalizado, verificado (`packages/logger`, `middleware`)                                                                                                                                                                                                                                                                                |
| Confiabilidade  | Idempotência em relatório de heartbeat/job/message-result                                         | Formalizado, verificado por teste (replay-rejection, idempotency-key dedup)                                                                                                                                                                                                                                                              |
| Integridade     | Isolamento multi-tenant                                                                           | Formalizado para os módulos com dados reais (Postgres); ver `docs/security/SECURITY-AUDIT.md` para exceções documentadas                                                                                                                                                                                                                 |
| Escalabilidade  | Autoscaler horizontal                                                                             | Implementado (`modules/fleet-ops/autoscaler.ts`), mas opera sobre dados em memória — não persiste decisões entre reinícios                                                                                                                                                                                                               |
| Manutenção      | Cobertura de testes mínima obrigatória                                                            | **Parcialmente formalizado** — `apps/api/vitest.config.ts` define thresholds reais (statements/lines 90%, functions 88%, branches 85%), mas **apenas** para `routes/v1/atlas/**`, `routes/v1/admin/**`, e `middleware/agent-auth.ts` — não para o repositório inteiro. Não existe um "80% global" como a documentação anterior afirmava. |
| Auditabilidade  | Trilha de auditoria de ações administrativas                                                      | Formalizado em schema (`AtlasAdminAuditLog`), mas **não persistido** hoje (in-memory) — ver Finding SEC-001 residual                                                                                                                                                                                                                     |
| Recuperação     | Backup/restore                                                                                    | Implementado localmente (disco), mas não é per-tenant de fato (ver RF-024) — sem backup gerenciado externo (external infrastructure, fora do escopo deste código)                                                                                                                                                                        |
| Compatibilidade | Suporte a múltiplos dialetos SQL                                                                  | Formalizado e verificado: 7 dialetos (Postgres/MySQL/MariaDB/SQLServer/Oracle/Firebird/SQLite)                                                                                                                                                                                                                                           |

## Cross-reference

Full traceability (requirement → regra → caso de uso → API → código →
banco → teste → evidência) in
`docs/requirements/REQUIREMENTS-TRACEABILITY.md`. Gaps and unformalized
areas consolidated in `docs/requirements/REQUIREMENTS-GAP-ANALYSIS.md`.
