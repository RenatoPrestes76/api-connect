# Deploying to Vercel

Scope: the 6 Next.js apps in this monorepo — `admin`, `cloud`, `developer-portal`,
`docs`, `studio`, `web`. `apps/api` is **not** covered here: it's a persistent
Node process (WebSocket hub, leader-election/autoscaler/secret-rotation
background loops, in-memory state) and is architecturally incompatible with
Vercel's serverless model. It keeps running from the Docker image built by
`docker/Dockerfile.api`.

Current status:

| App                | Status                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`            | Ready                                                                                                                                                                            |
| `cloud`            | Ready                                                                                                                                                                            |
| `docs`             | Ready                                                                                                                                                                            |
| `studio`           | Ready                                                                                                                                                                            |
| `web`              | Ready                                                                                                                                                                            |
| `developer-portal` | Not deployable yet — no `app/`/`pages/` directory exists (only domain logic was built). Its `vercel.json`/`next.config.ts` are already prepared; add pages and it's ready to go. |

## One-time setup per app (Vercel dashboard)

Each app is deployed as its own **Vercel Project**, all pointed at this same
GitHub repo:

1. **New Project → Import** this repository.
2. **Root Directory**: set to the app's folder, e.g. `apps/web`, `apps/cloud`.
   Vercel detects the Next.js framework automatically once Root Directory is set.
3. **Build & Install Commands**: leave on "Framework Default" — each app ships
   its own `vercel.json` (e.g. [`apps/web/vercel.json`](../apps/web/vercel.json))
   that already overrides these to run through Turborepo from the repo root:
   ```json
   {
     "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
     "buildCommand": "cd ../.. && npx turbo run build --filter=@seltriva/web",
     "ignoreCommand": "npx turbo-ignore"
   }
   ```
   `ignoreCommand` uses [turbo-ignore](https://www.npmjs.com/package/turbo-ignore)
   so a push that doesn't touch this app's dependency graph skips the build
   entirely — necessary since 5+ Vercel projects share one repo.
4. **Environment Variables**: see per-app tables below. Set for all
   environments (Production/Preview/Development) unless noted otherwise.
5. Repeat for each app, using a distinct Root Directory each time.

## Environment variables

### apps/admin

| Variable                       | Required    | Notes                                                                                                                     |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_API_URL`                | Recommended | Base URL of the deployed `apps/api` instance. Server-side only (Next.js API routes), defaults to `http://localhost:3001`. |
| `NEXT_PUBLIC_ADMIN_API_WS_URL` | Recommended | WebSocket URL of `apps/api`'s live-updates hub, exposed to the browser. Defaults to `ws://localhost:3001`.                |

### apps/cloud

| Variable                    | Required    | Notes                                                                                                                                                                                     |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Yes         | Prisma pooled connection string (e.g. Supabase pgbouncer endpoint). Not needed for the build itself (`prisma generate` doesn't read it), but required at runtime for any DB-backed route. |
| `DIRECT_URL`                | Yes         | Prisma direct (non-pooled) connection string, used for migrations.                                                                                                                        |
| `NEXT_PUBLIC_ATLAS_API_URL` | Recommended | Base URL of the deployed `apps/api` instance, exposed to the browser. Defaults to `http://localhost:3001`.                                                                                |

`apps/cloud/package.json` has a `postinstall: "prisma generate"` script so the
Prisma client is generated automatically during Vercel's install step.

### apps/docs / apps/studio

No environment variables required — both are currently minimal placeholder
apps (single landing page).

### apps/web

| Variable                     | Required    | Notes                                                                                                               |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_HUB_API_URL`    | Recommended | Base URL of the deployed `apps/api` instance, exposed to the browser. Defaults to `http://localhost:3001`.          |
| `NEXT_PUBLIC_ANTHROPIC_MODE` | Optional    | Set to `live` to enable the Copilot panel's real Anthropic integration; any other value (or unset) shows demo mode. |

See each app's `.env.example` for the full list with local-dev defaults.

## Verifying a build locally before deploying

```bash
npx turbo run build --filter=@seltriva/<app-name>
```

This runs the exact same Turborepo build graph Vercel will run (build the
app's workspace dependencies first, then `next build`). All 5 ready apps
currently pass this cleanly.

## Known deliberate build settings

- `apps/admin`, `apps/cloud`, `apps/web` set `eslint.ignoreDuringBuilds: true`
  in `next.config.ts` — their `src/` predates the shared root `.eslintrc.cjs`
  being wired up and hasn't been fully brought into compliance yet. `pnpm lint`
  still runs against each app's source separately in CI; it just doesn't gate
  the production build. `apps/docs`/`apps/studio` don't need this yet since
  their placeholder pages already pass lint.
