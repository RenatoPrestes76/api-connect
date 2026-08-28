# ATLAS Runtime Client

The real, working client for apps/api's Ed25519 `runtime-registration` +
`erp-metadata` discovery protocol — `apps/agent/src/atlas-runtime-client/`.
Added in ATLAS 46.20-B to close the gap ATLAS 46.20 found: the protocol was
API-complete and tested, but no real client existed anywhere in the repo.
See `docs/ATLAS-RUNTIME-CLIENT-AUDIT.md` for the investigation and
architectural decision behind this, and `docs/ATLAS-PRODUCTION-RUNBOOK.md`'s
"Runtime Enrollment" section for the operational summary.

## What it is, and isn't

This is a second, independent enrollment path inside `apps/agent`
("Sentinel"), alongside its existing `SELTRIVA_CLOUD_URL` cloud
registration (`/api/v1/agents/register`). The two are unrelated protocols
serving different endpoints — this work did not touch the existing one.

## Files

| File          | Responsibility                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity.ts` | Generates and persists the Runtime's Ed25519 keypair + fingerprint at `<dataDir>/atlas-runtime-identity.json`. Idempotent — a second call reuses the existing identity rather than generating a new one.                                                                       |
| `protocol.ts` | The exact canonical-payload builders (`canonicalHeartbeatPayload`, `canonicalAuthTokenPayload`) and `signPayload()`, mirroring apps/api's `modules/runtime-registration/signature.ts` byte-for-byte (re-implemented, not imported — apps/agent and apps/api are sibling apps). |
| `client.ts`   | Real HTTP calls: `registerRuntime`, `obtainAccessToken`, `sendHeartbeat`, `pollJobs`, `submitResult`, plus `withRetry()` (exponential backoff, never retries a 4xx, always rebuilds a fresh timestamp+signature per attempt).                                                  |
| `executor.ts` | `executeDiscoveryScan()` — a real GENESIS (`@seltriva/database-sdk`'s `PostgresDriver`) schema introspection against a real, reachable Postgres. No fixture.                                                                                                                   |
| `run.ts`      | `runAtlasRuntimeClient()` — orchestrates one full pass: load/create identity → register if needed → heartbeat → obtain access token → poll jobs → execute + submit each.                                                                                                       |

## Configuration

Set on the machine running `apps/agent`:

| Env var                                                          | Required                | Purpose                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATLAS_API_URL`                                                  | Yes (enables this path) | Base URL of the Atlas API, e.g. `https://api.atlasappruntime.com.br` once the domain is live, or `http://localhost:3001` locally. Unset skips this enrollment path entirely — non-fatal, matching the existing `SELTRIVA_CLOUD_URL` gate.     |
| `ATLAS_ORGANIZATION_CODE`                                        | Yes                     | The tenant's organization code, issued by whoever owns the customer onboarding flow.                                                                                                                                                          |
| `ATLAS_ACTIVATION_KEY`                                           | Yes                     | A single-use activation key for that organization (`POST /admin/runtime-registration/activation-keys`). Consumed on first successful registration — a restart afterward reuses the persisted identity, not the key.                           |
| `ATLAS_SCAN_DB_HOST` / `_PORT` / `_NAME` / `_USER` / `_PASSWORD` | Optional                | The real database this Runtime installation scans for discovery jobs. Unset means the Runtime enrolls and heartbeats normally but reports any assigned job as failed with `"No scan target configured on this Runtime"` rather than crashing. |

The Runtime's identity (keypair + fingerprint + assigned `runtimeId`) is
persisted at `<data_dir>/atlas-runtime-identity.json` (`data_dir` is the
agent's own config, `AGENT_DATA_DIR_ENV_VAR` / defaults to
`~/.seltriva/agent`). The private key never leaves that file and is never
transmitted or logged — only the public key is sent, at registration.

## Protocol summary (see the audit doc for the full trace)

```
register (public key, activation key, fingerprint)
  -> runtimeId + certificate
heartbeat (Ed25519-signed body, no headers)     -> ACTIVE status
auth/token (Ed25519-signed body)                -> JWT access token
GET  /erp-metadata/runtime/jobs   (Bearer)       -> claimed jobs
POST /erp-metadata/runtime/result (Bearer)       -> ATHENA classification runs server-side
```

Replay protection is a ±5-minute timestamp window plus exact-signature
dedupe — there's no separate nonce field in this protocol (the brief this
sprint started from assumed a generic nonce/header scheme; the real,
already-shipped protocol is simpler, and this client matches what's
actually there rather than what was assumed). Since ATLAS 46.22, the
dedupe signature (`lastHeartbeatSignature`) is a real Postgres column, so
this protection now survives an Atlas API process restart too — see
"Runtime Registration Persistence (ATLAS 46.22)" below.

## Runtime Registration Persistence (ATLAS 46.22)

