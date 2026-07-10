/**
 * Sprint 30 — OBSERVATORY
 * In-memory store with seeded observability data.
 */
import { randomUUID } from 'node:crypto';
import type {
  AlertRule,
  Alert,
  Incident,
  IncidentEvent,
  AuditLog,
  SLADefinition,
  SLAEvent,
  MetricSample,
  HeatmapCell,
  AlertSeverity,
  AlertChannel,
  IncidentStatus,
  IncidentSeverity,
} from './types.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60_000).toISOString();
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

// ─── Seeded Alert Rules ───────────────────────────────────────────────────────

function seedAlertRules(): AlertRule[] {
  const rules: Array<[string, string, string, AlertSeverity, AlertChannel[]]> = [
    [
      'Workflow Failure Rate',
      'Triggers when failure rate exceeds 5%',
      'failureRate > 0.05',
      'ERROR',
      ['email', 'slack'],
    ],
    [
      'Queue Overflow',
      'Triggers when queue depth exceeds 100 jobs',
      'queueDepth > 100',
      'WARNING',
      ['slack', 'webhook'],
    ],
    [
      'SLA Breach',
      'Triggers on any SLA breach',
      'slaBreached == true',
      'CRITICAL',
      ['email', 'teams', 'slack'],
    ],
    [
      'Agent Offline',
      'Triggers when any agent goes offline',
      'agentOffline == true',
      'ERROR',
      ['email', 'webhook'],
    ],
    ['High Avg Duration', 'Triggers when avg > 10s', 'avgDurationMs > 10000', 'WARNING', ['slack']],
    [
      'Connector Error',
      'Triggers when connector status is ERROR',
      'connectorError == true',
      'ERROR',
      ['email', 'webhook', 'discord'],
    ],
    ['DLQ Threshold', 'DLQ depth > 10', 'dlqDepth > 10', 'WARNING', ['slack', 'webhook']],
    [
      'Incident Opened',
      'Auto-alert on new CRITICAL incident',
      'incidentSeverity == CRITICAL',
      'CRITICAL',
      ['email', 'teams', 'whatsapp'],
    ],
    ['Low Success Rate', 'Success rate below 95%', 'successRate < 0.95', 'WARNING', ['email']],
    [
      'Memory Pressure',
      'Memory usage above 85%',
      'memoryPct > 85',
      'WARNING',
      ['slack', 'webhook'],
    ],
  ];
  return rules.map(([name, description, condition, severity, channels], i) => ({
    id: randomUUID(),
    name: name!,
    description: description!,
    condition: condition!,
    severity: severity!,
    channels: channels!,
    cooldownMs: 300_000,
    active: i < 8,
    createdAt: daysAgo(30 - i),
    updatedAt: daysAgo(10 - i),
    triggeredCount: [12, 3, 7, 5, 2, 8, 1, 15, 4, 0][i]!,
    lastTriggeredAt: i < 7 ? minutesAgo(15 * (i + 1)) : undefined,
  }));
}

function seedAlerts(rules: AlertRule[]): Alert[] {
  const messages = [
    'Workflow "ERP Product Sync" failed — failure rate 8.3%',
    'Queue depth reached 127 jobs — overflow imminent',
    'SLA breach: "ERP Product Sync" took 18.4s (limit 10s)',
    'Agent "staging-worker-02" went offline',
    'Average duration 12.1s over last 5 minutes',
    'Connector "ERP-Staging" status changed to ERROR',
    'DLQ contains 14 failed jobs',
    'CRITICAL incident #INC-003 opened: database connection failure',
    'Success rate dropped to 91.2% (threshold: 95%)',
    'Memory usage at 87% on prod-worker-01',
  ];
  return messages.map((message, i) => ({
    id: randomUUID(),
    ruleId: rules[i % rules.length]!.id,
    ruleName: rules[i % rules.length]!.name,
    severity: (
      [
        'INFO',
        'WARNING',
        'ERROR',
        'CRITICAL',
        'WARNING',
        'ERROR',
        'WARNING',
        'CRITICAL',
        'WARNING',
        'WARNING',
      ] as AlertSeverity[]
    )[i]!,
    message,
    channels: rules[i % rules.length]!.channels,
    deliveredTo: rules[i % rules.length]!.channels,
    timestamp: minutesAgo((i + 1) * 12),
    acknowledged: i > 5,
    acknowledgedAt: i > 5 ? minutesAgo((i - 5) * 8) : undefined,
    acknowledgedBy: i > 5 ? 'ops@example.com' : undefined,
  }));
}

// ─── Seeded Incidents ─────────────────────────────────────────────────────────

