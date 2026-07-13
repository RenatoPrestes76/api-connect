# Architecture Guide

## System Overview

Seltriva Connect is built as a modern, scalable enterprise platform using a monorepo architecture. This document outlines the system design, component relationships, and architectural decisions.

## Core Architecture

### Monorepo Structure

The project is organized as a Turborepo with pnpm workspaces:

```
Apps (User-facing applications)
├── Cloud (Dashboard & Management)
├── API (Backend Services)
├── Studio (Developer Interface)
├── Agent (Automation Engine)
└── Docs (Documentation)

Packages (Shared Libraries)
├── UI (Component Library)
├── Database (Prisma ORM)
├── Auth (Supabase)
├── Config (Configuration)
├── Logger (Logging)
├── Types (Shared Types)
├── Shared (Utilities)
├── Drivers (Integrations)
├── SDK (Client Library)
└── AI (ML/AI Tools)
```

### Technology Stack

| Layer        | Technology              | Purpose                   |
| ------------ | ----------------------- | ------------------------- |
| **Frontend** | Next.js 15, React 19    | Server-rendered UIs       |
| **Styling**  | Tailwind CSS, shadcn/ui | Enterprise UI components  |
| **Backend**  | Node.js, Express        | API services              |
| **Database** | Supabase, PostgreSQL    | Data persistence          |
| **ORM**      | Prisma                  | Type-safe database access |
| **Auth**     | Supabase Auth           | Authentication            |
| **Build**    | Turborepo, pnpm         | Monorepo management       |
| **DevOps**   | Docker, GitHub Actions  | Deployment & CI/CD        |

## Package Organization

### Apps

#### Cloud (`apps/cloud`)

- **Purpose**: Main dashboard and management interface
- **Technology**: Next.js, React
- **Dependencies**: ui, types, config, logger
- **Port**: 3000 (development)

#### API (`apps/api`)

- **Purpose**: Core backend API services
- **Technology**: Node.js
- **Dependencies**: database, types, logger, config
- **Port**: 3001 (development)

#### Studio (`apps/studio`)

- **Purpose**: Development and testing interface
- **Technology**: Next.js, React
- **Dependencies**: ui, types, config, sdk
- **Port**: 3002 (development)

#### Agent (`apps/agent`)

- **Purpose**: Autonomous task processing and workflow automation
- **Technology**: Node.js
- **Dependencies**: database, types, ai, logger, config
- **Port**: 3003 (development)

#### Docs (`apps/docs`)

- **Purpose**: Platform documentation and guides
- **Technology**: Next.js, React
- **Dependencies**: ui
- **Port**: 3004 (development)

### Packages

#### UI (`packages/ui`)

- **Purpose**: Reusable React component library
- **Foundation**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Exports**: Components, hooks, utilities
- **Consumers**: All apps

#### Database (`packages/database`)

- **Purpose**: Data layer with Prisma ORM
- **Responsibilities**: Schema management, migrations, client
- **Prisma Schema**: `prisma/schema.prisma`
- **Consumers**: API, Agent

#### Auth (`packages/auth`)

- **Purpose**: Authentication and authorization
- **Provider**: Supabase
- **Responsibilities**: User auth, session management
- **Consumers**: Cloud, API, Studio

#### Config (`packages/config`)

- **Purpose**: Environment and configuration management
- **Responsibilities**: Env validation, config loading
- **Consumers**: All packages

#### Logger (`packages/logger`)

- **Purpose**: Structured logging utility
- **Responsibilities**: Log formatting, levels, outputs
- **Consumers**: All packages

#### Types (`packages/types`)

- **Purpose**: Shared TypeScript type definitions
- **Responsibilities**: Domain types, interfaces, enums
- **Consumers**: All packages

#### Shared (`packages/shared`)

- **Purpose**: Utility functions and helpers
- **Responsibilities**: Common functions, validators
- **Consumers**: All packages

#### Drivers (`packages/drivers`)

- **Purpose**: External service integrations
- **Responsibilities**: Provider integrations, connectors
- **Consumers**: API, Agent

#### SDK (`packages/sdk`)

