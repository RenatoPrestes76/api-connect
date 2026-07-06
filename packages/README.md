# Packages Overview

This directory contains all shared packages that power Seltriva Connect applications.

## Package Directory

### Core Packages

#### [`types`](./types/)
Shared TypeScript type definitions and interfaces used across the platform.

#### [`config`](./config/)
Environment configuration and settings management with validation.

#### [`logger`](./logger/)
Structured JSON logging utility for consistent logging across services.

#### [`shared`](./shared/)
Common utility functions and helpers (string, array, async utilities).

### Data & Integration Packages

#### [`database`](./database/)
Prisma ORM layer for PostgreSQL database access and schema management.

#### [`auth`](./auth/)
Supabase authentication and authorization implementation.

#### [`drivers`](./drivers/)
External service integrations and third-party connectors.

#### [`ai`](./ai/)
AI/ML integrations and LLM utilities.

### Client & UI Packages

#### [`sdk`](./sdk/)
Client library for Seltriva Connect API integration.

#### [`ui`](./ui/)
React component library built on Radix UI and Tailwind CSS.

## Package Dependencies

```
Consumers (Apps)
    ↓
┌───────────────────────┐
│  UI Layer (ui)        │ ← Used by: cloud, studio, docs
└───────────────────────┘
    ↓
┌──────────────────────────────────────────────┐
│  Integration & Business Logic                │
│  ├─ Database (database) ← api, agent        │
│  ├─ Auth (auth) ← cloud, api, studio        │
│  ├─ SDK (sdk) ← cloud, studio               │
│  ├─ Drivers (drivers) ← api, agent          │
│  └─ AI (ai) ← agent, api                    │
└──────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────┐
│  Foundation Packages                          │
│  ├─ Types (types) ← all packages            │
│  ├─ Logger (logger) ← all packages          │
│  ├─ Config (config) ← all packages          │
│  └─ Shared (shared) ← all packages          │
└──────────────────────────────────────────────┘
```

## Using Packages

### Installing from Packages

All packages are workspace dependencies:

```json
{
  "dependencies": {
    "@seltriva/ui": "workspace:*",
    "@seltriva/logger": "workspace:*"
  }
}
```

### Importing from Packages

```typescript
// ✅ Correct
import { Button } from '@seltriva/ui';
import { createLogger } from '@seltriva/logger';
import type { User } from '@seltriva/types';

// ❌ Avoid
import Button from '@seltriva/ui/src/components/Button';
```

## Adding a New Package

1. Create directory: `mkdir packages/new-package`
2. Create `package.json` from template
3. Create `tsconfig.json` extending root
4. Create `src/index.ts` entry point
5. Update root dependencies if needed

## Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build --filter @seltriva/package-name

# Build with dependencies
pnpm build --filter @seltriva/package-name...
```

## Documentation

Each package should include:
- Clear purpose statement
- Main exports
- Usage examples
- Dependencies
- Configuration notes

## Package Boundaries

- **No circular dependencies**: Use dependency injection
- **Clear responsibilities**: Each package has one main purpose
- **Type safety**: Export types from index.ts
- **Minimal exports**: Only expose necessary APIs
