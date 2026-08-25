# ATLAS — Production Domain Readiness

**STATUS ATUAL: RESERVED / NOT YET REGISTERED**

This document prepares the monorepo for the future production domain
`atlasappruntime.com.br`. As of the date of this document, **the domain has
not been purchased or activated** — nothing here assumes DNS resolves, a
certificate exists, or the API is publicly reachable. Every section below is
either (a) something that already works today and needs no domain, or (b)
explicitly marked **PENDENTE** where it genuinely depends on the domain
being registered.

This is infrastructure preparation, not a feature sprint. No business logic,
authentication model, or API contract changed as part of this work.

## 1. Domain and subdomains

| Host                           | Purpose                         | Maps to (this repo)                                                                                            | Confidence                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.atlasappruntime.com.br`   | Public REST + WebSocket API     | `apps/api` (deployed today as the Render service `seltriva-api`, see §6)                                       | High — explicit in scope                                                                                                                                                                                                                                                                                                     |
| `admin.atlasappruntime.com.br` | Control Plane admin UI          | `apps/admin` (`@seltriva/admin`) — its API client already reads `ADMIN_API_URL`/`NEXT_PUBLIC_ADMIN_API_WS_URL` | High — `admin-api.ts` naming and exclusive fleet/control-plane consumption match                                                                                                                                                                                                                                             |
| `app.atlasappruntime.com.br`   | Primary customer-facing product | `apps/web` (`@seltriva/web`, "Atlas Hub") — reads `NEXT_PUBLIC_HUB_API_URL`                                    | Medium — best match by naming/consumption pattern, but this repo also has `apps/cloud` (`@seltriva/cloud`, "Atlas Cloud Control Plane") with an overlapping description. This mapping is a documentation note only; no code depends on it, and it should be confirmed by whoever owns product IA before DNS is actually cut. |
| `docs.atlasappruntime.com.br`  | Public documentation site       | `apps/docs` (`@seltriva/docs`)                                                                                 | High — only documentation app in the monorepo                                                                                                                                                                                                                                                                                |

`apps/cloud`, `apps/studio`, and `apps/developer-portal` are not in scope for
this bootstrap (the task specifies exactly these four hosts). They keep
their existing Vercel-assigned domains for now; nothing about this work
blocks giving them a subdomain later using the same pattern.

## 2. API public URL — reusing existing variables, not inventing a new one

The audit (see §11 for the full inventory) found **no single existing
"API public URL" standard** — three different frontend apps already each
read their own env var for the same underlying `apps/api` URL:

| App          | Variable                                                                     | Current default                                 |
| ------------ | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| `apps/admin` | `ADMIN_API_URL` (server-side) + `NEXT_PUBLIC_ADMIN_API_WS_URL` (browser, WS) | `http://localhost:3001` / `ws://localhost:3001` |
| `apps/web`   | `NEXT_PUBLIC_HUB_API_URL`                                                    | `http://localhost:3001`                         |
| `apps/cloud` | `NEXT_PUBLIC_ATLAS_API_URL`                                                  | `http://localhost:3001`                         |

Rather than introduce a fifth name (`ATLAS_API_PUBLIC_URL`) with no code
consumer, this task **reuses each app's existing variable**. Once the
domain is live, production deploys (Vercel project settings, not this repo)
should set:

```
ADMIN_API_URL=https://api.atlasappruntime.com.br
NEXT_PUBLIC_ADMIN_API_WS_URL=wss://api.atlasappruntime.com.br
NEXT_PUBLIC_HUB_API_URL=https://api.atlasappruntime.com.br
NEXT_PUBLIC_ATLAS_API_URL=https://api.atlasappruntime.com.br
```

The corresponding `.env.example` files now document this as a comment (see
`apps/admin/.env.example`, `apps/web/.env.example`, `apps/cloud/.env.example`).
No `.env.example` default value was changed — local dev still defaults to
`http://localhost:3001`.

Consolidating these four names into one is a legitimate future cleanup, but
it's a cross-app refactor outside this task's blast radius — noted, not
executed.

One unrelated, pre-existing loose end found during the audit and left
alone (out of scope — not a domain-bootstrap concern): `apps/web/.env.local`
declares `NEXT_PUBLIC_API_URL`, which is not read anywhere in `apps/web/src`
(dead variable), and the root `.env.example` declares `CLOUD_API_URL`, which
`apps/cloud/src` doesn't read either (it reads `NEXT_PUBLIC_ATLAS_API_URL`
instead, per `apps/cloud/.env.example`). Both predate this task.

## 3. CORS