function seedIncident(
  title: string,
  description: string,
  status: IncidentStatus,
  severity: IncidentSeverity,
  openedMinsAgo: number,
  events: Array<[IncidentStatus, string, string]>,
  cause?: string,
  resolution?: string
): Incident {
  const id = `INC-00${Math.floor(Math.random() * 900) + 100}`;
  const openedAt = minutesAgo(openedMinsAgo);
  return {
    id: randomUUID(),
    title,
    description,
    status,
    severity,
    openedAt,
    updatedAt: minutesAgo(Math.floor(openedMinsAgo / 3)),
    resolvedAt: ['RESOLVED', 'CLOSED'].includes(status)
      ? minutesAgo(openedMinsAgo - 120)
      : undefined,
    closedAt: status === 'CLOSED' ? minutesAgo(openedMinsAgo - 200) : undefined,
    cause,
    resolution,
    events: events.map(([s, msg, author]) => ({
      id: randomUUID(),
      incidentId: id,
      status: s,
      message: msg,
      author,
      timestamp: minutesAgo(openedMinsAgo - events.indexOf([s, msg, author]) * 30),
    })),
  };
}

function seedIncidents(): Incident[] {
  return [
    seedIncident(
      'ERP Staging Connector Failure',
      'ERP-Staging connector repeatedly failing with connection timeout. 12 failed syncs in last hour.',
      'INVESTIGATING',
      'HIGH',
      95,
      [
        [
          'OPEN',
          'Incident automatically opened — connector error rate exceeded threshold',
          'system',
        ],
        [
          'INVESTIGATING',
          'Investigating database connection pooling on staging DB',
          'ops@example.com',
        ],
      ],
      'PostgreSQL connection pool exhausted after staging deployment'
    ),
    seedIncident(
      'Workflow Queue Overflow',
      'Job queue depth reached 150 items. Worker throughput degraded due to memory pressure.',
      'OPEN',
      'MEDIUM',
      35,
      [['OPEN', 'Queue depth exceeded 100 — alert triggered', 'system']],
      'Burst of product update events from ERP after bulk import'
    ),
    seedIncident(
      'SLA Breach: ERP Product Sync',
      'ERP Product Sync workflow consistently exceeding 10s SLA over past 6 hours.',
      'FIXED',
      'MEDIUM',
      380,
      [
        ['OPEN', 'SLA breach detected — avg execution 14.3s vs 10s limit', 'system'],
        [
          'INVESTIGATING',
          'Identified slow JOIN query in ERP transformation step',
          'admin@example.com',
        ],
        [
          'FIXED',
          'Added index on erp.products.updated_at — latency back to 2.1s',
          'admin@example.com',
        ],
      ],
      'Missing database index on products.updated_at column',
      'Added composite index on (updated_at, category_id) — verified fix'
    ),
    seedIncident(
      'Agent Heartbeat Loss',
      'staging-worker-02 stopped sending heartbeats. All workflows on that agent paused.',
      'RESOLVED',
      'HIGH',
      1440,
      [
        ['OPEN', 'Agent heartbeat timeout after 5 minutes', 'system'],
        ['INVESTIGATING', 'SSH into staging-worker-02 — service crash detected', 'ops@example.com'],
        ['FIXED', 'Restarted agent service — heartbeats resumed', 'ops@example.com'],
        ['RESOLVED', 'Monitoring for 30 mins — stable. Root cause: OOM killer', 'ops@example.com'],
      ],
      'Out-of-memory condition on staging server — agent process killed',
      'Restarted agent service; increased memory limit to 2GB'
    ),
    seedIncident(
      'API Rate Limit: Seltriva Endpoint',
      'External Seltriva API returning 429 errors — rate limit exceeded during peak sync.',
      'CLOSED',
      'LOW',
      4320,
      [
        ['OPEN', 'HTTP 429 errors from Seltriva API detected', 'system'],
        [
          'INVESTIGATING',
          'Reviewing request volume — peak sync batch too large',
          'admin@example.com',
        ],
        ['FIXED', 'Reduced batch size from 500 to 100 records per request', 'admin@example.com'],
        ['RESOLVED', 'Rate limit errors gone. Monitoring confirmed.', 'admin@example.com'],
        ['CLOSED', 'Incident closed after 48h stable period', 'admin@example.com'],
      ],
      'Sync batch size exceeded API rate limit',
      'Reduced batch size; added exponential backoff on 429'
    ),
  ];
}

// ─── Seeded Audit Logs ────────────────────────────────────────────────────────

