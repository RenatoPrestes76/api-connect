import { CircuitBreakerRegistry } from '@seltriva/titan';
import type { FeatureFlag } from '@seltriva/titan';

// ─── Types ────────────────────────────────────────────────────────────────────
export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

export interface Job {
  id: string;
  type: string;
  priority: JobPriority;
  payload: Record<string, unknown>;
  tenantId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey?: string;
  createdAt: string;
  scheduledAt: string;
  processedAt: string | null;
  failedAt: string | null;
  error: string | null;
}

export interface SloDefinition {
  id: string;
  name: string;
  metric: string;
  target: number;
  unit: string;
  current: number;
  status: 'compliant' | 'warning' | 'breached';
  errorBudgetPercent: number;
  windowDays: number;
  description: string;
}

export interface Backup {
  id: string;
  type: 'full' | 'incremental' | 'snapshot';
  status: 'pending' | 'running' | 'completed' | 'failed';
  sizeBytes: number;
  region: string;
  startedAt: string;
  completedAt: string | null;
  pitrEnabled: boolean;
}

export interface DrTest {
  id: string;
  type: 'failover' | 'restore' | 'partial';
  status: 'passed' | 'failed' | 'in_progress';
  rtoActual: number | null;
  rpoActual: number | null;
  notes: string;
  executedAt: string;
}

export interface DrConfig {
  rto: number;
  rpo: number;
  primaryRegion: string;
  secondaryRegion: string | null;
  backupSchedule: 'hourly' | 'daily' | 'weekly';
  autoBackup: boolean;
  crossRegionReplication: boolean;
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

class TitanStore {
  private jobQueues: Map<JobPriority, Job[]> = new Map([
    ['high', []],
    ['normal', []],
    ['low', []],
  ]);
  private dlq: Job[] = [];
  private jobIndex = new Map<string, Job>();
  private idempotencyIndex = new Map<string, string>();

  private flags = new Map<string, FeatureFlag>();
  private slos = new Map<string, SloDefinition>();
  private backups: Backup[] = [];
  private drTests: DrTest[] = [];
  private drConfig: DrConfig;

  readonly circuits: CircuitBreakerRegistry;

  constructor() {
    this.circuits = new CircuitBreakerRegistry();
    this.seed();
  }

  private seed() {
    this.seedCircuits();
    this.seedFlags();
    this.seedQueues();
    this.seedSlos();
    this.seedDr();
  }

  private seedCircuits() {
    const services = [
      { name: 'api-gateway', threshold: 10 },
      { name: 'database', threshold: 5 },
      { name: 'redis-cache', threshold: 8 },
      { name: 'external-erp', threshold: 3 },
      { name: 'ai-service', threshold: 5 },
    ];
    for (const svc of services) {
      this.circuits.register(svc.name, { failureThreshold: svc.threshold, timeout: 30_000 });
    }
  }