`apps/api/src/http/router.ts` is the **only** place CORS is implemented in
the monorepo — no per-app Next.js `headers()` policy, no `vercel.json`
`headers` block duplicates it. It's driven entirely by the
`CORS_ALLOWED_ORIGINS` env var (comma-separated origins); unset keeps the
pre-existing open `'*'` behavior so nothing that depends on that today
breaks.

**Bug found and fixed during this audit** (not a new feature — a
correctness fix directly required to make the multi-subdomain case in §1
actually work): `json()` (the function every route handler's response goes
through) called `corsHeaders()` with no argument, so real JSON responses
never saw the request's `Origin` header — only the separate OPTIONS
preflight path did. With more than one origin configured, `allowedOrigin()`
had no request origin to match against and silently fell back to
`allowlist[0]` on every real response. Concretely: with
`CORS_ALLOWED_ORIGINS=https://app...,https://admin...` configured, a
browser on `admin.` would pass preflight (which does see the real Origin)
and then have its actual response's `Access-Control-Allow-Origin` come back
as `app.`'s value instead of its own — which the browser rejects
client-side. This would have surfaced the day both `app.` and `admin.` were
both put in the allowlist together, which is exactly this bootstrap's
target configuration.

Fix: `json()` now reads `res.req.headers['origin']` (Node's own
response→request back-reference) and threads it into `corsHeaders()`, so
every real response reflects the actual calling origin, same as the
preflight already did. `apiError()`/`paginated()` both delegate to `json()`,
so they're covered too. See `apps/api/src/http/router.ts`.

New regression coverage: `apps/api/src/__tests__/http/cors.test.ts` (7
tests) — unset-allowlist still returns `*`; a configured multi-origin
allowlist reflects the exact calling origin (both on real responses and on
preflight, for more than one configured origin, not just the first); a
disallowed origin is never reflected; no bare `*` leaks once an allowlist
is configured, even with no `Origin` header sent; a local dev origin can
coexist with production origins when explicitly listed.

Production value, once the domain is live (set in Render, see §6 —
`CORS_ALLOWED_ORIGINS` is already `sync: false` in `render.yaml`, meaning
it's set via the Render dashboard, not committed):

```
CORS_ALLOWED_ORIGINS=https://app.atlasappruntime.com.br,https://admin.atlasappruntime.com.br
```

`docs.atlasappruntime.com.br` is a static content site with no browser-side
calls to `api.`, so it doesn't need a CORS entry unless that changes later.

## 4. Health endpoint — reused, not duplicated

`apps/api` already exposes `GET /health` (DB + memory check),
`GET /live` (pure liveness), and `GET /ready` (DB check, honestly reports
`cache`/`queues` as `not_configured`), each also aliased under `/api/v1/`.
`render.yaml` already points `healthCheckPath: /health` at this. Nothing
new was added — the existing endpoint is exactly what a Render custom
domain / any future proxy should keep using.

## 5. Reverse proxy readiness

**No self-hosted reverse proxy exists in this repo** (no nginx/Caddy/
Traefik config anywhere) — the real, existing production deploy target is
**Render.com** (`render.yaml`, service `seltriva-api`, Docker runtime,
region `oregon`). Render itself terminates TLS and proxies HTTPS→the
container's internal port; the container never needs to bind anything
public-facing beyond what it already does (`EXPOSE 3001`, no other ports).

Attaching `api.atlasappruntime.com.br` to the existing Render service is a
**Render dashboard action** (Settings → Custom Domains → Add Custom
Domain), not a repo change — this task does not perform that action, since
it requires the domain to actually be registered and its nameservers/DNS
under the user's control. Once the domain exists:

1. Add `api.atlasappruntime.com.br` as a custom domain on the `seltriva-api`
   Render service.
2. Render issues a CNAME/A target (see §7 for the placeholder record shape).
3. Create that DNS record at the registrar/DNS provider.
4. Render auto-provisions a Let's Encrypt certificate once DNS resolves
   (see §7).

No conflicting reverse-proxy infrastructure was introduced — this section
is documentation only.

## 6. TLS readiness

**PENDENTE — depende de DNS/infraestrutura.**

No certificate was issued or referenced by this task, and no self-signed
certificate was created (self-signed certs must never be used for
production). Render automatically provisions and renews a Let's Encrypt
certificate for any custom domain once its DNS record correctly points at
the service — this is Render's existing, already-in-use mechanism (the
default `*.onrender.com` domain already has one), not new infrastructure.
There is nothing to configure in this repo for TLS itself; it activates the
moment the DNS record in §7 is created and resolves.

## 7. DNS records needed (PLACEHOLDER — not real)

**PENDENTE — domínio ainda não registrado/ativado.**