function seedAuditLogs(): AuditLog[] {
  const actors = [
    'admin@example.com',
    'ops@example.com',
    'viewer@example.com',
    'system',
    'api-key:erp-sync',
  ];
  const actions = [
    ['workflow.created', 'workflow', 'ERP Product Sync'],
    ['workflow.updated', 'workflow', 'ERP Product Sync'],
    ['workflow.activated', 'workflow', 'ERP Product Sync'],
    ['workflow.run', 'workflow', 'ERP Product Sync'],
    ['workflow.created', 'workflow', 'Customer Onboarding Alert'],
    ['workflow.run', 'workflow', 'Customer Onboarding Alert'],
    ['execution.started', 'execution', 'ERP Product Sync #run-142'],
    ['execution.completed', 'execution', 'ERP Product Sync #run-142'],
    ['execution.failed', 'execution', 'ERP Product Sync #run-101'],
    ['connector.restarted', 'connector', 'ERP-Staging'],
    ['connector.stopped', 'connector', 'CRM-Prod'],
    ['connector.started', 'connector', 'CRM-Prod'],
    ['user.login', 'user', 'admin@example.com'],
    ['user.login', 'user', 'ops@example.com'],
    ['user.created', 'user', 'viewer@example.com'],
    ['settings.updated', 'settings', 'sync.intervalMs'],
    ['alert.triggered', 'alert', 'Workflow Failure Rate'],
    ['incident.opened', 'incident', 'ERP Staging Connector Failure'],
    ['incident.updated', 'incident', 'ERP Staging Connector Failure'],
    ['sla.created', 'sla', 'ERP 10s SLA'],
  ];
  const logs: AuditLog[] = [];
  for (let i = 0; i < 200; i++) {
    const [action, resourceType, resourceName] = actions[i % actions.length]!;
    const actor = actors[i % actors.length]!;
    const failed = action!.includes('failed') || i % 17 === 0;
    logs.push({
      id: randomUUID(),
      timestamp: minutesAgo(i * 3 + 1),
      actor,
      action: action!,
      resourceType: resourceType!,
      resourceId: randomUUID(),
      resourceName: resourceName!,
      ip: actor.includes('@') ? `10.0.${i % 4}.${i % 255}` : undefined,
      outcome: failed ? 'failure' : 'success',
    });
  }
  return logs;
}

// ─── Seeded SLA Definitions ───────────────────────────────────────────────────

function seedSLAs(): SLADefinition[] {
  return [
    {
      id: randomUUID(),
      name: 'ERP Product Sync 10s',
      description: 'ERP Product Sync workflow must complete within 10 seconds.',
      maxDurationMs: 10_000,
      warnThresholdMs: 7_000,
      active: true,
      createdAt: daysAgo(60),
      compliancePct: 94.2,
      breachCount: 7,
      warnCount: 12,
      lastBreachAt: minutesAgo(380),
    },
    {
      id: randomUUID(),
      name: 'Customer Onboarding 5s',
      description: 'Customer onboarding webhook must be processed within 5 seconds.',
      maxDurationMs: 5_000,
      warnThresholdMs: 3_500,
      active: true,
      createdAt: daysAgo(45),
      compliancePct: 99.1,
      breachCount: 1,
      warnCount: 3,
      lastBreachAt: daysAgo(3),
    },
    {
      id: randomUUID(),
      name: 'Daily Report 2min',
      description: 'Daily Atlas Report workflow must complete within 2 minutes.',
      maxDurationMs: 120_000,
      warnThresholdMs: 90_000,
      active: false,
      createdAt: daysAgo(30),
      compliancePct: 100,
      breachCount: 0,
      warnCount: 0,
    },
    {
      id: randomUUID(),
      name: 'End-to-End ERP→Seltriva 18s',
      description: 'Full ERP-to-Seltriva pipeline: DB(3s) + Transform(5s) + API(10s) = 18s total.',
      maxDurationMs: 18_000,
      warnThresholdMs: 13_000,
      active: true,
      createdAt: daysAgo(20),
      compliancePct: 97.8,
      breachCount: 2,
      warnCount: 8,
      lastBreachAt: hoursAgo(36),
    },
    {
      id: randomUUID(),
      name: 'API Response SLA 5s',
      description: 'All external HTTP action nodes must respond within 5 seconds.',
      maxDurationMs: 5_000,
      warnThresholdMs: 3_000,
      active: true,
      createdAt: daysAgo(15),
      compliancePct: 98.4,
      breachCount: 3,
      warnCount: 6,
      lastBreachAt: hoursAgo(72),
    },
  ];
}

