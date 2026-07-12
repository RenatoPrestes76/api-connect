import type {
  TenantInfo,
  HealthCheck,
  OperationsAlert,
  OperationsEvent,
  OperationsMetric,
  SlaRecord,
  ActionResult,
  AlertSeverity,
  SlaPeriod,
  HealthStatus,
} from './types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const TENANTS: TenantInfo[] = [
  { tenantId: 'tenant-enterprise', name: 'Omega Corp', plan: 'enterprise' },
  { tenantId: 'tenant-professional', name: 'Beta Systems', plan: 'professional' },
  { tenantId: 'tenant-community', name: 'Gamma Startup', plan: 'community' },
];

function seedChecks(): HealthCheck[] {
  const t = nowIso();
  return [
    // Enterprise — all healthy
    {
      id: 'hc-ent-db',
      componentType: 'database',
      componentId: 'db-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'PostgreSQL operational',
      checkedAt: t,
    },
    {
      id: 'hc-ent-ag1',
      componentType: 'agent',
      componentId: 'agent-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'Running · last heartbeat 12s ago',
      checkedAt: t,
    },
    {
      id: 'hc-ent-ag2',
      componentType: 'agent',
      componentId: 'agent-ent-02',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'Running · last heartbeat 8s ago',
      checkedAt: t,
    },
    {
      id: 'hc-ent-cn1',
      componentType: 'connector',
      componentId: 'conn-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'SAP ERP — OK',
      checkedAt: t,
    },
    {
      id: 'hc-ent-cn2',
      componentType: 'connector',
      componentId: 'conn-ent-02',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'REST API — OK',
      checkedAt: t,
    },
    {
      id: 'hc-ent-q1',
      componentType: 'queue',
      componentId: 'queue-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'Depth: 3 · Processing normally',
      checkedAt: t,
    },
    {
      id: 'hc-ent-api',
      componentType: 'api',
      componentId: 'api-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'p95: 187ms',
      checkedAt: t,
    },
    {
      id: 'hc-ent-sch',
      componentType: 'scheduler',
      componentId: 'sched-ent-01',
      tenantId: 'tenant-enterprise',
      status: 'healthy',
      message: 'Next run in 4m',
      checkedAt: t,
    },
    // Professional — mixed
    {
      id: 'hc-pro-db',
      componentType: 'database',
      componentId: 'db-pro-01',
      tenantId: 'tenant-professional',
      status: 'healthy',
      message: 'MySQL operational',
      checkedAt: t,
    },
    {
      id: 'hc-pro-ag1',
      componentType: 'agent',
      componentId: 'agent-pro-01',
      tenantId: 'tenant-professional',
      status: 'healthy',
      message: 'Running',
      checkedAt: t,
    },
    {
      id: 'hc-pro-ag2',
      componentType: 'agent',
      componentId: 'agent-pro-02',
      tenantId: 'tenant-professional',
      status: 'warning',
      message: 'High CPU: 78%',
      checkedAt: t,
    },
    {
      id: 'hc-pro-cn1',
      componentType: 'connector',
      componentId: 'conn-pro-01',
      tenantId: 'tenant-professional',
      status: 'warning',
      message: 'Response p95: 645ms (threshold 500ms)',
      checkedAt: t,
    },
    {
      id: 'hc-pro-cn2',
      componentType: 'connector',
      componentId: 'conn-pro-02',
      tenantId: 'tenant-professional',
      status: 'healthy',
      message: 'SOAP Service — OK',
      checkedAt: t,
    },
    {
      id: 'hc-pro-q1',
      componentType: 'queue',
      componentId: 'queue-pro-01',
      tenantId: 'tenant-professional',
      status: 'warning',
      message: 'Depth: 248 · Growing',
      checkedAt: t,
    },
    {
      id: 'hc-pro-api',
      componentType: 'api',
      componentId: 'api-pro-01',
      tenantId: 'tenant-professional',
      status: 'healthy',
      message: 'p95: 287ms',
      checkedAt: t,
    },
    {
      id: 'hc-pro-sch',
      componentType: 'scheduler',
      componentId: 'sched-pro-01',
      tenantId: 'tenant-professional',
      status: 'healthy',
      message: 'Next run in 12m',
      checkedAt: t,
    },
    // Community — degraded
    {
      id: 'hc-com-db',
      componentType: 'database',
      componentId: 'db-com-01',
      tenantId: 'tenant-community',
      status: 'healthy',
      message: 'SQLite operational',
      checkedAt: t,
    },
    {
      id: 'hc-com-ag1',
      componentType: 'agent',
      componentId: 'agent-com-01',
      tenantId: 'tenant-community',
      status: 'critical',
      message: 'No heartbeat for 15m',
      checkedAt: t,
    },
    {
      id: 'hc-com-cn1',
      componentType: 'connector',
      componentId: 'conn-com-01',
      tenantId: 'tenant-community',
      status: 'offline',
      message: 'Connection refused',
      checkedAt: t,
    },
    {
      id: 'hc-com-q1',
      componentType: 'queue',
      componentId: 'queue-com-01',
      tenantId: 'tenant-community',
      status: 'critical',
      message: 'Depth: 1842 · Dead-letter accumulating',
      checkedAt: t,
    },
    {
      id: 'hc-com-api',
      componentType: 'api',
      componentId: 'api-com-01',
      tenantId: 'tenant-community',
      status: 'warning',
      message: 'p95: 1200ms',
      checkedAt: t,
    },
    {
      id: 'hc-com-sch',
      componentType: 'scheduler',
      componentId: 'sched-com-01',
      tenantId: 'tenant-community',
      status: 'healthy',
      message: 'Paused — no active jobs',
      checkedAt: t,
    },
  ];
}

