# Atlas — User / Operational Flows

Real flows, traced through actual code paths. Format: INÍCIO →
PROCESSAMENTO → VALIDAÇÃO → PERSISTÊNCIA → RESPOSTA → ERROS → SEGURANÇA.

## Onboarding (customer self-service)

- **INÍCIO**: `POST /api/v1/portal/auth/register` (org name + owner email/password).
- **PROCESSAMENTO**: `portal-identity` creates the in-memory org record, then `linkControlPlaneOrganization` best-effort creates the REAL `Organization`/`Tenant` rows via `control-plane`'s repository.
- **VALIDAÇÃO**: email uniqueness, password strength (bcrypt cost 12 applied regardless).
- **PERSISTÊNCIA**: `Organization`/`Tenant` real (Postgres); org users/environments/invites in-memory only.
- **RESPOSTA**: 201 + session JWT.
- **ERROS**: if the Control Plane link fails (DB unreachable), it fails silently (non-fatal, documented) — the portal org exists but has no real backing `Organization` row until a later retry.
- **SEGURANÇA**: bcrypt cost 12; no PII beyond email/name collected at this step.

## Client Zero (Runtime enrollment)

- **INÍCIO**: staff issues an activation key for an Organization.
- **PROCESSAMENTO**: Runtime generates Ed25519 keypair + machine fingerprint locally; `POST /runtime/register` verifies the signed payload and the activation key's validity.
- **VALIDAÇÃO**: key not expired/used/revoked; fingerprint and public key both globally unique (real DB unique constraints, proven under concurrency).
- **PERSISTÊNCIA**: `RuntimeRegistration` row (Postgres), `status: REGISTERED`.
- **RESPOSTA**: 201 + runtime identity confirmation (never the activation key or private key echoed back).
- **ERROS**: `403` invalid/expired/used key; `409` duplicate fingerprint/public key.
- **SEGURANÇA**: Ed25519 signature on every subsequent write; activation key single-use.

## Heartbeat & liveness

- **INÍCIO**: Runtime sends `POST /runtime/heartbeat` on its own interval (default config `heartbeatIntervalMs: 30_000`, in-memory, resets on API restart).
- **PROCESSAMENTO**: Ed25519 signature verified; replay check against the last-accepted signature; `lastHeartbeat` updated.
- **VALIDAÇÃO**: rejects if runtime is BLOCKED/REVOKED.
- **PERSISTÊNCIA**: `RuntimeRegistration.lastHeartbeat` (Postgres).
- **RESPOSTA**: 200 + current liveness classification.
- **ERROS**: `401` signature mismatch; `409` replayed signature.
- **SEGURANÇA**: liveness is computed fresh on every read (`classifyLiveness`), never trusted from a stale stored value.

## Discovery → semantic mapping → canonical model

- **INÍCIO**: staff triggers `POST /erp-metadata/discover` against a connection profile.
- **PROCESSAMENTO**: Runtime polls, introspects the real ERP schema, reports back; checksum comparison skips reclassification if unchanged; ATHENA's `DatabaseScanner` classifies structurally; `business-refinement.ts`'s rule engine reclassifies into business entities with confidence scores.
- **VALIDAÇÃO**: conflict detection when the top-2 candidate confidences are within 15 points of each other.
- **PERSISTÊNCIA**: all in-memory (`erp-metadata`, `semantic-mapping`) until a human approves — then `canonical-model` assembles the versioned CBM (also in-memory).
- **RESPOSTA**: suggestion list with confidence + reasoning text.
- **ERROS**: `NO_APPROVED_MAPPINGS` if zero ERP profiles contributed an approved entity when building the CBM.
- **SEGURANÇA**: discovery/result reporting Ed25519-signed and replay-protected end to end.

## Query execution (read path)

