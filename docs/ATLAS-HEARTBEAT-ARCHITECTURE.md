# ATLAS Heartbeat Architecture

Three heartbeat mechanisms exist in this repo, one per enrollment flow (see
`docs/ATLAS-RUNTIME-ONBOARDING-MATRIX.md`). This document compares them and
records which one is canonical, per
`docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md`.

| Capability        | Runtime Registration (Ed25519)                                                                                                                                                                                                                                                                                                             | Atlas Heartbeat (`atlas/heartbeat.ts`)                                                                                      | Agent legacy (`AgentService`)                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Identity**      | Ed25519 keypair, per-request signature over a canonical JSON payload                                                                                                                                                                                                                                                                       | `AtlasAgentRepository` lookup by `ctx.agentId` (set by an upstream auth check on the AtlasAgent's own bearer credential)    | Plain `agentId` path param, no signature                                                                       |
| **ONLINE**        | First accepted heartbeat flips `REGISTERED`→`ACTIVE` (`runtime-registration-store.ts`'s `recordHeartbeat`)                                                                                                                                                                                                                                 | `agent.markOnline()` when status isn't disabled (`atlas/heartbeat.ts`)                                                      | `status` field set directly from the request body (`HeartbeatInput.status`, caller-supplied, not computed)     |
| **STALE**         | Not computed — only `lastHeartbeat` timestamp is stored, no staleness logic anywhere in `runtime-registration-store.ts`                                                                                                                                                                                                                    | Yes — `@seltriva/agent-observability`'s `computeHealth()`: `ONLINE` (<2min), `STALE` (2-10min), `OFFLINE` (≥10min or never) | Not computed                                                                                                   |
| **OFFLINE**       | Not computed (same gap as STALE)                                                                                                                                                                                                                                                                                                           | Yes, same `computeHealth()`                                                                                                 | Not computed                                                                                                   |
| **Control Plane** | Not visible in `/admin/control-plane/runtimes` (that page reads control-plane-store's own disconnected in-memory `Runtime` list) — visible in the dedicated "Atlas Runtimes" admin page, and now (46.21) cross-referenceable to a real Control Plane Organization via the new `GET /admin/control-plane/organizations/:id/runtimes` lookup | Feeds `apps/cloud`'s `(atlas)` dashboard pages, not the admin Control Plane                                                 | None found — no UI page reads `/api/v1/agents/*`                                                               |
| **Observability** | None beyond the stored `lastHeartbeat`/`lastMemoryMb`/`lastCpuPercent` fields                                                                                                                                                                                                                                                              | Full: `AtlasAgentHeartbeat` history table, `HeartbeatRecord.create()` persists every heartbeat received                     | `AgentService.getRecentHeartbeats()` — history exists but nothing computes health status from it               |
| **Persistence**   | In-memory (`runtime-registration-store.ts`) — lost on process restart                                                                                                                                                                                                                                                                      | Prisma (`AtlasAgent`, `AtlasAgentHeartbeat`) — durable                                                                      | Prisma (`Agent`, presumably a heartbeat-history table) — durable, but unreachable since registration is broken |
| **Consumer**      | `apps/agent/src/atlas-runtime-client/` (real, ATLAS 46.20-B); admin reads via "Atlas Runtimes" page                                                                                                                                                                                                                                        | `apps/runtime-installer` (registers), `apps/cloud`'s `(atlas)` pages (reads)                                                | None currently functional                                                                                      |

## Heartbeat of Record

**`runtime-registration`'s `POST /runtime/heartbeat`** is the heartbeat of
record for the canonical enrollment path (Ed25519 — see the ADR). It is
the only heartbeat mechanism tied to the Runtime Identity of Record
(`RuntimeRegistrationRecord`), cryptographically signed, and replay-
protected.

**It is not merged with `atlas/heartbeat.ts`.** That mechanism remains the
heartbeat of record for the separate `AtlasAgent`/Runtime Installer flow,
which `apps/cloud`'s `(atlas)` dashboard genuinely depends on today — moving
or removing it would break a real consumer, which is out of this sprint's
scope ("não fazer grandes migrações", "não remover legacy sem prova de
zero consumidores" — and this one has a proven consumer).

## The gap this leaves (reservation, not fixed here)

`runtime-registration`'s heartbeat has no STALE/OFFLINE computation —
`agent-observability`'s `computeHealth()` already exists and does exactly
this, but wiring it into a second, unrelated Prisma-free record type
(`RuntimeRegistrationRecord`) is a real design decision (does staleness
get computed on read, on a timer, backed by which persistence?) bigger
than a "pequeno ajuste." Recorded as a reservation for a future sprint, not
attempted here — consistent with ATLAS 46.20-B's own finding on this exact
point.
