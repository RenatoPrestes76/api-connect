# Atlas Cloud — Deployment Guide

## System Requirements

| Component  | Minimum  | Recommended     |
| ---------- | -------- | --------------- |
| Node.js    | 20.x LTS | 22.x LTS        |
| PostgreSQL | 15.x     | 16.x (Supabase) |
| Redis      | 7.x      | 7.2+ (upstash)  |
| Memory     | 512 MB   | 2 GB            |
| CPU        | 1 vCPU   | 2+ vCPU         |

## Vercel Deployment (Recommended)

```bash
# 1. Fork / clone the repository
git clone https://github.com/seltriva/connect
cd apps/cloud

# 2. Install Vercel CLI
npm i -g vercel

# 3. Link project
vercel link

# 4. Configure environment variables (Vercel dashboard or CLI)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DATABASE_URL
vercel env add DIRECT_URL
vercel env add REDIS_URL
vercel env add ENCRYPTION_KEY
vercel env add JWT_SECRET
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add SMTP_FROM

# 5. Run database migrations
pnpm db:migrate:deploy

# 6. Deploy
vercel --prod
```

## Environment Variables Reference

### Required

| Variable                      | Description                               |
| ----------------------------- | ----------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | Supabase project REST URL                 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key (public)                |
| SUPABASE_SERVICE_ROLE_KEY     | Supabase service role (server-only)       |
| DATABASE_URL                  | Prisma connection pooler URL              |
| DIRECT_URL                    | Prisma direct connection URL (migrations) |
| ENCRYPTION_KEY                | 32-byte hex key for AES-256               |
| JWT_SECRET                    | HS256 JWT signing secret (min 32 chars)   |

### Optional

| Variable           | Default | Description                           |
| ------------------ | ------- | ------------------------------------- |
| REDIS_URL          | —       | Redis URL (disables caching if unset) |
| SMTP_HOST          | —       | SMTP relay host                       |
| SMTP_PORT          | 587     | SMTP port                             |
| SMTP_USER          | —       | SMTP user                             |
| SMTP_PASS          | —       | SMTP password                         |
| SMTP_FROM          | —       | From address for emails               |
| LOG_LEVEL          | info    | Pino log level                        |
| RATE_LIMIT_ENABLED | true    | Enable rate limiting                  |
| TELEMETRY_ENDPOINT | —       | OpenTelemetry OTLP endpoint           |

## Supabase Setup

```sql
-- 1. Create Supabase project at supabase.com

-- 2. Enable Row Level Security on all tables (done by Prisma migration + RLS policies)

-- 3. Configure Auth settings:
--    Site URL:       https://your-app.vercel.app
--    Redirect URLs:  https://your-app.vercel.app/auth/callback

-- 4. Create storage buckets:
--    plugins         (private)
--    audit-exports   (private, TTL 24h)
--    avatars         (public)
--    logos           (public)
```

## Database Migrations

```bash
# Development
pnpm db:migrate:dev

# Production (run once, before deploying new version)
pnpm db:migrate:deploy

# Generate Prisma client after schema changes
pnpm db:generate

# Open Prisma Studio (local inspection)
pnpm db:studio
```

## Zero-Downtime Deployment

Atlas Cloud is stateless — all state lives in Supabase + Redis.

1. Run `pnpm db:migrate:deploy` before deploying new version
2. Vercel performs atomic swap with no traffic interruption
3. Multiple instances can run simultaneously (all stateless)
4. Redis keys are versioned to avoid cache poisoning during deploys

## Health Probes

| Endpoint              | Purpose     | Expected Response        |
| --------------------- | ----------- | ------------------------ |
| GET /api/health       | Full report | 200 `{ status, checks }` |
| GET /api/health/live  | Liveness    | 200 `{ alive: true }`    |
| GET /api/health/ready | Readiness   | 200/503                  |

Configure Vercel health check → `/api/health/live`.

## Monitoring & Observability

- Structured JSON logs via Pino → forward to Datadog, Axiom, or Logtail
- OpenTelemetry traces → any OTLP-compatible backend (Jaeger, Tempo, Honeycomb)
- Metrics via `/api/health` + custom `/api/admin/metrics` endpoint
- Supabase dashboard for database query performance

## Rollback

Vercel retains previous deployments. To rollback:

```bash
vercel rollback [deployment-url]
```

If the rollback requires reversing a database migration:

```bash
pnpm db:migrate:rollback --to <migration-name>
```