function seedAlerts(): OperationsAlert[] {
  return [
    {
      id: 'alrt-001',
      tenantId: 'tenant-community',
      severity: 'critical',
      title: 'Agent Offline',
      description: 'agent-com-01 missed 3 consecutive heartbeats',
      componentType: 'agent',
      componentId: 'agent-com-01',
      resolved: false,
      createdAt: ago(15),
    },
    {
      id: 'alrt-002',
      tenantId: 'tenant-community',
      severity: 'error',
      title: 'Connector Unreachable',
      description: 'conn-com-01 refused connection on port 443',
      componentType: 'connector',
      componentId: 'conn-com-01',
      resolved: false,
      createdAt: ago(14),
    },
    {
      id: 'alrt-003',
      tenantId: 'tenant-community',
      severity: 'warning',
      title: 'Queue Accumulating',
      description: 'Dead-letter queue depth exceeded 1000',
      componentType: 'queue',
      componentId: 'queue-com-01',
      resolved: false,
      createdAt: ago(12),
    },
    {
      id: 'alrt-004',
      tenantId: 'tenant-professional',
      severity: 'warning',
      title: 'Agent CPU Elevated',
      description: 'agent-pro-02 CPU at 78% for >10m',
      componentType: 'agent',
      componentId: 'agent-pro-02',
      resolved: false,
      createdAt: ago(20),
    },
    {
      id: 'alrt-005',
      tenantId: 'tenant-professional',
      severity: 'warning',
      title: 'Connector Latency High',
      description: 'conn-pro-01 p95 exceeded 500ms threshold',
      componentType: 'connector',
      componentId: 'conn-pro-01',
      resolved: false,
      createdAt: ago(8),
    },
    {
      id: 'alrt-006',
      tenantId: 'tenant-enterprise',
      severity: 'info',
      title: 'Deployment Completed',
      description: 'v1.0.0 deployed to production successfully',
      componentType: 'api',
      componentId: 'api-ent-01',
      resolved: true,
      resolvedAt: ago(30),
      createdAt: ago(35),
    },
  ];
}

