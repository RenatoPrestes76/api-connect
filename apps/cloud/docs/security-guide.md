# Atlas Cloud — Security Guide

## Defense in Depth

```
Layer 1: Network     TLS 1.3 everywhere. HSTS enforced. No plain HTTP.
Layer 2: Auth        Supabase JWT (HS256). API Keys (HMAC-SHA256, prefix-indexed).
Layer 3: AuthZ       RBAC: OWNER / ADMIN / DEVELOPER / VIEWER hierarchy.
Layer 4: Rate Limit  Sliding window per IP / org / user. Redis-backed.
Layer 5: Input Val   Zod schemas at all API boundaries. No raw user data reaches DB.
Layer 6: RLS         Supabase Row Level Security on all tables. Tenant isolation.
Layer 7: Audit       Append-only audit log. All mutations recorded. Tamper-resistant.
```

## Authentication

### JWT (Supabase Auth)

- Issued by Supabase Auth — RS256 or HS256 depending on project settings
- Verified on every request via `ISupabaseAuthAdapter.verifyJWT()`
- Claims include: `sub` (user UUID), `email`, `role`
- Access token expiry: 1 hour
- Refresh token expiry: 30 days
- Tokens are stored in HttpOnly, Secure, SameSite=Strict cookies by the Next.js server

### API Keys

- Format: `sc_{env}_{32-char-random}` (e.g. `sc_live_a1b2c3...`)
- Only the key **prefix** (first 12 chars) is stored in the database for lookup
- The full key is **hashed with HMAC-SHA256** and the hash is stored
- The raw key is shown exactly once at creation — never again
- API keys support scoped permissions via `API_SCOPES`
- Keys can be set to expire at a specific date

```
API_SCOPES:
  agents:read         agents:write
  organizations:read  organizations:write
  users:read          users:write
  plugins:read        plugins:write
  licenses:read       licenses:write
  configuration:read  configuration:write
  metrics:read        audit:read
  admin:read          admin:write
  webhooks:write      notifications:read
```

## Authorization

### Role Hierarchy

```
OWNER  ──► all permissions (cannot be removed by non-owners)
ADMIN  ──► all except billing and ownership transfer
DEVELOPER ──► read+write on workspaces, environments, agents
VIEWER ──► read-only on assigned resources
```

Role is checked at the application layer before any mutation is performed.

### Row Level Security

All Prisma models are RLS-compatible. Supabase policies enforce:

- Users can only see their own data
- Organization data is isolated per `organizationId`
- Soft-deleted records are hidden automatically

## Data Classification

| Category     | Examples                       | Storage Policy              |
| ------------ | ------------------------------ | --------------------------- |
| Public       | Plugin names, org names        | Unencrypted                 |
| Internal     | Config keys, job payloads      | Encrypted in transit        |
| Confidential | API keys, tokens               | Hashed or encrypted at rest |
| Restricted   | Encryption keys, service roles | Environment variables only  |

## Secrets Management

- All encryption keys stored in environment variables (never in code or DB)
- Vercel encrypts environment variables at rest
- `ENCRYPTION_KEY` rotated via re-encryption job (no downtime)
- `JWT_SECRET` rotated by updating the env var and redeploying
- Supabase `SERVICE_ROLE_KEY` is never exposed to the browser (server-only)

## Rate Limiting

| Policy      | Limit         | Window | Burst |
| ----------- | ------------- | ------ | ----- |
| auth        | 10 requests   | 60s    | 5     |
| api-default | 1000 requests | 60s    | —     |
| api-agent   | 5000 requests | 60s    | —     |
| api-write   | 100 requests  | 60s    | —     |
| api-admin   | 50 requests   | 60s    | —     |

Exceeding any limit returns HTTP 429 with `Retry-After` header.

## Audit Trail

All state mutations generate an audit entry:

- Actor (user or API key)
- Action (create / update / delete / login / ...)
- Resource type + ID
- Before / after snapshot (for updates)
- IP address and user agent
- Timestamp (immutable, indexed)

Audit entries are **never deleted** — they form a compliance record.
Export via `IAuditService.export()` for SIEM/compliance tools.

## Incident Response

1. Detect via audit log query (`/api/audit?action=login&outcome=FAILURE`)
2. Revoke API key or suspend user via admin endpoints
3. Rotate `ENCRYPTION_KEY` and redeploy
4. Review rate limit logs in Redis
5. Check Supabase Auth logs for token abuse
