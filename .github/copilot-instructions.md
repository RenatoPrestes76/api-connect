# .github/copilot-instructions.md

This file provides workspace-specific instructions to GitHub Copilot for working with Seltriva Connect.

## Project Context

**Seltriva Connect** is an enterprise-grade API platform built with:

- Monorepo: Turborepo + pnpm workspaces
- Frontend: Next.js 15, React 19
- Backend: Node.js
- Database: Prisma + Supabase PostgreSQL
- Styling: Tailwind CSS + shadcn/ui
- Quality: ESLint, Prettier, TypeScript strict mode

## Code Style Guidelines

### TypeScript

- Always use strict mode types
- No `any` types without documentation
- Export types from package index
- Use path aliases for imports
- Explicit return types for functions

### React Components

```typescript
interface ComponentProps {
  // Props here
}

export const Component: FC<ComponentProps> = ({ prop }) => {
  return <div>{prop}</div>;
};

export type { ComponentProps };
```

### Imports

```typescript
// ✅ Use path aliases
import { Button } from '@seltriva/ui';
import { logger } from '@seltriva/logger';

// ❌ Avoid relative paths
import { Button } from '../../../ui/components/Button';
```

## Naming Conventions

- Files: PascalCase for components, camelCase for utilities
- Functions: camelCase
- Types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Directories: kebab-case

## Package Structure

```
packages/{name}/
├── src/
│   ├── index.ts        # Main export
│   ├── components/     # React components (UI only)
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   └── types/          # Type definitions
├── package.json
├── tsconfig.json
└── README.md
```

## Common Tasks

### Creating a New Component

- Place in appropriate package
- Include props interface
- Export component and types
- Add documentation comments
- Follow component template

### Adding Dependencies

- Use `pnpm add` for workspace packages
- Prefer peer dependencies for UI packages
- Document why dependency is needed
- Keep dependencies minimal

### Environment Variables

- Define in `.env.example`
- Validate in `@seltriva/config`
- Use environment variables for secrets
- Never commit `.env.local`

## Git Workflow

- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
- Reference issues in commits: `fix: description (#123)`
- Keep commits focused and atomic
- Write clear commit messages

## Testing

- Unit tests in `__tests__` folders
- Integration tests for API endpoints
- Test files match source files
- Aim for 80%+ coverage

## Documentation

- Update README when adding features
- Document complex logic with comments
- Keep architecture docs current
- Add examples for public APIs

## Performance

- Minimize bundle size
- Use React.memo for expensive components
- Optimize database queries
- Cache when appropriate

## Security

- Never commit secrets
- Validate all user input
- Use environment variables for sensitive data
- Follow OWASP guidelines

## Helpful Links

- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Development Guide](../../docs/DEVELOPMENT.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
