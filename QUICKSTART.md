# Quick Reference

## Essential Commands

### Development
```bash
pnpm dev              # Start all apps
pnpm dev:cloud        # Dashboard only
pnpm dev:api          # API only
pnpm dev:studio       # Studio only
```

### Building
```bash
pnpm build            # Build all apps
pnpm build:all        # Include docs
```

### Quality
```bash
pnpm lint             # Check linting
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format code
pnpm type-check       # TypeScript check
pnpm validate         # Full validation (lint + type-check + format-check)
```

### Database
```bash
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema
pnpm db:studio        # Open Prisma Studio
```

### Cleanup
```bash
pnpm clean            # Remove all caches
```

---

## File Structure Quick Guide

| Path | Purpose |
|------|---------|
| `apps/cloud/` | Main dashboard application |
| `apps/api/` | Backend API server |
| `apps/studio/` | Developer testing interface |
| `apps/agent/` | Automation engine |
| `apps/docs/` | Documentation site |
| `packages/ui/` | React component library |
| `packages/database/` | Prisma ORM layer |
| `packages/types/` | Shared type definitions |
| `packages/config/` | Configuration management |
| `packages/logger/` | Logging utility |
| `docs/` | Project documentation |
| `.github/workflows/` | CI/CD pipelines |

---

## Key Paths & Aliases

```typescript
// Use these import paths
@seltriva/ui          // UI components
@seltriva/types       // Type definitions
@seltriva/logger      // Logging
@seltriva/config      // Configuration
@seltriva/database    // Database ORM
@seltriva/auth        // Authentication
@seltriva/sdk         // API client
@seltriva/shared      // Utilities
@seltriva/drivers     // Integrations
@seltriva/ai          // AI utilities
```

---

## Environment Variables

**Required**
- `DATABASE_URL` - PostgreSQL connection
- `API_SECRET_KEY` - API secret key

**Optional**
- `NODE_ENV` - development/production
- `API_PORT` - API server port (default: 3001)
- `CLOUD_PORT` - Dashboard port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/description

# Make changes
# Validate: pnpm validate

# Commit (conventional)
git commit -m "feat(scope): description"

# Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, infra

# Push and create PR
git push origin feature/description
```

---

## Port Assignments

| Service | Port | URL |
|---------|------|-----|
| Cloud | 3000 | http://localhost:3000 |
| API | 3001 | http://localhost:3001 |
| Studio | 3002 | http://localhost:3002 |
| Agent | 3003 | - |
| Docs | 3004 | http://localhost:3004 |

---

## Recommended VS Code Extensions

- ESLint (linting)
- Prettier (formatting)
- Turbo (monorepo)
- Thunder Client (API testing)

Install recommended: Press `Ctrl+Shift+P` → "Extensions: Show Recommended"

---

## Common Issues & Solutions

### Dependencies not installing
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Port already in use
```bash
# Find process on port
lsof -i :3000
# Kill it
kill -9 <PID>
```

### TypeScript errors persist
```bash
pnpm type-check
pnpm clean
pnpm build
```

### Database connection failed
```bash
# Check .env.local
# Verify DATABASE_URL is correct
# Check docker services: docker compose ps
```

---

## Documentation Map

- **Getting Started**: [README.md](../README.md)
- **Development**: [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)
- **Architecture**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **API Design**: [docs/API.md](../docs/API.md)
- **Decisions**: [docs/DECISIONS.md](../docs/DECISIONS.md)
- **Roadmap**: [docs/ROADMAP.md](../docs/ROADMAP.md)

---

## Useful Links

- Next.js: https://nextjs.org/docs
- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs/
- Prisma: https://www.prisma.io/docs/
- Turbo: https://turbo.build/repo/docs
- Tailwind: https://tailwindcss.com/docs
- ESLint: https://eslint.org/docs/
- Prettier: https://prettier.io/docs/

---

## Quick Setup (First Time)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Edit .env.local with your values

# 4. Generate database client
pnpm db:generate

# 5. Start development
pnpm dev

# 6. Visit http://localhost:3000
```

---

**For more details, see [INITIALIZATION.md](../INITIALIZATION.md)**