- **INÍCIO**: an authorized caller submits a query intent (business-vocabulary filters/projections/sort/pagination).
- **PROCESSAMENTO**: `query-planner` resolves aliases against the approved CBM → `sql-generator` resolves canonical entities to physical schema/table/column and renders parameterized, dialect-specific SQL, cost-optimized (cheapest-predicate-first) → `query-execution` dispatches to the Runtime.
- **VALIDAÇÃO**: pagination bounds (limit 1-1000), operator/value-type compatibility, model/org identity match, Runtime liveness (rejects if heartbeat older than 2 minutes).
- **PERSISTÊNCIA**: execution record in-memory (`query-execution-store.ts`), results truncated to `MAX_STORED_ROWS = 10_000`.
- **RESPOSTA**: paginated result set.
- **ERROS**: retry with exponential backoff (capped 5 min) up to `DEFAULT_MAX_ATTEMPTS = 3`, then `TIMEOUT`/`FAILED`.
- **SEGURANÇA**: 100% parameterized SQL, zero string concatenation, org-ownership cross-check before dispatch.

## Governed write execution (ERP price markdown)

- **INÍCIO**: an authorized caller requests a `PRICE_MARKDOWN` execution.
- **PROCESSAMENTO**: `execution-policy.ts` allowlists exactly `productId`/`newPrice`/`previousPrice`; plan validated (7-point pre-flight check) and queued.
- **VALIDAÇÃO**: circuit breaker per connector+profile (opens after 5 consecutive failures, 60s timeout); connection profile status must not be DISABLED/DOWN/CIRCUIT_OPEN.
- **PERSISTÊNCIA**: in-memory execution plan record.
- **RESPOSTA**: plan status, eventually SUCCESS/FAILED/ROLLED_BACK.
- **ERROS**: on failure with a `previousValue`, automatic rollback re-runs the same pipeline with swapped values (only `PRICE_MARKDOWN` is in `REVERSIBLE_ACTIONS`); double-rollback blocked explicitly.
- **SEGURANÇA**: allowlisted payload, per-connector circuit breaking, idempotency-key deduplication.

## Failure handling: Runtime heartbeat loss

- **INÍCIO**: a previously-ONLINE Runtime stops sending heartbeats.
- **PROCESSAMENTO**: no background job changes state — liveness is computed fresh on every read (`classifyLiveness`), transitioning ONLINE→STALE (>60s)→OFFLINE (>5min) purely as a function of `now - lastHeartbeat`.
- **VALIDAÇÃO**: n/a — pure function, no side effects.
- **PERSISTÊNCIA**: no write occurs on state "transition" — there is no transition to persist, only a different read-time classification.
- **RESPOSTA**: any subsequent read of the Runtime reflects the new liveness immediately.
- **ERROS**: n/a.
- **SEGURANÇA**: no stale "trust" window — a caller can never see a falsely-ONLINE Runtime past the STALE/OFFLINE thresholds.

## Secrets lifecycle

- **INÍCIO**: `POST /api/v1/security/secrets` (session-scoped).
- **PROCESSAMENTO**: value envelope-encrypted (AES-256-GCM via `@seltriva/aegis`) before storage; automatic rotation scheduler evaluates every 60s, rotates when expiry is within a 24h lead window.
- **VALIDAÇÃO**: every read/rotate/delete cross-checks `secret.tenantId === callerTenantId` before returning/mutating.
- **PERSISTÊNCIA**: in-memory (`security-store.ts` — no dedicated Prisma model exists for this domain).
- **RESPOSTA**: masked value in list views; full decrypt only via the dedicated `/decrypt` endpoint, still ownership-checked.
- **ERROS**: `404` on cross-tenant access attempt (never `403`, to avoid confirming existence).
- **SEGURANÇA**: encryption at rest (in-process memory), full 110-test BOLA regression suite, confirmed passing in this audit.

## Deactivation / removal

- **Organization soft-delete**: `DELETE /api/v1/organizations/:id` (now `ctx.orgId`-scoped, fixed in this audit) sets `deletedAt` + `status: DELETED` — never a hard delete; child rows remain (queried with `deletedAt: null` filters elsewhere).
- **Runtime block/revoke**: `blockRuntime`/`revokeCertificate` — status transitions to BLOCKED/REVOKED and immediately invalidates every outstanding JWT session for that Runtime (`revokeAllRuntimeSessions`), so a blocked Runtime cannot continue operating on a still-valid token.
- **Agent retirement**: `DELETE /api/v1/agents/:id` (fixed in this audit) sets `retiredAt`, no cascade delete of heartbeat/telemetry/command history.
