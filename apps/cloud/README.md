# Atlas Cloud — Enterprise Cloud Control Plane

**Codename:** Atlas | **Version:** 0.1.0 | **Sprint:** ES-0009

Atlas Cloud is the Cloud Control Plane for the Seltriva Connect Platform. It provides
centralized orchestration for all enterprise agents, organizations, workspaces,
environments, plugins, licenses, and configuration distribution.

---

## Bootstrap Sequence

```
Configuration → Database → Services → Scheduler → Health Checks → Ready
     │               │           │          │             │
  Load env      Init Prisma  Wire all   Register    Register
  Validate     Ping DB       services    jobs       checks
  Init logger  Migrations   Init Redis  Start       Emit ready
  Init tracer               Init email  cron
                            Init queue
                            Init storage
```

## Architecture

```
                          ┌──────────────────────────────────────┐
                          │          Atlas Cloud (Next.js 15)     │
                          │                                        │
  Browser ──────────────► │  App Router (React Server Components)  │
                          │         ↓           ↓                  │
  API Client ───────────► │  Route Handlers   Server Actions        │
                          │         ↓           ↓                  │
                          │  Application Services (Hexagonal)      │
                          │         ↓                              │
                          │  Domain  │  Infrastructure             │
                          │  (ports) │  (adapters)                 │
                          │          │                              │
                          │   Prisma + Supabase PostgreSQL         │
                          │   Supabase Auth + Realtime             │
                          │   Redis Cache                          │
                          └──────────────────────────────────────┘
                                         │
                              WebSocket / HTTP
                                         │
              ┌────────────────────────────────────────────────────┐
              │               Sentinel Agents (Edge)               │
              │                                                    │
              │   Agent A   Agent B   Agent C   Agent D  ...      │
              │  [Env: Prod] [Env: Dev] [Env: QA] [Env: Staging]  │
              └────────────────────────────────────────────────────┘
```

## Module Reference

| Module         | Description                                            |
| -------------- | ------------------------------------------------------ |
| domain         | Entities, value objects, repository interfaces, events |
| application    | Commands, queries, CQRS bus interfaces                 |
| infrastructure | DI tokens, provider interfaces, auth adapter           |
| api            | Request/response types, routes, scopes, middleware     |
| runtime        | Cloud lifecycle, bootstrap phases, task IDs            |
| services       | Service container, event bus, cross-cutting wiring     |
| agents         | Agent registration, commands, heartbeat ingestion      |
| audit          | Immutable audit log, export, compliance queries        |
| configuration  | Config distribution, feature flags                     |
| health         | Liveness/readiness probes, dependency checks           |
| jobs           | Job engine: enqueue, retry, history                    |
| licenses       | License activation, feature gates, capacity limits     |
| metrics        | Time-series metrics, aggregation, agent dashboards     |
| monitoring     | Fleet status, alerts, platform overview                |
| notifications  | Multi-channel: in-app, email, webhook, Slack           |
| organizations  | Org lifecycle, member management, invites              |
| plugins        | Plugin registry, publishing, versioning                |
| scheduler      | Cloud-side cron/interval job scheduling                |
| security       | Authentication, authorization, API keys, rate limiting |
| storage        | Blob/file storage abstractions                         |
| telemetry      | Structured logs, distributed tracing, metrics export   |
| users          | User profile, upsert-from-auth, preferences            |
| tests          | Entity builders, fixtures, mock helpers                |

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| Framework     | Next.js 15, React 19                |
| Language      | TypeScript Strict                   |
| Database      | Supabase PostgreSQL                 |
| ORM           | Prisma                              |
| Auth          | Supabase Auth (JWT)                 |
| Realtime      | Supabase Realtime                   |
| Cache         | Redis (ioredis)                     |
| UI            | Tailwind CSS + shadcn/ui + Radix UI |
| Deployment    | Vercel                              |
| Monorepo      | Turborepo + pnpm                    |
| Observability | OpenTelemetry + Pino                |

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL, etc.

# Run database migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Start development server
pnpm dev
```

## Environment Variables

| Variable                      | Required | Description                  |
| ----------------------------- | -------- | ---------------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | Yes      | Supabase project URL         |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes      | Supabase anon (public) key   |
| SUPABASE_SERVICE_ROLE_KEY     | Yes      | Supabase service role key    |
| DATABASE_URL                  | Yes      | PostgreSQL connection string |
| REDIS_URL                     | No       | Redis connection string      |
| ENCRYPTION_KEY                | Yes      | AES-256 key for at-rest data |
| JWT_SECRET                    | Yes      | JWT signing secret           |
| SMTP_HOST                     | No       | Email SMTP host              |
| STORAGE_BUCKET_URL            | No       | S3-compatible storage URL    |

## License

Copyright © 2024 Seltriva. All rights reserved.
