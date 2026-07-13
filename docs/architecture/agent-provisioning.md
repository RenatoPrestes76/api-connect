# Agent Provisioning Architecture

**Sprint 17 — HERMES-II**

## Overview

The agent provisioning system enables Runtime Agent instances to self-register
with the Atlas platform by presenting a one-time provisioning token. The system
is fully decoupled from HTTP; this document describes the domain and
infrastructure layers only.

## Runtime Registration Flow

```
Runtime Agent
     │
     │  POST /provision  (Sprint 18 — not yet implemented)
     │  { rawToken, machineId, hostname, connectorType, version }
     ▼
ProvisionAgent (use case)
     │
     ▼
ProvisioningService
     │
     ├─► tokenRepo.findByHash(sha256(rawToken))
     │         │
     │         ▼
     │   ProvisioningToken
     │   ├── isRevoked()  →  TOKEN_REVOKED
     │   └── isExpired()  →  TOKEN_EXPIRED
     │
     ├─► verify companyId matches token.companyId  →  COMPANY_MISMATCH
     │
     ├─► agentRepo.findByMachineId(machineId)  →  MACHINE_ALREADY_REGISTERED
     │
     ├─► AtlasAgent.register(params)            →  VALIDATION_ERROR
     │
     ├─► agentRepo.save(agent)
     │
     ├─► tokenRepo.updateLastUse(tokenId, now)
     │
     └─► return { agentId, events: [AgentRegistered] }
```

## Layer Map

```
packages/agent-identity/          ← Pure domain (Sprint 16)
  src/entity/atlas-agent.ts       ← AtlasAgent aggregate root
  src/value-objects/              ← AgentId, MachineId, Hostname, AgentVersion, AgentStatus
  src/events/agent-events.ts      ← Domain events (AgentRegistered, HeartbeatReceived, …)
  src/repository/                 ← AtlasAgentRepository interface
  src/use-cases/                  ← RegisterAgent, UpdateHeartbeat, UpdateSynchronization, …

packages/agent-provisioning/      ← Persistence & provisioning (Sprint 17)
  src/entity/provisioning-token.ts        ← ProvisioningToken entity
  src/repository/                         ← ProvisioningTokenRepository interface + in-memory impl
  src/infrastructure/
    prisma-atlas-agent-repository.ts      ← Prisma impl of AtlasAgentRepository
    prisma-provisioning-token-repository.ts ← Prisma impl of ProvisioningTokenRepository
    prisma-types.ts                       ← Raw DB row types (matches generated Prisma client)
  src/service/provisioning-service.ts     ← Domain service: token validation + agent registration
  src/use-cases/
    create-provisioning-token.ts
    revoke-provisioning-token.ts
    provision-agent.ts
    update-agent-version.ts
    update-agent-hostname.ts

packages/database/
  prisma/schema.prisma     ← AtlasAgent + ProvisioningToken models
  src/index.ts             ← PrismaClient singleton (globalThis guard)
```

## Domain Model

### AtlasAgent

Rich aggregate root. Enforces state machine transitions via `AgentStatus`.

Status lifecycle:

```
REGISTERING ──► ONLINE ──► OFFLINE ──► ONLINE (recovery)
                   │                   ▲
                   ├──► SYNCING ────────┤
                   │        └──► ERROR ─┤
                   └──► ERROR ──────────┤
                   └──► DISABLED (terminal)
```

### ProvisioningToken

- Raw token: `slp_<hex(32 random bytes)>` — 68 chars, never stored.
- `tokenHash`: SHA-256 of raw token — stored in DB for lookup.
- `tokenPrefix`: First 12 chars — indexed for fast prefix-based lookup.
- A token is valid when: `!isRevoked() && !isExpired()`.

## Database Schema

Models live in `packages/database/prisma/schema.prisma`.

After any schema change:

```sh
pnpm --filter @seltriva/database db:generate
pnpm --filter @seltriva/database db:push
```

Key decisions:

- `machineId` is unique — prevents duplicate registrations from the same host.
- Soft-delete via `deletedAt` on `AtlasAgent` — preserves audit history.
- `tokenHash` is unique — prevents hash collision attacks.

## Security Notes

- The raw provisioning token is **returned once** to the caller and is **never
  stored** in any layer of this system (database, logs, events).
- Only `tokenHash = SHA-256(rawToken)` is persisted. SHA-256 is appropriate
  here because provisioning tokens are high-entropy random values (256 bits),
  not user-chosen passwords.
- `bcryptjs` (used elsewhere for passwords) is intentionally NOT used here:
  provisioning token lookups must be deterministic (hash → find row), whereas
  bcrypt is non-deterministic by design.