function seedEvents(): OperationsEvent[] {
  const sev = (s: AlertSeverity): AlertSeverity => s;
  return [
    {
      id: 'evt-001',
      tenantId: 'tenant-enterprise',
      event: 'agent.connected',
      severity: sev('info'),
      payload: { agentId: 'agent-ent-01', version: '1.0.0' },
      createdAt: ago(2),
    },
    {
      id: 'evt-002',
      tenantId: 'tenant-enterprise',
      event: 'webhook.received',
      severity: sev('info'),
      payload: { source: 'SAP ERP', records: 142 },
      createdAt: ago(3),
    },
    {
      id: 'evt-003',
      tenantId: 'tenant-enterprise',
      event: 'job.completed',
      severity: sev('info'),
      payload: { jobId: 'job-abc', duration: 1240 },
      createdAt: ago(5),
    },
    {
      id: 'evt-004',
      tenantId: 'tenant-professional',
      event: 'connector.slow',
      severity: sev('warning'),
      payload: { connectorId: 'conn-pro-01', p95: 645 },
      createdAt: ago(8),
    },
    {
      id: 'evt-005',
      tenantId: 'tenant-professional',
      event: 'retry.initiated',
      severity: sev('warning'),
      payload: { jobId: 'job-xyz', attempt: 2 },
      createdAt: ago(10),
    },
    {
      id: 'evt-006',
      tenantId: 'tenant-professional',
      event: 'retry.completed',
      severity: sev('info'),
      payload: { jobId: 'job-xyz', success: true },
      createdAt: ago(9),
    },
    {
      id: 'evt-007',
      tenantId: 'tenant-community',
      event: 'agent.offline',
      severity: sev('critical'),
      payload: { agentId: 'agent-com-01', lastSeen: ago(15) },
      createdAt: ago(15),
    },
    {
      id: 'evt-008',
      tenantId: 'tenant-community',
      event: 'connector.failed',
      severity: sev('error'),
      payload: { connectorId: 'conn-com-01', error: 'ECONNREFUSED' },
      createdAt: ago(14),
    },
    {
      id: 'evt-009',
      tenantId: 'tenant-community',
      event: 'queue.overflow',
      severity: sev('critical'),
      payload: { queueId: 'queue-com-01', depth: 1842 },
      createdAt: ago(12),
    },
    {
      id: 'evt-010',
      tenantId: 'tenant-enterprise',
      event: 'provision.completed',
      severity: sev('info'),
      payload: { tenantId: 'tenant-enterprise', duration: 4200 },
      createdAt: ago(120),
    },
    {
      id: 'evt-011',
      tenantId: 'tenant-enterprise',
      event: 'secrets.updated',
      severity: sev('info'),
      payload: { provider: 'vault', count: 3 },
      createdAt: ago(180),
    },
    {
      id: 'evt-012',
      tenantId: 'tenant-professional',
      event: 'heartbeat.missed',
      severity: sev('warning'),
      payload: { agentId: 'agent-pro-02', expected: ago(3) },
      createdAt: ago(3),
    },
  ];
}