  private seedFlags() {
    const now = '2026-07-01T00:00:00Z';
    const flags: FeatureFlag[] = [
      {
        id: 'ff-001',
        name: 'Multi-Tenant AI',
        key: 'multi-tenant-ai',
        description: 'Enables AI inference per tenant with isolated context windows.',
        enabled: true,
        rolloutPercentage: 100,
        targetingRules: [],
        variants: [],
        defaultVariant: 'enabled',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
      },
      {
        id: 'ff-002',
        name: 'Advanced Analytics v2',
        key: 'advanced-analytics-v2',
        description: 'A/B test for new analytics dashboard with cohort analysis.',
        enabled: true,
        rolloutPercentage: 50,
        targetingRules: [],
        variants: [
          { id: 'v1', key: 'control', description: 'Current analytics', weight: 50 },
          { id: 'v2', key: 'treatment', description: 'New analytics v2', weight: 50 },
        ],
        defaultVariant: 'control',
        createdAt: now,
        updatedAt: now,
        createdBy: 'product-team',
      },
      {
        id: 'ff-003',
        name: 'Beta Workflow Builder',
        key: 'beta-workflow-builder',
        description: 'Early access to redesigned workflow builder with AI suggestions.',
        enabled: true,
        rolloutPercentage: 0,
        targetingRules: [
          {
            id: 'r1',
            attribute: 'plan',
            operator: 'in',
            values: ['enterprise', 'professional'],
            variant: 'beta',
          },
        ],
        variants: [],
        defaultVariant: 'beta',
        createdAt: now,
        updatedAt: now,
        createdBy: 'engineering',
      },
      {
        id: 'ff-004',
        name: 'Dark Mode (System)',
        key: 'dark-mode',
        description: 'Enables dark mode system-wide.',
        enabled: true,
        rolloutPercentage: 100,
        targetingRules: [],
        variants: [],
        defaultVariant: 'enabled',
        createdAt: now,
        updatedAt: now,
        createdBy: 'design',
      },
      {
        id: 'ff-005',
        name: 'Experimental Connectors',
        key: 'experimental-connectors',
        description: 'Unstable pre-release connectors for SAP HANA and Oracle Fusion.',
        enabled: false,
        rolloutPercentage: 0,
        targetingRules: [],
        variants: [],
        defaultVariant: 'disabled',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
      },
    ];
    for (const flag of flags) this.flags.set(flag.id, flag);
  }

  private seedQueues() {
    const types: Array<{ type: string; priority: JobPriority; tenant: string }> = [
      { type: 'workflow_execute', priority: 'high', tenant: 'tenant-enterprise' },
      { type: 'workflow_execute', priority: 'high', tenant: 'tenant-professional' },
      { type: 'connector_sync', priority: 'high', tenant: 'tenant-enterprise' },
      { type: 'connector_sync', priority: 'normal', tenant: 'tenant-enterprise' },
      { type: 'notification_send', priority: 'normal', tenant: 'tenant-professional' },
      { type: 'notification_send', priority: 'normal', tenant: 'tenant-community' },
      { type: 'audit_export', priority: 'normal', tenant: 'tenant-enterprise' },
      { type: 'batch_report', priority: 'low', tenant: 'tenant-enterprise' },
      { type: 'ai_generate', priority: 'low', tenant: 'tenant-professional' },
      { type: 'data_cleanup', priority: 'low', tenant: 'tenant-community' },
    ];
    const ts = new Date().toISOString();
    for (const t of types) {
      const job: Job = {
        id: uid('job'),
        type: t.type,
        priority: t.priority,
        payload: {},
        tenantId: t.tenant,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: ts,
        scheduledAt: ts,
        processedAt: null,
        failedAt: null,
        error: null,
      };
      this.jobQueues.get(t.priority)!.push(job);
      this.jobIndex.set(job.id, job);
    }

    // Seed DLQ with 2 dead jobs
    for (const type of ['ai_generate', 'connector_sync']) {
      const dead: Job = {
        id: uid('job'),
        type,
        priority: 'normal',
        payload: {},
        tenantId: 'tenant-enterprise',
        status: 'dead',
        attempts: 3,
        maxAttempts: 3,
        createdAt: ts,
        scheduledAt: ts,
        processedAt: null,
        failedAt: ts,
        error: 'Max retries exceeded',
      };
      this.dlq.push(dead);
      this.jobIndex.set(dead.id, dead);
    }
  }