Once `atlasappruntime.com.br` is registered, the following records should
be created at whatever DNS provider hosts the zone. The destination values
below are **explicit placeholders**, not real infrastructure — Render
generates the actual target string (typically `<service-name>.onrender.com`
or a Render-assigned CNAME target) only after a custom domain is added in
the dashboard, which itself requires the domain to already be registered.

| Host                           | Type       | Value (placeholder)          | Notes                                                                                                                              |
| ------------------------------ | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `api.atlasappruntime.com.br`   | CNAME      | `<PLACEHOLDER>.onrender.com` | Real value comes from Render's dashboard after adding the custom domain (§5)                                                       |
| `admin.atlasappruntime.com.br` | CNAME or A | `<PLACEHOLDER>`              | Depends on where `apps/admin` is ultimately deployed (Vercel today — Vercel similarly assigns its own target on custom-domain add) |
| `app.atlasappruntime.com.br`   | CNAME or A | `<PLACEHOLDER>`              | Same as above, for `apps/web`                                                                                                      |
| `docs.atlasappruntime.com.br`  | CNAME or A | `<PLACEHOLDER>`              | Same as above, for `apps/docs`                                                                                                     |

No nameservers were changed, no registrar command was executed, and no
record was actually created — this table exists purely so the eventual
real values have a place to be filled in.

## 8. `.env*` audit

Confirmed layout (no changes to gitignore status, no real secrets touched):

| File                                                                                                                   | Tracked in git? | Notes                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`, `apps/api/.env`                                                                                                | No (gitignored) | Real local dev values                                                                                                                  |
| `.env.local` (root)                                                                                                    | No              | Vercel-CLI-generated, contains a live OIDC token — left untouched                                                                      |
| `apps/web/.env.local`                                                                                                  | No              | Real local dev values                                                                                                                  |
| `.env.example`, `apps/api/.env.example`, `apps/admin/.env.example`, `apps/cloud/.env.example`, `apps/web/.env.example` | Yes             | Placeholder/dev values only — the only files this task edited, adding documentation comments (§2, §3), never a real or invented secret |

No `.env.production.example` exists. One wasn't added — production secrets
for `apps/api` are configured directly as Render environment variables
(`render.yaml`'s `sync: false` entries: `CORS_ALLOWED_ORIGINS`,
`API_SECRET_KEY`, `DATABASE_URL`, `ATLAS_MASTER_KEY`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`), and the three Vercel-hosted apps' production API
URLs are Vercel project env vars — neither belongs in a committed file
regardless of filename.

## 9. Docker

`docker-compose.yml` is dev-oriented (bind-mounts `apps/api`/`packages` for
live editing, `NODE_ENV: development`) — not the production path, no change
needed there for domain readiness.

`docker/Dockerfile.api` is the real production image (multi-stage, runs the
compiled build via `CMD ["node", "dist/index.js"]`, `EXPOSE 3001` only).
Audited against Etapa 10's checklist:

- **Port**: correct, single internal port, no unnecessary public bind.
- **Production process**: already correct — runs the compiled `dist/`
  output, not a dev server.
- **Graceful shutdown / SIGTERM / SIGINT**: already correct —
  `apps/api/src/index.ts` registers both handlers, closes the HTTP server,
  disconnects the DB, and force-exits after a 10s timeout if shutdown
  hangs. `CMD` uses exec form (`["node", ...]`), so signals reach the Node
  process directly as PID 1 with no shell wrapping them.
- **Healthcheck**: **gap found and fixed.** The Dockerfile itself had no
  `HEALTHCHECK` directive — the only health signal was Render's own
  platform-level `healthCheckPath: /health` check, meaning the image had no
  self-contained health signal if ever run outside Render (plain Docker,
  Compose, Kubernetes). Added a container-level `HEALTHCHECK` that reuses
  the existing `/health` endpoint via Node's built-in `fetch` (no new
  package needed) — see `docker/Dockerfile.api`.

No other Dockerfile changes were made; this was a small, targeted fix, not
a Docker refactor.

## 10. WebSocket

Current, unchanged: `apps/api/src/server.ts` upgrades connections only at
path **`/admin/fleet/ws`**, authenticated via a short-lived ticket minted
by `POST /admin/fleet/notifications/ws-ticket` (a WS handshake can't carry
an `Authorization` header, so the ticket is exchanged over authenticated
REST first, then passed as `?ticket=...` on the upgrade request).
`apps/admin/src/hooks/use-live-notifications.ts` connects to
`${ADMIN_API_WS_URL}/admin/fleet/ws?ticket=...`, where `ADMIN_API_WS_URL`
comes from `NEXT_PUBLIC_ADMIN_API_WS_URL` (§2).

No protocol change was made. Future production address, once the domain
and TLS are live (Render terminates TLS, so `wss://` "just works" the same
way `https://` does — no separate WebSocket-specific proxy config needed):