- **Purpose**: Client library for API integration
- **Responsibilities**: API client, types, utilities
- **Consumers**: Cloud, Studio

#### AI (`packages/ai`)

- **Purpose**: AI/ML integrations and utilities
- **Responsibilities**: LLM integration, processing
- **Consumers**: Agent, API

## Data Flow

### Request Flow (Cloud App)

```
User Request
    ↓
Next.js App (Cloud)
    ↓
API Handler / Server Component
    ↓
SDK Client
    ↓
API Backend (apps/api)
    ↓
Database Layer (Prisma)
    ↓
PostgreSQL (Supabase)
```

### Background Processing

```
Triggered Event
    ↓
Queue / Event Emitter
    ↓
Agent Service (apps/agent)
    ↓
AI Processing (packages/ai)
    ↓
Database Update
    ↓
Cache Invalidation
```

## Dependency Management

### Workspace Dependencies

Apps and packages depend on shared libraries using workspace protocol:

```json
{
  "dependencies": {
    "@seltriva/types": "workspace:*",
    "@seltriva/logger": "workspace:*"
  }
}
```

### Dependency Rules

1. **No circular dependencies** - Use dependency injection
2. **Unidirectional** - Inner packages don't depend on outer apps
3. **Clear boundaries** - Respect package responsibilities
4. **Type safety** - Always import from packages, not internal files

## Build Process

### Development

```
pnpm dev
    ↓
Turborepo watches all packages
    ↓
Hot Module Reloading (HMR) per app
    ↓
Incremental compilation
```

### Production Build

```
pnpm build
    ↓
Dependency graph analysis
    ↓
Parallel compilation
    ↓
Optimization and minification
    ↓
Artifact output to dist/
```

## Configuration Hierarchy

### TypeScript (`tsconfig.json`)

- Root configuration with strict mode
- App/package configs extend root
- Path aliases for imports

### ESLint (`.eslintrc.cjs`)

- Shared rules at root
- Overrides per file type
- Turbo-aware linting

### Prettier (`.prettierrc.json`)

- Single format config
- Applied across all files
- Integrated with ESLint

## Database Schema

### Prisma Setup

- Schema file: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations/`
- Client generation: `pnpm db:generate`
- Schema push: `pnpm db:push`

### Database Provider

- PostgreSQL via Supabase
- Connection: `DATABASE_URL` env variable
- Automatic client generation

## CI/CD Pipeline

### GitHub Actions

#### CI Workflow (`.github/workflows/ci.yml`)

- Triggers on push and PR
- Runs lint, type-check, build
- Runs security audit
- Caches dependencies

#### Format Workflow (`.github/workflows/format.yml`)

- Auto-fixes code style
- Commits formatting changes
- Runs on main branch

## Error Handling

### Logging Strategy

- Structured JSON logs
- Log levels: debug, info, warn, error
- Context and stack traces
- Performance metrics

### Error Recovery

- Graceful degradation
- Retry mechanisms
- Fallback handlers
- User-friendly messages

## Performance Optimization

### Build Optimization

- Code splitting
- Tree shaking
- Minification
- Compression

### Runtime Optimization

- Caching strategy
- Database query optimization
- Component memoization
- Lazy loading

## Security Considerations

### API Security

- Authentication required
- Authorization checks
- Input validation
- Rate limiting

### Data Security

- Encrypted connections
- Environment variable secrets
- No credentials in code
- Audit logging

## Testing Strategy

### Unit Tests

- Located near implementation
- Run with `pnpm test`
- Minimum 80% coverage target

### Integration Tests

- API endpoint testing
- Database integration
- External service mocking

### E2E Tests

- User workflow testing
- Cross-browser compatibility
- Performance testing

## Deployment Architecture

### Services

| Service  | Technology | Environment |
| -------- | ---------- | ----------- |
| Cloud    | Vercel     | Serverless  |
| API      | Docker     | Container   |
| Agent    | Docker     | Container   |
| Database | Supabase   | Managed     |
| Cache    | Redis      | Optional    |

## Future Considerations

- Microservices decomposition
- GraphQL API layer
- Real-time features (WebSocket)
- Event streaming
- Multi-region deployment