function seedMetrics(): OperationsMetric[] {
  const ts = nowIso();
  const m = (tenantId: string, metric: string, value: number, unit: string): OperationsMetric => ({
    id: genId('met'),
    tenantId,
    metric,
    value,
    unit,
    timestamp: ts,
  });
  return [
    // Enterprise
    m('tenant-enterprise', 'response_time_avg', 145, 'ms'),
    m('tenant-enterprise', 'p95_latency', 380, 'ms'),
    m('tenant-enterprise', 'p99_latency', 680, 'ms'),
    m('tenant-enterprise', 'cpu_usage', 42, '%'),
    m('tenant-enterprise', 'memory_usage', 55, '%'),
    m('tenant-enterprise', 'disk_usage', 34, '%'),
    m('tenant-enterprise', 'heartbeats_per_min', 142, 'hb/min'),
    m('tenant-enterprise', 'retries', 0, 'count'),
    m('tenant-enterprise', 'failures', 0, 'count'),
    m('tenant-enterprise', 'jobs_executed', 1847, 'count'),
    m('tenant-enterprise', 'availability', 99.97, '%'),
    // Professional
    m('tenant-professional', 'response_time_avg', 287, 'ms'),
    m('tenant-professional', 'p95_latency', 645, 'ms'),
    m('tenant-professional', 'p99_latency', 950, 'ms'),
    m('tenant-professional', 'cpu_usage', 68, '%'),
    m('tenant-professional', 'memory_usage', 71, '%'),
    m('tenant-professional', 'disk_usage', 67, '%'),
    m('tenant-professional', 'heartbeats_per_min', 87, 'hb/min'),
    m('tenant-professional', 'retries', 3, 'count'),
    m('tenant-professional', 'failures', 2, 'count'),
    m('tenant-professional', 'jobs_executed', 432, 'count'),
    m('tenant-professional', 'availability', 99.81, '%'),
    // Community
    m('tenant-community', 'response_time_avg', 520, 'ms'),
    m('tenant-community', 'p95_latency', 1200, 'ms'),
    m('tenant-community', 'p99_latency', 2100, 'ms'),
    m('tenant-community', 'cpu_usage', 89, '%'),
    m('tenant-community', 'memory_usage', 88, '%'),
    m('tenant-community', 'disk_usage', 91, '%'),
    m('tenant-community', 'heartbeats_per_min', 12, 'hb/min'),
    m('tenant-community', 'retries', 15, 'count'),
    m('tenant-community', 'failures', 8, 'count'),
    m('tenant-community', 'jobs_executed', 67, 'count'),
    m('tenant-community', 'availability', 98.34, '%'),
  ];
}