  private seedSlos() {
    const slos: SloDefinition[] = [
      {
        id: 'slo-001',
        name: 'API Availability',
        metric: 'uptime_percent',
        target: 99.9,
        unit: '%',
        current: 99.95,
        status: 'compliant',
        errorBudgetPercent: 82,
        windowDays: 30,
        description: '30-day rolling availability for all API endpoints',
      },
      {
        id: 'slo-002',
        name: 'API Latency P95',
        metric: 'latency_p95_ms',
        target: 300,
        unit: 'ms',
        current: 187,
        status: 'compliant',
        errorBudgetPercent: 91,
        windowDays: 7,
        description: '7-day P95 response time for API gateway',
      },
      {
        id: 'slo-003',
        name: 'Workflow Success Rate',
        metric: 'workflow_success_rate',
        target: 99.0,
        unit: '%',
        current: 99.2,
        status: 'compliant',
        errorBudgetPercent: 75,
        windowDays: 7,
        description: 'Percentage of workflow executions that complete successfully',
      },
      {
        id: 'slo-004',
        name: 'Error Rate',
        metric: 'error_rate_percent',
        target: 0.1,
        unit: '%',
        current: 0.08,
        status: 'compliant',
        errorBudgetPercent: 60,
        windowDays: 7,
        description: 'Global API error rate (5xx responses)',
      },
      {
        id: 'slo-005',
        name: 'Queue Processing P95',
        metric: 'queue_processing_p95_sec',
        target: 30,
        unit: 's',
        current: 28,
        status: 'warning',
        errorBudgetPercent: 18,
        windowDays: 1,
        description: 'P95 time for jobs to be picked up and processed from queue',
      },
    ];
    for (const slo of slos) this.slos.set(slo.id, slo);
  }

  private seedDr() {
    this.drConfig = {
      rto: 15,
      rpo: 5,
      primaryRegion: 'us-east-1',
      secondaryRegion: 'us-west-2',
      backupSchedule: 'hourly',
      autoBackup: true,
      crossRegionReplication: true,
    };

    const now = new Date();
    const backups: Backup[] = [
      {
        id: 'bkp-001',
        type: 'full',
        status: 'completed',
        sizeBytes: 4_200_000_000,
        region: 'us-east-1',
        startedAt: new Date(now.getTime() - 6 * 3600_000).toISOString(),
        completedAt: new Date(now.getTime() - 6 * 3600_000 + 8 * 60_000).toISOString(),
        pitrEnabled: true,
      },
      {
        id: 'bkp-002',
        type: 'incremental',
        status: 'completed',
        sizeBytes: 180_000_000,
        region: 'us-east-1',
        startedAt: new Date(now.getTime() - 1 * 3600_000).toISOString(),
        completedAt: new Date(now.getTime() - 1 * 3600_000 + 45_000).toISOString(),
        pitrEnabled: true,
      },
      {
        id: 'bkp-003',
        type: 'snapshot',
        status: 'completed',
        sizeBytes: 4_250_000_000,
        region: 'us-west-2',
        startedAt: new Date(now.getTime() - 12 * 3600_000).toISOString(),
        completedAt: new Date(now.getTime() - 12 * 3600_000 + 10 * 60_000).toISOString(),
        pitrEnabled: false,
      },
    ];
    this.backups.push(...backups);

    this.drTests.push({
      id: 'drt-001',
      type: 'failover',
      status: 'passed',
      rtoActual: 11,
      rpoActual: 3,
      notes:
        'Automated failover to us-west-2. RTO target met. All health checks passed within 11 minutes.',
      executedAt: new Date(now.getTime() - 7 * 24 * 3600_000).toISOString(),
    });
  }

  // ─── Queue API ─────────────────────────────────────────────────────────────
  getQueueStats() {
    return {
      high: this.jobQueues.get('high')!.length,
      normal: this.jobQueues.get('normal')!.length,
      low: this.jobQueues.get('low')!.length,
      dlq: this.dlq.length,
      total: this.jobIndex.size,
    };
  }

  listJobs(priority?: JobPriority): Job[] {
    if (priority) return [...(this.jobQueues.get(priority) ?? [])];
    return [
      ...this.jobQueues.get('high')!,
      ...this.jobQueues.get('normal')!,
      ...this.jobQueues.get('low')!,
    ];
  }

  listDlq(): Job[] {
    return [...this.dlq];
  }

