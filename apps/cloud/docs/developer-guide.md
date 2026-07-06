# Atlas Cloud — Developer Guide

## Repository Structure

```
apps/cloud/
├── prisma/
│   └── schema.prisma          # Full PostgreSQL schema (20+ models)
├── src/
│   ├── domain/index.ts        # Entities, repository ports, domain events
│   ├── application/index.ts   # Commands, queries, CQRS bus interfaces
│   ├── infrastructure/index.ts # DI tokens, provider interfaces
│   ├── api/index.ts           # API contracts, routes, scopes
│   ├── runtime/index.ts       # Lifecycle, bootstrap phases
│   ├── services/index.ts      # Service container, event bus
│   ├── agents/                # Agent management module
│   ├── audit/                 # Audit log module
│   ├── configuration/         # Config distribution + feature flags
│   ├── health/                # Health checks
│   ├── jobs/                  # Job engine
│   ├── licenses/              # License management
│   ├── metrics/               # Time-series metrics
│   ├── monitoring/            # Fleet monitoring + alerts
│   ├── notifications/         # Multi-channel notifications
│   ├── organizations/         # Org and member management
│   ├── plugins/               # Plugin registry
│   ├── scheduler/             # Cron/interval scheduler
│   ├── security/              # Auth, authz, rate limiting
│   ├── storage/               # Blob/file storage
│   ├── telemetry/             # Logs, traces, metrics
│   ├── users/                 # User profiles
│   └── tests/                 # Test infrastructure
├── docs/
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

## Adding a New Module

1. Create `src/<module>/index.ts` with:
   - `I<Module>Service` interface (all methods return `Promise<DomainResult<T>>`)
   - Supporting types (inputs, views, enums)
   - Constants (IDs, limits, etc.)

2. Add the service to `CloudServiceContainer` in `src/services/index.ts`

3. Add a DI token to `INFRASTRUCTURE_TOKENS` in `src/infrastructure/index.ts`

4. Export from `src/index.ts` barrel

5. Add a Prisma model if persistence is needed (`prisma/schema.prisma`)

## Adding a New API Endpoint

1. Define request/response types in `src/api/index.ts`
2. Add route constant to `API_ROUTES`
3. Add scopes to `API_SCOPES` if needed
4. Create Next.js route handler in `src/app/api/...`
5. Inject service via the service container
6. Validate input with Zod before passing to application service

## Writing Tests

Use helpers from `src/tests/index.ts`:

```typescript
import { buildOrganization, buildAgent, TestIds, buildMockResult } from '@/tests/index';

const org = buildOrganization({ tier: 'ENTERPRISE' });
const agent = buildAgent({ organizationId: org.id, status: 'OFFLINE' });

// Mock a service
const mockAgentService = {
  processHeartbeat: vi.fn().mockResolvedValue(buildMockResult(undefined)),
};
```

## DomainResult Pattern

All service methods return `DomainResult<T>`:

```typescript
type DomainResult<T> = { ok: true; value: T } | { ok: false; error: DomainError };

// Usage in a handler:
const result = await service.create(input);
if (!result.ok) {
  return NextResponse.json({ error: result.error }, { status: 400 });
}
return NextResponse.json(result.value);
```

## Event-Driven Patterns

Publish a domain event:

```typescript
await eventBus.publish({
  id: nanoid(),
  topic: CLOUD_EVENT_TOPICS.AGENT_STATUS_CHANGED,
  payload: { agentId, previousStatus, newStatus },
  timestamp: new Date(),
});
```

Subscribe to events (in a service initialization):

```typescript
eventBus.subscribe(CLOUD_EVENT_TOPICS.AGENT_STATUS_CHANGED, async (event) => {
  if (event.payload.newStatus === 'OFFLINE') {
    await monitoring.createAlert({ kind: 'agent-offline', ... });
  }
});
```

## Coding Standards

- All types in module `index.ts` files are interfaces or types — no classes
- All IDs are branded strings — never `string` directly
- All service methods use `DomainResult<T>` — never throw
- All mutations are audited via `IAuditService.log()`
- No raw SQL — use Prisma query builder or repository interfaces
- No `any` — TypeScript strict mode is enforced
- No `console.log` — use `CloudLogger`