Server-side, the Runtime identity this client creates and registers is
Prisma-backed (`RuntimeRegistration` model,
`packages/database/prisma/schema.prisma`) — not in-memory. Concretely,
for anyone integrating this client:

- **Re-registering after an Atlas API restart is unnecessary.** The
  client's own identity file (`<data_dir>/atlas-runtime-identity.json`)
  and the server's registration record are both durable — a restarted
  Atlas API still knows this Runtime, still accepts its heartbeats, and
  still issues access tokens for it, with no re-registration step.
- **Two Runtimes can never share an identity.** `machineFingerprintHash`
  and `publicKey` are both unique at the database level (not just an
  application-side check) — attempting to register a second Runtime with
  either value already in use is rejected with `FINGERPRINT_DUPLICATE` or
  `PUBLIC_KEY_ALREADY_REGISTERED` respectively, even under concurrent
  registration attempts racing the same identity.
- **Tenant association is derived, not stored on the Runtime.** A
  Runtime's Tenant is whatever its linked Control Plane Organization's
  `tenantId` currently is — see
  `docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`'s "ATLAS 46.22 — Runtime
  Registration Persistence" section for the full design and the current,
  externally-undecided state of Tenant provisioning for self-service
  signups.

See `apps/api/src/__tests__/runtime-registration/restart-durability-e2e.test.ts`
for the real (spawned-process kill/restart) proof, and
`apps/api/src/__tests__/runtime-registration/registration-idempotency.test.ts`
for the uniqueness/race proofs.

## Running it

Standalone, for a one-off check:

```bash
ATLAS_API_URL=http://localhost:3001 \
ATLAS_ORGANIZATION_CODE=<code> \
ATLAS_ACTIVATION_KEY=<key> \
ATLAS_SCAN_DB_HOST=localhost ATLAS_SCAN_DB_PORT=5433 \
ATLAS_SCAN_DB_NAME=seltriva_connect ATLAS_SCAN_DB_USER=seltriva ATLAS_SCAN_DB_PASSWORD=seltriva_dev_password \
pnpm --filter=@seltriva/agent start
```

It also runs automatically as part of `apps/agent`'s existing Phase 7
bootstrap step whenever the four required env vars above are set.

## Tests

- `apps/agent/src/atlas-runtime-client/__tests__/` — unit tests for the
  canonical payload format, identity persistence, and retry/backoff logic
  (`pnpm --filter=@seltriva/agent test`).
- `apps/api/src/__tests__/runtime-registration/real-client-enrollment-e2e.test.ts` —
  the real end-to-end proof: this exact client module (imported directly,
  not reimplemented) driving a real HTTP server through register →
  heartbeat → auth token → discover → claim → a real GENESIS scan →
  submit → ATHENA classification, plus six negative cases (invalid
  signature, replayed signature, expired timestamp, unknown runtime,
  unauthenticated poll, cross-tenant result submission).
- `apps/api/src/__tests__/runtime-registration/restart-durability-e2e.test.ts`
  (ATLAS 46.22) — a real `node dist/index.js` process, killed and
  restarted mid-test on the same port: register → verify in Postgres →
  kill → restart → Runtime still there → heartbeat still works → full
  ERP discovery/GENESIS/ATHENA cycle still completes against the new
  process.
- `apps/api/src/__tests__/runtime-registration/tenant-association.test.ts`
  (ATLAS 46.22) — PENDING_TENANT_ASSIGNMENT, Tenant reassignment
  propagation, and cross-tenant Control Plane isolation.
- `apps/api/src/__tests__/runtime-registration/registration-idempotency.test.ts`
  (ATLAS 46.22) — same-fingerprint and same-public-key duplicate
  registration rejection, including a real concurrent-request race proving
  the database unique constraint (not just an app-level check) is the
  actual guard.

## Troubleshooting

- **`ATLAS_ORGANIZATION_CODE and ATLAS_ACTIVATION_KEY are required`**: set
  both alongside `ATLAS_API_URL` — all three are required together.
- **`ACTIVATION_KEY_ALREADY_USED`**: the key was already consumed by a
  prior registration (this Runtime's or another's) — a restart of the same
  Runtime should reuse its persisted identity file, not re-register; if the
  identity file was deleted, a fresh activation key is needed.
- **Every job reports `"No scan target configured on this Runtime"`**: set
  the five `ATLAS_SCAN_DB_*` variables.
- **`INVALID_SIGNATURE`**: almost always means the persisted identity file
  doesn't match what's registered server-side — check nothing regenerated
  `<data_dir>/atlas-runtime-identity.json` between registration and this
  call.
- **`REPLAY_REJECTED`**: either the local clock has drifted more than 5
  minutes from Atlas's, or (much less likely) the exact same signed request
  was somehow sent twice — `client.ts`'s functions always build a fresh
  timestamp per call, so this shouldn't happen through normal use of this
  client.