  enqueue(data: {
    type: string;
    priority?: JobPriority;
    payload?: Record<string, unknown>;
    tenantId: string;
    maxAttempts?: number;
    idempotencyKey?: string;
  }): Job | null {
    if (data.idempotencyKey && this.idempotencyIndex.has(data.idempotencyKey)) {
      return null;
    }
    const priority = data.priority ?? 'normal';
    const ts = new Date().toISOString();
    const job: Job = {
      id: uid('job'),
      type: data.type,
      priority,
      payload: data.payload ?? {},
      tenantId: data.tenantId,
      status: 'pending',
      attempts: 0,
      maxAttempts: data.maxAttempts ?? 3,
      idempotencyKey: data.idempotencyKey,
      createdAt: ts,
      scheduledAt: ts,
      processedAt: null,
      failedAt: null,
      error: null,
    };
    this.jobQueues.get(priority)!.push(job);
    this.jobIndex.set(job.id, job);
    if (data.idempotencyKey) this.idempotencyIndex.set(data.idempotencyKey, job.id);
    return job;
  }

  retryDlq(jobId: string): Job | null {
    const idx = this.dlq.findIndex((j) => j.id === jobId);
    if (idx === -1) return null;
    const [job] = this.dlq.splice(idx, 1);
    job!.status = 'pending';
    job!.attempts = 0;
    job!.error = null;
    job!.failedAt = null;
    this.jobQueues.get(job!.priority)!.push(job!);
    return job!;
  }

  // ─── Feature Flags ─────────────────────────────────────────────────────────
  listFlags(): FeatureFlag[] {
    return [...this.flags.values()];
  }
  getFlag(id: string): FeatureFlag | undefined {
    return this.flags.get(id);
  }
  getFlagByKey(key: string): FeatureFlag | undefined {
    return [...this.flags.values()].find((f) => f.key === key);
  }
  upsertFlag(flag: FeatureFlag): void {
    this.flags.set(flag.id, { ...flag, updatedAt: new Date().toISOString() });
  }
  patchFlag(id: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const flag = this.flags.get(id);
    if (!flag) return null;
    const updated = { ...flag, ...updates, id: flag.id, updatedAt: new Date().toISOString() };
    this.flags.set(id, updated);
    return updated;
  }
  deleteFlag(id: string): boolean {
    return this.flags.delete(id);
  }

  // ─── SLOs ──────────────────────────────────────────────────────────────────
  listSlos(): SloDefinition[] {
    return [...this.slos.values()];
  }
  getSlo(id: string): SloDefinition | undefined {
    return this.slos.get(id);
  }

  // ─── DR ────────────────────────────────────────────────────────────────────
  getDrConfig(): DrConfig {
    return { ...this.drConfig };
  }
  listBackups(): Backup[] {
    return [...this.backups];
  }
  listDrTests(): DrTest[] {
    return [...this.drTests];
  }

  triggerBackup(type: Backup['type']): Backup {
    const ts = new Date().toISOString();
    const backup: Backup = {
      id: uid('bkp'),
      type,
      status: 'running',
      sizeBytes: 0,
      region: this.drConfig.primaryRegion,
      startedAt: ts,
      completedAt: null,
      pitrEnabled: true,
    };
    this.backups.unshift(backup);
    // Simulate completion after short delay (store side only)
    setTimeout(() => {
      backup.status = 'completed';
      backup.sizeBytes = type === 'full' ? 4_200_000_000 : 200_000_000;
      backup.completedAt = new Date().toISOString();
    }, 500);
    return backup;
  }

  addDrTest(test: Omit<DrTest, 'id' | 'executedAt'>): DrTest {
    const drTest: DrTest = { ...test, id: uid('drt'), executedAt: new Date().toISOString() };
    this.drTests.unshift(drTest);
    return drTest;
  }
}

export const titanStore = new TitanStore();