function seedSla(): SlaRecord[] {
  const periods: Array<{ period: SlaPeriod; avail: [number, number, number] }> = [
    { period: 'today', avail: [99.97, 99.81, 98.34] },
    { period: '7d', avail: [99.95, 99.83, 97.91] },
    { period: '30d', avail: [99.94, 99.79, 96.44] },
    { period: '12m', avail: [99.92, 99.72, 95.11] },
  ];
  const targets: Record<string, number> = {
    'tenant-enterprise': 99.9,
    'tenant-professional': 99.9,
    'tenant-community': 99.0,
  };
  const names: Record<string, string> = {
    'tenant-enterprise': 'Omega Corp',
    'tenant-professional': 'Beta Systems',
    'tenant-community': 'Gamma Startup',
  };
  const tenantIds = ['tenant-enterprise', 'tenant-professional', 'tenant-community'];

  return periods.flatMap(({ period, avail }) =>
    tenantIds.map((tenantId, i) => ({
      id: genId('sla'),
      tenantId,
      tenantName: names[tenantId]!,
      availability: avail[i]!,
      period,
      target: targets[tenantId]!,
      met: avail[i]! >= targets[tenantId]!,
      createdAt: nowIso(),
    }))
  );
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class OperationsStore {
  private readonly tenants: TenantInfo[] = TENANTS;
  private healthChecks: HealthCheck[] = seedChecks();
  private alerts: OperationsAlert[] = seedAlerts();
  private events: OperationsEvent[] = seedEvents();
  private metrics: OperationsMetric[] = seedMetrics();
  private slaHistory: SlaRecord[] = seedSla();
  private actionLog: ActionResult[] = [];

  // Tenants
  getTenants(): TenantInfo[] {
    return [...this.tenants];
  }
  getTenant(tenantId: string): TenantInfo | undefined {
    return this.tenants.find((t) => t.tenantId === tenantId);
  }

  // Health checks
  getAllHealthChecks(): HealthCheck[] {
    return [...this.healthChecks];
  }
  getHealthChecks(tenantId: string): HealthCheck[] {
    return this.healthChecks.filter((c) => c.tenantId === tenantId);
  }
  getHealthCheck(id: string): HealthCheck | undefined {
    return this.healthChecks.find((c) => c.id === id);
  }
  updateHealthCheck(updated: HealthCheck): void {
    const idx = this.healthChecks.findIndex((c) => c.id === updated.id);
    if (idx !== -1) this.healthChecks[idx] = updated;
    else this.healthChecks.push(updated);
  }
  upsertHealthCheck(check: Omit<HealthCheck, 'id' | 'checkedAt'>): HealthCheck {
    const existing = this.healthChecks.find(
      (c) => c.tenantId === check.tenantId && c.componentId === check.componentId
    );
    const updated: HealthCheck = {
      id: existing?.id ?? genId('hc'),
      ...check,
      checkedAt: nowIso(),
    };
    if (existing) {
      const idx = this.healthChecks.indexOf(existing);
      this.healthChecks[idx] = updated;
    } else {
      this.healthChecks.push(updated);
    }
    return updated;
  }

  // Alerts
  getAlerts(
    tenantId?: string,
    opts: { severity?: string; resolved?: boolean } = {}
  ): OperationsAlert[] {
    let list = tenantId ? this.alerts.filter((a) => a.tenantId === tenantId) : [...this.alerts];
    if (opts.severity) list = list.filter((a) => a.severity === opts.severity);
    if (opts.resolved !== undefined) list = list.filter((a) => a.resolved === opts.resolved);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getAlert(id: string): OperationsAlert | undefined {
    return this.alerts.find((a) => a.id === id);
  }
  resolveAlert(id: string): OperationsAlert | null {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.resolved = true;
    alert.resolvedAt = nowIso();
    return { ...alert };
  }
  createAlert(data: Omit<OperationsAlert, 'id' | 'resolved' | 'createdAt'>): OperationsAlert {
    const alert: OperationsAlert = {
      id: genId('alrt'),
      ...data,
      resolved: false,
      createdAt: nowIso(),
    };
    this.alerts.push(alert);
    return alert;
  }

  // Events
  getEvents(tenantId?: string, limit = 50): OperationsEvent[] {
    const list = tenantId ? this.events.filter((e) => e.tenantId === tenantId) : [...this.events];
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  addEvent(event: Omit<OperationsEvent, 'id' | 'createdAt'>): OperationsEvent {
    const e: OperationsEvent = { id: genId('evt'), ...event, createdAt: nowIso() };
    this.events.unshift(e);
    return e;
  }

  // Metrics
  getMetrics(tenantId?: string): OperationsMetric[] {
    return tenantId ? this.metrics.filter((m) => m.tenantId === tenantId) : [...this.metrics];
  }
  getMetric(tenantId: string, metric: string): OperationsMetric | undefined {
    return this.metrics.find((m) => m.tenantId === tenantId && m.metric === metric);
  }

  // SLA
  getSlaHistory(tenantId?: string, period?: SlaPeriod): SlaRecord[] {
    let list = tenantId
      ? this.slaHistory.filter((s) => s.tenantId === tenantId)
      : [...this.slaHistory];
    if (period) list = list.filter((s) => s.period === period);
    return list;
  }

  // Action log
  addAction(result: ActionResult): void {
    this.actionLog.push(result);
  }
  getActionLog(): ActionResult[] {
    return [...this.actionLog];
  }
}

export const operationsStore = new OperationsStore();

// ─── Helper ───────────────────────────────────────────────────────────────────

export function computeOverallStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.length === 0) return 'offline';
  if (checks.some((c) => c.status === 'offline')) return 'offline';
  if (checks.some((c) => c.status === 'critical')) return 'critical';
  if (checks.some((c) => c.status === 'warning')) return 'warning';
  return 'healthy';
}
