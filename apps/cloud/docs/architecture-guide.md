# Atlas Cloud — Architecture Guide

## Hexagonal Architecture

Atlas Cloud follows Hexagonal Architecture (Ports & Adapters) strictly:

```
                    ┌─────────────────────────────────────┐
                    │             Domain Layer             │
                    │  Entities · Value Objects · Events  │
                    │  Repository Ports · Domain Services  │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────┴──────────────────────┐
                    │          Application Layer           │
                    │  Commands · Queries · CQRS           │
                    │  Application Service Interfaces      │
                    └──────────────┬──────────────────────┘
                    ┌──────────────┴──────────────────────┐
      Driving       │         Infrastructure Layer         │  Driven
      Adapters      │  Prisma · Supabase · Redis · Email   │  Adapters
      (API Routes,  │  Storage · Queue · Encryption        │  (Repositories,
       Server Acts) └─────────────────────────────────────┘  Providers)
```

## Domain-Driven Design

### Aggregates

| Aggregate    | Root Entity  | Invariants                                     |
| ------------ | ------------ | ---------------------------------------------- |
| Organization | Organization | Unique slug. Cascades to all child resources.  |
| Workspace    | Workspace    | Unique slug per organization.                  |
| Agent        | Agent        | Unique per organization+environment.           |
| License      | License      | One active license per organization at a time. |
| Plugin       | Plugin       | Unique slug across the registry.               |

### Domain Events

```
OrganizationCreated  ──► send welcome email, provision defaults
OrganizationSuspended ──► revoke tokens, notify owner, disable agents
AgentRegistered      ──► send confirmation, set up monitoring
AgentStatusChanged   ──► trigger alerts if degraded/offline
AgentHeartbeatReceived ──► update fleet status, record metrics
LicenseActivated     ──► unlock tier features, notify members
LicenseExpiring      ──► schedule expiry notifications
PluginInstalled      ──► push to agent fleet, audit log
UserInvited          ──► send invite email via job queue
```

### Repository Pattern

All persistence is behind interfaces in the domain layer:

```typescript
interface IRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
}

// Specialized: IOrganizationRepository extends IRepository<Organization, OrganizationId>
// Specialized: IAgentRepository extends IRepository<Agent, AgentId>
// ... etc.
```

## CQRS

All mutations go through **Commands**; all reads go through **Queries**.

```
Client → API Route → ICommandBus → CommandHandler → Domain → Repository → DB
Client → API Route → IQueryBus  → QueryHandler  → ReadModel → Repository → DB
```

Commands always return `DomainResult<T>` (never throw).
Queries always return plain typed values.

## Module Dependency Graph

```
services ──────────────────────────────────────────────────────────► All modules
              ↓
   ┌──────────────────────────────────────────────────────────────┐
   │  domain         ← application ← infrastructure ← api        │
   │  organizations  ← agents      ← licenses       ← plugins    │
   │  users          ← security    ← audit           ← metrics   │
   │  notifications  ← jobs        ← scheduler       ← health    │
   │  monitoring     ← telemetry   ← storage          ← config   │
   └──────────────────────────────────────────────────────────────┘
              ↑
            tests (imports from all — dev/test only)
```

## Security Layers

```
Layer 1: Network     — TLS 1.3, HSTS, Security Headers
Layer 2: Auth        — Supabase Auth JWT, API Key (HMAC-SHA256)
Layer 3: AuthZ       — Role-based (OWNER/ADMIN/DEVELOPER/VIEWER)
Layer 4: Rate Limit  — Sliding window, Redis-backed, per IP/org/user
Layer 5: Validation  — Zod schemas at every API boundary
Layer 6: RLS         — Supabase Row Level Security on all tables
Layer 7: Audit       — Immutable audit log for all mutations
```

## Data Flow: Agent Heartbeat

```
Agent ──WebSocket──► API Route /api/agents/:id/heartbeat
                          │
                    IAgentService.processHeartbeat()
                          │
               ┌──────────┼──────────────┐
               ▼          ▼              ▼
         DB: upsert   Metrics.record  Monitoring
         heartbeat    cpu/mem/disk    evaluate status
               │                         │
          EventBus                 if degraded/offline
     AgentHeartbeatReceived         CreateAlert()
               │                    NotifyService()
         Realtime broadcast
         to org channel
```

## Data Flow: Configuration Distribution

```
Admin sets config ──► POST /api/workspaces/:id/config
                           │
                     IConfigurationService.set()
                           │
                     Store encrypted in DB
                     Bump workspace version
                           │
                     POST /api/workspaces/:id/config/push
                           │
                     IAgentService.sendCommand(reload-config)
                           │
                     All agents in workspace receive command
                     via WebSocket channel
                           │
                     Agent fetches new config from cloud
```