function seedSLAEvents(slas: SLADefinition[]): SLAEvent[] {
  const events: SLAEvent[] = [];
  const workflowNames = ['ERP Product Sync', 'Customer Onboarding Alert', 'Daily Atlas Report'];
  for (let i = 0; i < 30; i++) {
    const sla = slas[i % slas.length]!;
    const dur = sla.maxDurationMs * (0.5 + Math.random() * 1.2);
    const breached = dur > sla.maxDurationMs;
    const warn = !breached && dur > sla.warnThresholdMs;
    if (!breached && !warn) continue;
    events.push({
      id: randomUUID(),
      slaId: sla.id,
      slaName: sla.name,
      executionId: randomUUID(),
      workflowName: workflowNames[i % workflowNames.length]!,
      actualDurationMs: Math.round(dur),
      limitMs: sla.maxDurationMs,
      breached,
      violationType: breached ? 'breach' : 'warn',
      timestamp: minutesAgo(i * 45 + 10),
    });
  }
  return events;
}

// ─── Seeded Metrics ───────────────────────────────────────────────────────────

function seedMetrics(): MetricSample[] {
  const samples: MetricSample[] = [];
  const now = Date.now();
  for (let i = 287; i >= 0; i--) {
    const ts = new Date(now - i * 300_000).toISOString(); // 5-min buckets
    const hour = new Date(now - i * 300_000).getHours();
    const isPeak = hour >= 8 && hour <= 18;
    const base = isPeak ? 8 : 2;
    const epm = base + Math.floor(Math.random() * (isPeak ? 12 : 3));
    const fails = Math.floor(Math.random() * (epm * 0.08));
    const success = Math.max(0, epm - fails);
    samples.push({
      ts,
      executionsPerMinute: epm,
      successRate: epm > 0 ? Math.round((success / epm) * 1000) / 10 : 100,
      avgDurationMs: 800 + Math.floor(Math.random() * (isPeak ? 3000 : 800)),
      failureCount: fails,
      queueDepth: Math.floor(Math.random() * (isPeak ? 20 : 5)),
      activeConnectors: 2 + Math.floor(Math.random() * 2),
      agentsOnline: 1 + Math.floor(Math.random() * 2),
      p95DurationMs: 1200 + Math.floor(Math.random() * (isPeak ? 5000 : 1000)),
    });
  }
  return samples;
}

// ─── Seeded Heatmap ───────────────────────────────────────────────────────────

function seedHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const DAYS = ['Today', 'Yesterday', '2d ago', '3d ago', '4d ago', '5d ago', '6d ago'];
  for (let d = 0; d <= 6; d++) {
    for (let h = 0; h < 24; h++) {
      const isPeak = h >= 8 && h <= 18;
      const isMid = h >= 1 && h <= 5;
      let value = isPeak
        ? 20 + Math.floor(Math.random() * 60)
        : isMid
          ? Math.floor(Math.random() * 5)
          : 5 + Math.floor(Math.random() * 15);
      if (d === 0 && h > new Date().getHours()) value = 0; // future hours today = 0
      cells.push({
        day: d,
        hour: h,
        value,
        label: `${DAYS[d]}, ${h.toString().padStart(2, '0')}:00`,
      });
    }
  }
  return cells;
}

// ─── ObservatoryStore ─────────────────────────────────────────────────────────

class ObservatoryStore {
  alertRules: AlertRule[] = [];
  alerts: Alert[] = [];
  incidents: Incident[] = [];
  auditLogs: AuditLog[] = [];
  slaDefinitions: SLADefinition[] = [];
  slaEvents: SLAEvent[] = [];
  metrics: MetricSample[] = [];
  heatmap: HeatmapCell[] = [];
  startedAt: Date = new Date();

  constructor() {
    this.alertRules = seedAlertRules();
    this.alerts = seedAlerts(this.alertRules);
    this.incidents = seedIncidents();
    this.auditLogs = seedAuditLogs();
    this.slaDefinitions = seedSLAs();
    this.slaEvents = seedSLAEvents(this.slaDefinitions);
    this.metrics = seedMetrics();
    this.heatmap = seedHeatmap();
  }

  uptimeSeconds(): number {
    return Math.round((Date.now() - this.startedAt.getTime()) / 1000);
  }

  openIncidents(): Incident[] {
    return this.incidents.filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING');
  }

  unacknowledgedAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  latestMetric(): MetricSample | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  slaBreachesToday(): number {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return this.slaEvents.filter((e) => e.breached && Date.parse(e.timestamp) >= midnight.getTime())
      .length;
  }
}

export const observatoryStore = new ObservatoryStore();
