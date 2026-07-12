import type { ChangelogVersion, ChangeEntry, ChangeType } from './types.js';

let _nextId = 1;
function entry(
  type: ChangeType,
  description: string,
  sprint: number,
  component: string
): ChangeEntry {
  return { id: `chg-${String(_nextId++).padStart(4, '0')}`, type, description, sprint, component };
}

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: '0.1.0',
    releasedAt: '2026-06-01T00:00:00Z',
    sprint: 1,
    codename: 'FOUNDATION',
    summary: 'Monorepo foundation — Turborepo, pnpm workspaces, core packages scaffolded.',
    entries: [
      entry('feat', 'Turborepo monorepo with pnpm workspaces', 1, 'infra'),
      entry('feat', 'Core packages: logger, config, types, shared, auth, database', 1, 'packages'),
      entry('infra', 'TypeScript 5.4, Vitest, ESLint configuration', 1, 'tooling'),
    ],
  },
  {
    version: '0.7.0',
    releasedAt: '2026-06-15T00:00:00Z',
    sprint: 7,
    codename: 'RUNTIME',
    summary: 'CRP Runtime Engine — 18-module lifecycle and orchestration system.',
    entries: [
      entry('feat', '18-module Container Runtime Protocol (CRP)', 7, 'packages/runtime'),
      entry(
        'feat',
        'Bootstrap lifecycle management with dependency ordering',
        7,
        'packages/runtime'
      ),
      entry('feat', 'Plugin host with isolation and sandboxing', 7, 'packages/runtime'),
    ],
  },
  {
    version: '0.8.0',
    releasedAt: '2026-06-18T00:00:00Z',
    sprint: 8,
    codename: 'SENTINEL',
    summary: 'Edge Agent — distributed agent with CLI, security, sync, and offline queue.',
    entries: [
      entry('feat', 'Atlas Edge Agent with full lifecycle (16 modules)', 8, 'apps/agent'),
      entry('feat', 'Offline queue with guaranteed delivery', 8, 'apps/agent'),
      entry('feat', 'CLI with install/start/stop/status commands', 8, 'apps/agent'),
    ],
  },
  {
    version: '0.9.0',
    releasedAt: '2026-06-20T00:00:00Z',
    sprint: 9,
    codename: 'ATLAS CLOUD',
    summary: 'Cloud Control Plane — 23 modules, Prisma schema, full provisioning.',
    entries: [
      entry('feat', 'Control Plane with 23 modules and Prisma ORM', 9, 'apps/cloud'),
      entry('feat', 'Agent provisioning and registration API', 9, 'apps/api'),
      entry('feat', 'Multi-tenant organization model', 9, 'apps/api'),
    ],
  },
  {
    version: '0.10.0',
    releasedAt: '2026-06-22T00:00:00Z',
    sprint: 10,
    codename: 'ATLAS FORGE',
    summary: 'Developer Platform — 9 packages, developer portal, plugin SDK.',
    entries: [
      entry('feat', 'Plugin SDK with 12 plugin type interfaces', 10, 'packages/plugin-sdk'),
      entry('feat', 'Atlas CLI (atlas create/build/publish)', 10, 'packages/cli'),
      entry('feat', 'Code generator with 12 built-in templates', 10, 'packages/generator'),
      entry('feat', 'Developer portal (Next.js 15)', 10, 'apps/developer-portal'),
    ],
  },
  {
    version: '0.23.0',
    releasedAt: '2026-07-01T00:00:00Z',
    sprint: 23,
    codename: 'ORION',
    summary: 'First production ERP connector — discovery, mapping, sync, health checks.',
    entries: [
      entry('feat', 'ERP Provider connector with 6 entity types', 23, 'connectors/erp-provider'),
      entry(
        'feat',
        'ConnectorSDK — ConnectorContext, EventBus, Scheduler',
        23,
        'packages/connector-sdk'
      ),
      entry(
        'feat',
        'Semantic entity mapping (ERP→Atlas canonical model)',
        23,
        'connectors/erp-provider'
      ),
    ],
  },
  {
    version: '0.24.0',
    releasedAt: '2026-07-02T00:00:00Z',
    sprint: 24,
    codename: 'HELIX',
    summary: 'Universal Database SDK — 5 drivers, connection pool, query builder.',
    entries: [
      entry(
        'feat',
        'Database SDK with Postgres/MySQL/SQL Server/Oracle/Firebird drivers',
        24,
        'packages/database-sdk'
      ),
      entry('feat', 'Connection pool with retry and timeout', 24, 'packages/database-sdk'),
      entry('feat', 'Fluent query builder with 11 filter operators', 24, 'packages/database-sdk'),
    ],
  },
  {
    version: '0.28.0',
    releasedAt: '2026-07-06T00:00:00Z',
    sprint: 28,
    codename: 'ATLAS HUB',
    summary: 'Admin portal — 10 hub pages, React Query polling, full API routes.',
    entries: [
      entry('feat', 'Admin portal with 10 hub pages (Next.js 15)', 28, 'apps/web'),
      entry('feat', 'Real-time polling with React Query', 28, 'apps/web'),
      entry('feat', 'Hub API routes for connectors, agents, sync', 28, 'apps/api'),
    ],
  },
  {
    version: '0.29.0',
    releasedAt: '2026-07-08T00:00:00Z',
    sprint: 29,
    codename: 'ORCHESTRATOR',
    summary: 'iPaaS Workflow Engine — visual builder, execution engine, DLQ scheduler.',
    entries: [
      entry('feat', 'Visual workflow builder (React Flow)', 29, 'apps/web'),
      entry('feat', 'BFS execution engine with 10 node types', 29, 'apps/api'),
      entry('feat', 'Job queue with DLQ and cron scheduler', 29, 'apps/api'),
    ],
  },
  {
    version: '0.30.0',
    releasedAt: '2026-07-08T00:00:00Z',
    sprint: 30,
    codename: 'OBSERVATORY',
    summary: 'Enterprise observability — 10 features, SSE streaming, SLA monitor.',
    entries: [
      entry('feat', 'Real-time SSE event stream for metrics', 30, 'apps/api'),
      entry('feat', 'SLA Monitor with compliance tracking', 30, 'apps/api'),
      entry('feat', 'Alert Center with 6 notification channels', 30, 'apps/api'),
      entry('feat', '7-day activity heatmaps', 30, 'apps/web'),
    ],
  },
  {
    version: '0.31.0',
    releasedAt: '2026-07-09T00:00:00Z',
    sprint: 31,
    codename: 'AI COPILOT',
    summary: 'Native AI Copilot powered by Claude Opus 4.8 with graceful demo fallback.',
    entries: [
      entry('feat', 'Chat Inteligente with Claude Opus 4.8 streaming', 31, 'apps/api'),
      entry('feat', 'Diagnóstico Automático with severity classification', 31, 'apps/api'),
      entry('feat', 'Geração de Mappings, SQL e Flows via AI', 31, 'apps/api'),
      entry('feat', 'Busca Semântica sobre entidades da plataforma', 31, 'apps/api'),
    ],
  },
  {
    version: '0.32.0',
    releasedAt: '2026-07-09T00:00:00Z',
    sprint: 32,
    codename: 'WORKFLOW BUILDER IA',
    summary: 'Low-code/AI-first iPaaS — NL planner, simulator, versioning, 30 node types.',
    entries: [
      entry('feat', 'NL-to-Workflow planner with Claude Opus 4.8', 32, 'packages/workflow-builder'),
      entry(
        'feat',
        'Workflow simulator (dry-run) for all 30 node types',
        32,
        'packages/workflow-builder'
      ),
      entry('feat', 'Version history with checkpoint and rollback', 32, 'apps/api'),
      entry('feat', '10 seeded workflow templates', 32, 'packages/workflow-builder'),
    ],
  },
  {
    version: '0.33.0',
    releasedAt: '2026-07-09T00:00:00Z',
    sprint: 33,
    codename: 'MARKETPLACE',
    summary: 'Connector Marketplace — discovery, publishing, ratings, install/uninstall.',
    entries: [
      entry('feat', 'Marketplace with connector discovery and search', 33, 'apps/api'),
      entry('feat', 'Publisher portal with connector submission', 33, 'apps/web'),
      entry('feat', 'Rating and review system', 33, 'apps/api'),
      entry('feat', 'Per-tenant installed plugins with version tracking', 33, 'apps/api'),
    ],
  },
  {
    version: '0.34.0',
    releasedAt: '2026-07-10T00:00:00Z',
    sprint: 34,
    codename: 'APOLLO',
    summary: 'Billing & Licensing — Stripe simulation, 3 plans, license keys, MRR/ARR tracking.',
    entries: [
      entry(
        'feat',
        '3-tier SaaS pricing (Community/Professional/Enterprise)',
        34,
        'packages/billing'
      ),
      entry('feat', 'Stripe checkout and customer portal simulation', 34, 'apps/api'),
      entry('feat', 'License key generation with HMAC signature', 34, 'packages/billing'),
      entry('feat', 'AI credit tracking per operation type', 34, 'packages/billing'),
    ],
  },
  {
    version: '0.35.0',
    releasedAt: '2026-07-10T00:00:00Z',
    sprint: 35,
    codename: 'AEGIS',
    summary: 'Security & Compliance — AES-256 encryption, TOTP, RBAC+ABAC, audit chain.',
    entries: [
      entry('feat', 'Envelope encryption (AES-256-GCM) for secrets', 35, 'packages/aegis'),
      entry('feat', 'RFC 6238 TOTP with backup codes', 35, 'packages/aegis'),
      entry('feat', 'RBAC+ABAC policy engine with 8 operators', 35, 'packages/aegis'),
      entry('feat', 'SHA-256 immutable audit chain with SIEM export', 35, 'packages/aegis'),
      entry('security', 'LGPD/GDPR consent management', 35, 'apps/api'),
    ],
  },
  {
    version: '0.36.0',
    releasedAt: '2026-07-10T00:00:00Z',
    sprint: 36,
    codename: 'TITAN',
    summary:
      'Production Hardening — Redis sim, circuit breaker, feature flags, health checks, metrics.',
    entries: [
      entry(
        'feat',
        'In-memory Redis simulation (strings/hashes/lists/sets/pub-sub)',
        36,
        'packages/titan'
      ),
      entry('feat', 'Circuit breaker CLOSED→OPEN→HALF_OPEN state machine', 36, 'packages/titan'),
      entry(
        'feat',
        'Feature flag engine with stable hash rollout and targeting rules',
        36,
        'packages/titan'
      ),
      entry('perf', 'Latency histogram with P50/P95/P99 percentiles', 36, 'packages/titan'),
      entry('infra', 'Kubernetes HPA, rolling update, PodDisruptionBudget', 36, 'infra/kubernetes'),
      entry('infra', 'k6 load tests: smoke/load/stress/endurance', 36, 'load-tests'),
    ],
  },
  {
    version: '1.0.0',
    releasedAt: '2026-07-10T00:00:00Z',
    sprint: 37,
    codename: 'ODYSSEY',
    summary: 'General Availability — Release certification, customer portal, go-live dashboard.',
    entries: [
      entry('feat', 'GA Release certification with 40-item checklist', 37, 'packages/release'),
      entry('feat', 'Customer self-service portal (API keys, support, users)', 37, 'apps/web'),
      entry('feat', 'Go-Live command center with real-time KPIs', 37, 'apps/web'),
      entry('feat', 'Atlas Academy training portal', 37, 'apps/web'),
      entry('feat', 'atlasctl — operational CLI for cluster management', 37, 'packages/atlasctl'),
      entry('docs', 'Full technical and product documentation', 37, 'docs'),
      entry('infra', 'SBOM generation for all 37 workspace packages', 37, 'packages/release'),
    ],
  },
];

export class ChangelogManager {
  constructor(private readonly versions: ChangelogVersion[] = CHANGELOG) {}

  list(): ChangelogVersion[] {
    return [...this.versions].sort((a, b) => b.sprint - a.sprint);
  }

  get(version: string): ChangelogVersion | undefined {
    return this.versions.find((v) => v.version === version);
  }

  getBySprint(sprint: number): ChangelogVersion | undefined {
    return this.versions.find((v) => v.sprint === sprint);
  }

  getLatest(): ChangelogVersion {
    return this.list()[0]!;
  }

  search(query: string): ChangelogVersion[] {
    const q = query.toLowerCase();
    return this.versions.filter(
      (v) =>
        v.codename.toLowerCase().includes(q) ||
        v.summary.toLowerCase().includes(q) ||
        v.entries.some(
          (e) => e.description.toLowerCase().includes(q) || e.component.toLowerCase().includes(q)
        )
    );
  }

  entriesByType(type: string): ChangeEntry[] {
    return this.versions.flatMap((v) => v.entries).filter((e) => e.type === type);
  }
}

export const changelogManager = new ChangelogManager();
