# Seltriva Connect

**Enterprise API Platform for Scale, Security, and Reliability**

Seltriva Connect is a modern, enterprise-grade SaaS platform designed to power API management, automation, and integration at scale. Built with cutting-edge technology for security, performance, and developer experience.

## Vision

Build the foundation for a world-class enterprise platform that enables teams to manage, monitor, and scale their API infrastructure with confidence. Seltriva Connect delivers enterprise standards from the ground up.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript Strict, Tailwind CSS
- **Backend**: Node.js, Prisma, Supabase PostgreSQL
- **Monorepo**: Turborepo with pnpm workspaces
- **Quality**: ESLint, Prettier, Husky, Commitlint
- **Infrastructure**: Docker, GitHub Actions, Vercel

## Project Structure

```
seltriva-connect/
├── apps/                    # Applications
│   ├── cloud/              # Main dashboard and management interface
│   ├── api/                # Core backend API services
│   ├── studio/             # Development and testing interface
│   ├── agent/              # Autonomous task processing and automation
│   └── docs/               # Platform documentation
├── packages/               # Shared packages
│   ├── ui/                 # Component library
│   ├── database/           # Prisma ORM layer
│   ├── auth/               # Authentication (Supabase)
│   ├── config/             # Configuration management
│   ├── logger/             # Structured logging
│   ├── types/              # Shared TypeScript types
│   ├── shared/             # Utility functions
│   ├── drivers/            # External integrations
│   ├── sdk/                # Client SDK
│   └── ai/                 # AI/ML utilities
├── docker/                 # Docker configuration
├── scripts/                # Utility scripts
├── docs/                   # Project documentation
├── .github/                # GitHub configuration
│   └── workflows/          # CI/CD workflows
└── [config files]          # Root configuration
```

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.0.0 or higher
- Docker (optional, for local database)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd seltriva-connect

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Set up development database (if using Docker)
docker compose up -d

# Initialize database
pnpm db:generate
pnpm db:push
```

### Development

```bash
# Start all development servers
pnpm dev

# Start specific app
pnpm dev:cloud      # Main dashboard
pnpm dev:api        # Backend API
pnpm dev:studio     # Studio interface
pnpm dev:agent      # Agent service

# Run validation
pnpm validate       # Lint, type-check, format-check
```

### Build

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm build --filter='./apps/cloud'
```

### Quality Assurance

```bash
# Run linter
pnpm lint

# Format code
pnpm format

# Type checking
pnpm type-check

# Run tests
pnpm test

# Full validation
pnpm validate
```

## Architecture Principles

### 1. **Enterprise Standards**
- Strict TypeScript configuration
- Comprehensive error handling
- Security-first approach
- Scalable patterns

### 2. **Code Quality**
- Automated linting and formatting
- Pre-commit hooks via Husky
- Conventional commits
- Type safety

### 3. **Developer Experience**
- Clear folder structure
- Shared configuration
- Turborepo caching
- Hot module reloading

### 4. **Performance**
- Optimized builds
- Code splitting
- Package optimization
- Incremental compilation

## Configuration Files

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- ES2020 target
- Path aliases for imports
- Shared configuration inheritance

### ESLint (`.eslintrc.cjs`)
- Strict TypeScript rules
- Prettier integration
- Turbo-aware linting
- Consistent code style

### Prettier (`.prettierrc.json`)
- 100 character line width
- Single quotes
- Trailing commas
- Tab width: 2

### Tailwind CSS
- Slate color scheme
- Blue accents
- Inter font family
- Professional spacing

## Monorepo Commands

### Development
```bash
pnpm dev              # Start all dev servers
pnpm dev:cloud        # Start cloud app
pnpm dev:api          # Start API server
```

### Building
```bash
pnpm build            # Build all (except docs)
pnpm build:all        # Build including docs
```

### Quality
```bash
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format all files
pnpm format:check     # Check formatting
pnpm type-check       # Run TypeScript checks
pnpm validate         # Full validation
```

### Cleanup
```bash
pnpm clean            # Remove all caches and outputs
```

## Database Management

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

## Git Workflow

### Conventional Commits
This project enforces [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `infra`

### Pre-commit Hooks
Husky automatically:
- Runs ESLint on staged files
- Formats code with Prettier
- Validates commit messages

## Environment Variables

See `.env.example` for required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `API_PORT` - API server port
- `CLOUD_PORT` - Cloud app port
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NODE_ENV` - Environment (development/production)

## CI/CD

GitHub Actions workflows:

- **CI**: Lint, type-check, build, and security audit on push/PR
- **Format**: Auto-fix and commit formatting on push

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [API Reference](./docs/API.md)
- [Package Documentation](./packages/README.md)

## License

MIT

## Support

For issues, questions, or contributions, please refer to [CONTRIBUTING.md](./CONTRIBUTING.md).

---

**Built with enterprise standards for teams that demand excellence.**