```
wss://api.atlasappruntime.com.br/admin/fleet/ws?ticket=...
```

`NEXT_PUBLIC_ADMIN_API_WS_URL` should be set to
`wss://api.atlasappruntime.com.br` in `apps/admin`'s production Vercel env
once the domain is live (already documented in `apps/admin/.env.example`,
§2).

## 11. Hardcoded `localhost`/`127.0.0.1`/URL audit

Full-repo scan across `apps/*/src` (excluding tests). No unguarded
production-blocking hardcode was found. Everything that references
`localhost`/`127.0.0.1` falls into one of these categories:

- Same-origin URL-parsing base (`new URL(rawUrl, 'http://localhost')` in
  `router.ts`/`server.ts`) — parses a relative incoming request path, not an
  outbound destination.
- Cosmetic startup log lines in `apps/api/src/index.ts` (prints example
  `http://localhost:${port}/...` URLs on boot) — harmless in production
  logs, left as-is since it's diagnostic text, not behavior.
- Mock/seed IP addresses in in-memory governance/security store fixtures
  (`127.0.0.1` as example audit-log data) — not real network calls.
- User-overridable connector/discovery config defaults
  (`connectors-store.ts`, `discovery-adapter.ts`) — a fallback for a value
  the user configures per-connector, not a fixed production endpoint.
- A UI placeholder string in a setup wizard form field
  (`apps/web/.../StepDatabase.tsx`).
- The four API-base-URL env vars (§2), all already gated behind
  `process.env[...] ?? 'http://localhost:3001'` — the fallback only applies
  when the real env var is unset, and every real deploy target (Render,
  Vercel) sets it.

One unrelated, pre-existing constant noted but out of scope:
`apps/runtime-installer/src/wizard/setup-wizard.ts` hardcodes
`https://api.seltriva.com` (the old brand name) as its setup wizard's
suggested API URL default. It isn't `localhost`, doesn't block production,
and isn't part of this task's four in-scope hosts — flagged here for
whoever eventually rebrands the installer, not fixed now.

## 12. Security checklist

- No internal port (Postgres, Redis) is exposed publicly — `docker-compose.yml`'s
  `postgres`/`redis` ports are host-side-only for local dev; Render's
  production deploy doesn't run those containers at all (Render manages
  its own DB, referenced only via the `DATABASE_URL` secret).
- No secret is versioned — all real values live in gitignored `.env`/`.env.local`
  files or Render/Vercel dashboards; `.env.example` files contain only
  placeholder/dev values (confirmed again in this task, no new secret
  added anywhere).
- No inappropriate CORS wildcard in production — `CORS_ALLOWED_ORIGINS` is
  `sync: false` in `render.yaml` (must be explicitly set in the Render
  dashboard); its code-level default (`'*'` when unset) is a pre-existing,
  deliberate dev convenience, not something this task changed. The
  origin-reflection bug fixed in §3 is itself a security-relevant fix — a
  wrong-origin reflection is a masked failure, not a masked success, but
  it's exactly the kind of silent gap this checklist exists to catch.
- HTTP→HTTPS: handled by Render/Vercel at the platform level for every
  existing deployment today; nothing in this repo terminates plain HTTP in
  production.
- Baseline security headers already present and unmodified —
  `apps/api/src/middleware/security-headers.ts` sets
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy`, `Strict-Transport-Security`, and
  `Referrer-Policy` on every response.
- Health/error responses don't leak secrets — `/health`/`/ready` report
  only `ok`/`degraded`/`not_configured` status strings, never the
  `DATABASE_URL` value or other config.

## 13. Tests / TypeScript / ESLint / Build

See the final report for exact command output. Summary: the CORS fix in §3
is covered by a new, passing test file
(`apps/api/src/__tests__/http/cors.test.ts`, 7/7 passing); the full
`apps/api` and monorepo-wide quality gate was re-run after all changes in
this task.

## 14. Deploy status

**NÃO REALIZADO.** No production deploy was performed as part of this
task. All existing deploy targets (Render for `apps/api`, Vercel for the
Next.js apps) are unchanged — this task only prepared documentation,
`.env.example` comments, a CORS correctness fix, and a Dockerfile
healthcheck, all of which take effect on the _next_ deploy through the
existing pipelines, not as a side effect of this task itself.

## 15. Next step

Once `atlasappruntime.com.br` is actually registered: add it as a custom
domain on the `seltriva-api` Render service (§5), create the DNS records
Render provides (§7, replacing the placeholders here with real values), set
`CORS_ALLOWED_ORIGINS` and the four API-base-URL variables (§2, §3) in
their respective dashboards, and re-verify `/health` resolves over the real
domain before pointing any frontend at it.
