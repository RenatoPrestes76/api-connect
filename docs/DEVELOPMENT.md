# Development Guide

## Environment Setup

### Prerequisites

- Node.js 20.x or higher ([Download](https://nodejs.org/))
- pnpm 9.0.0 or higher ([Install](https://pnpm.io/installation))
- Git ([Download](https://git-scm.com/))
- Docker & Docker Compose (optional, for local database)

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd seltriva-connect

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.example .env.local

# 4. Start Docker services (if using local database)
docker compose up -d

# 5. Initialize database
pnpm db:generate
pnpm db:push

# 6. Start development servers
pnpm dev
```

## Development Commands

### Running Applications

```bash
# Start all development servers
pnpm dev

# Start specific application
pnpm dev:cloud          # Main dashboard (port 3000)
pnpm dev:api            # Backend API (port 3001)
pnpm dev:studio         # Studio interface (port 3002)
pnpm dev:agent          # Agent service (port 3003)
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build with cache output
pnpm build --verbose

# Build specific workspace
pnpm build --filter @seltriva/ui
```

### Code Quality

```bash
# Lint all code
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting (CI mode)
pnpm format:check

# Run TypeScript type check
pnpm type-check

# Full validation (lint + type-check + format-check)
pnpm validate
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Run tests for specific package
pnpm test --filter @seltriva/logger
```

### Database

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Prisma Studio (interactive editor)
pnpm db:studio

# Create migration
pnpm db:create-migration --name add_users_table
```

### Cleanup

```bash
# Clean all build artifacts and caches
pnpm clean

# Clean specific workspace
pnpm clean --filter @seltriva/ui
```

## IDE Setup

### Visual Studio Code

**Recommended Extensions:**

- ES7+ React/Redux/React-Native snippets
- TypeScript Vue Plugin
- Prettier - Code formatter
- ESLint
- Turbo
- Thunder Client / REST Client

**Settings (`settings.json`):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.enablePromptUseWorkspaceTypesForJsFiles": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## File Structure Best Practices

### Creating a New Component

```
packages/ui/src/
├── components/
│   └── MyComponent/
│       ├── index.ts
│       ├── MyComponent.tsx
│       ├── MyComponent.stories.tsx
│       └── MyComponent.test.tsx
└── index.ts
```

### Creating a New API Route

```
apps/api/src/
├── routes/
│   ├── users.ts
│   └── posts.ts
├── middleware/
│   └── auth.ts
└── index.ts
```

### Creating a New Package

```
packages/new-package/
├── src/
│   ├── index.ts
│   └── [implementation]
├── package.json
├── tsconfig.json
└── README.md
```

## Git Workflow

### Branch Naming

```
feature/add-authentication
fix/resolve-race-condition
docs/update-readme
refactor/simplify-api
test/add-unit-tests
chore/update-dependencies
```

### Commits

```bash
# Create a commit (Husky will validate)
git add .
git commit -m "feat(auth): add OAuth2 integration"

# If pre-commit hooks fail:
git commit -m "message" --no-verify  # Not recommended
# Instead: Fix the issues and try again
```

### Pull Requests

```bash
# Create a branch
git checkout -b feature/my-feature

# Make changes
git add .
git commit -m "feat(feature): description"

# Push and create PR
git push origin feature/my-feature
```

## TypeScript Guidelines

### Strict Mode

All code uses TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Type Safety Rules

```typescript
// ✅ Good: Explicit types
function getUserById(id: string): Promise<User | null> {
  // ...
}

// ❌ Bad: Missing types
function getUserById(id) {
  // ...
}

// ✅ Good: No `any`
const data: Record<string, unknown> = {};

// ❌ Bad: Avoid `any`
const data: any = {};
```

### Path Aliases

Use configured path aliases for imports:

```typescript
// ✅ Good
import { Button } from '@seltriva/ui';
import { logger } from '@seltriva/logger';
import { User } from '@seltriva/types';

// ❌ Bad
import { Button } from '../../../../packages/ui/src';
```

## React Components

### Component Structure

```typescript
import type { FC, PropsWithChildren } from 'react';

interface ButtonProps extends PropsWithChildren {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children
}) => {
  return (
    <button className={`btn btn-${variant} btn-${size}`} disabled={disabled}>
      {children}
    </button>
  );
};

export { Button };
export type { ButtonProps };
```

### Hooks

```typescript
// ✅ Good: Custom hook with clear purpose
function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // ...
  }, [userId]);

  return { user, loading, error };
}
```

## Environment Variables

### Loading Variables

```typescript
// packages/config/src/env.ts
export const env = {
  database: {
    url: process.env.DATABASE_URL || '',
  },
  api: {
    port: parseInt(process.env.API_PORT || '3001', 10),
    secret: process.env.API_SECRET_KEY || '',
  },
} as const;

// Validate on startup
if (!env.database.url) {
  throw new Error('DATABASE_URL is required');
}
```

## Debugging

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "API",
      "program": "${workspaceFolder}/apps/api/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"]
    }
  ]
}
```

### Logging

```typescript
import { logger } from '@seltriva/logger';

logger.info('Processing user', { userId: '123' });
logger.error('Database error', { error: new Error('Connection failed') });
logger.debug('Query executed', { query: 'SELECT * FROM users' });
```

## Performance Tips

### Build Optimization

```bash
# Analyze bundle size
pnpm build -- --analyze

# Check build performance
pnpm build -- --verbose
```

### Development

- Use dev mode for faster iteration
- Only rebuild changed packages
- Leverage TypeScript incremental compilation
- Use appropriate database indexes

## Common Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Dependencies Not Installing

```bash
# Clear pnpm store
pnpm store prune

# Reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

```bash
# Rebuild TypeScript
pnpm type-check

# Clear cache
pnpm clean

# Restart TypeScript server in IDE
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Getting Help

1. Check existing documentation
2. Search codebase for similar implementations
3. Review pull request comments for context
4. Ask in team channels or issues
