/**
 * Sprint 29 — ORCHESTRATOR
 * In-memory store with seeded demo workflows, versions, executions and queue.
 */
import { randomUUID } from 'node:crypto';
import type {
  Workflow,
  WorkflowVersion,
  WorkflowExecution,
  WorkflowGraph,
  QueueJob,
  ExecutionStep,
  TriggerType,
} from './types.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

// ─── Demo Graphs ──────────────────────────────────────────────────────────────

function erpProductSyncGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        label: 'ERP Change Event',
        config: { triggerType: 'EVENT', eventType: 'product.updated' },
        position: { x: 250, y: 50 },
      },
      {
        id: 'n2',
        type: 'transform',
        label: 'Map ERP → Atlas',
        config: { expression: 'map(input, "erp-product-schema")', outputVar: 'product' },
        position: { x: 250, y: 150 },
      },
      {
        id: 'n3',
        type: 'validate',
        label: 'Validate Product',
        config: { schema: 'product', failOnError: true },
        position: { x: 250, y: 250 },
      },
      {
        id: 'n4',
        type: 'http',
        label: 'POST to Seltriva',
        config: { method: 'POST', url: 'https://api.seltriva.com/v1/products', timeout: 15000 },
        position: { x: 250, y: 350 },
      },
      {
        id: 'n5',
        type: 'condition',
        label: 'API Success?',
        config: { expression: 'context.http.status < 300', description: 'Check HTTP status' },
        position: { x: 250, y: 450 },
      },
      {
        id: 'n6',
        type: 'log',
        label: 'Log Success',
        config: { level: 'info', message: 'Product synced: {{product.id}}' },
        position: { x: 100, y: 570 },
      },
      {
        id: 'n7',
        type: 'retry',
        label: 'Retry on Failure',
        config: { maxAttempts: 3, backoffMs: 2000, strategy: 'exponential' },
        position: { x: 400, y: 550 },
      },
      {
        id: 'n8',
        type: 'notification',
        label: 'Alert on DLQ',
        config: { channel: 'email', to: 'ops@example.com', subject: 'Sync Failed' },
        position: { x: 400, y: 660 },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n5', target: 'n6', label: 'true' },
      { id: 'e6', source: 'n5', target: 'n7', label: 'false' },
      { id: 'e7', source: 'n7', target: 'n8' },
    ],
  };
}

function customerOnboardingGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        label: 'Webhook Received',
        config: { triggerType: 'WEBHOOK', webhookPath: '/webhooks/customer' },
        position: { x: 250, y: 50 },
      },
      {
        id: 'n2',
        type: 'validate',
        label: 'Validate Payload',
        config: { schema: 'customer', failOnError: false },
        position: { x: 250, y: 150 },
      },
      {
        id: 'n3',
        type: 'condition',
        label: 'Has Email?',
        config: {
          expression: 'input.email != null',
          description: 'Email is required for notification',
        },
        position: { x: 250, y: 260 },
      },
      {
        id: 'n4',
        type: 'notification',
        label: 'Welcome Email',
        config: {
          channel: 'email',
          to: '{{input.email}}',
          subject: 'Welcome to Seltriva Connect',
          template: 'welcome',
        },
        position: { x: 80, y: 380 },
      },
      {
        id: 'n5',
        type: 'dlq',
        label: 'Missing Email DLQ',
        config: { reason: 'Customer record missing email address', alertOn: true },
        position: { x: 420, y: 380 },
      },
      {
        id: 'n6',
        type: 'log',
        label: 'Log Outcome',
        config: { level: 'info', message: 'Customer onboarding processed: {{input.id}}' },
        position: { x: 80, y: 500 },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', label: 'true' },
      { id: 'e4', source: 'n3', target: 'n5', label: 'false' },
      { id: 'e5', source: 'n4', target: 'n6' },
    ],
  };
}

function dailyReportGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'trigger',
        label: 'Daily CRON',
        config: { triggerType: 'CRON', cronExpr: '0 8 * * *' },
        position: { x: 250, y: 50 },
      },
      {
        id: 'n2',
        type: 'http',
        label: 'Fetch Metrics',
        config: { method: 'GET', url: 'http://api:3001/api/v1/hub/dashboard', timeout: 10000 },
        position: { x: 250, y: 150 },
      },
      {
        id: 'n3',
        type: 'transform',
        label: 'Build Report',
        config: { expression: 'formatReport(input)', outputVar: 'report' },
        position: { x: 250, y: 250 },
      },
      {
        id: 'n4',
        type: 'notification',
        label: 'Send Report',
        config: {
          channel: 'email',
          to: 'admin@example.com',
          subject: 'Daily Atlas Report',
          template: 'daily-report',
        },
        position: { x: 250, y: 360 },
      },
      {
        id: 'n5',
        type: 'log',
        label: 'Log Sent',
        config: { level: 'info', message: 'Daily report sent' },
        position: { x: 250, y: 460 },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  };
}

// ─── Seed Executions ──────────────────────────────────────────────────────────

function seedSteps(nodes: WorkflowGraph['nodes'], success: boolean): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  const triggerNodes = nodes.filter((n) => n.type !== 'trigger');
  const allNodes = nodes;

  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i]!;
    const isLast = i === allNodes.length - 1;
    const failed = !success && isLast;
    const startMs = 50 + i * 80;
    const durMs = failed ? undefined : 30 + Math.floor(Math.random() * 200);
    steps.push({
      id: randomUUID(),
      nodeId: node.id,
      nodeType: node.type,
      label: node.label,
      status: failed ? 'FAILED' : 'COMPLETED',
      startedAt: new Date(Date.now() - 5 * 60_000 + startMs).toISOString(),
      finishedAt: failed
        ? undefined
        : new Date(Date.now() - 5 * 60_000 + startMs + (durMs ?? 0)).toISOString(),
      durationMs: durMs,
      attempt: 1,
      maxAttempts: 3,
      error: failed ? 'Connection timeout' : undefined,
    });
    // stop seeding steps after failure
    if (failed) break;
  }
  void triggerNodes; // used for type narrowing
  return steps;
}

function seedExecutions(
  workflowId: string,
  workflowName: string,
  graph: WorkflowGraph,
  count: number
): WorkflowExecution[] {
  const results: WorkflowExecution[] = [];
  for (let i = 0; i < count; i++) {
    const success = i % 7 !== 6;
    const dur = success ? 400 + Math.floor(Math.random() * 1200) : undefined;
    const started = new Date(Date.now() - (i * 45 + 3) * 60_000).toISOString();
    const finished = dur ? new Date(Date.parse(started) + dur).toISOString() : undefined;
    results.push({
      id: randomUUID(),
      workflowId,
      workflowName,
      workflowVersion: 1,
      status: success ? 'COMPLETED' : 'FAILED',
      triggerType: 'EVENT',
      startedAt: started,
      finishedAt: finished,
      durationMs: dur,
      steps: seedSteps(graph.nodes, success),
      error: success ? undefined : 'Step "POST to Seltriva" failed: Connection timeout',
    });
  }
  return results;
}

// ─── OrchestratorStore ────────────────────────────────────────────────────────

class OrchestratorStore {
  workflows: Map<string, Workflow> = new Map();
  versions: Map<string, WorkflowVersion[]> = new Map(); // keyed by workflowId
  executions: WorkflowExecution[] = [];
  queue: QueueJob[] = [];
  dlq: QueueJob[] = [];

  constructor() {
    this._seed();
  }

  private _seed() {
    const wfIds = [randomUUID(), randomUUID(), randomUUID()];

    // ── Workflow 1: ERP Product Sync ──────────────────────────────────────────
    const g1 = erpProductSyncGraph();
    const wf1: Workflow = {
      id: wfIds[0]!,
      name: 'ERP Product Sync',
      description:
        'Listens for product changes in the ERP and replicates them to Seltriva Connect.',
      active: true,
      version: 2,
      graph: g1,
      triggerType: 'EVENT' as TriggerType,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(4),
      executionCount: 142,
      lastExecutedAt: minutesAgo(7),
      successCount: 135,
      failureCount: 7,
      tags: ['erp', 'products', 'sync'],
    };
    this.workflows.set(wf1.id, wf1);
    this.versions.set(wf1.id, [
      {
        id: randomUUID(),
        workflowId: wf1.id,
        version: 1,
        graph: erpProductSyncGraph(),
        createdAt: hoursAgo(72),
        note: 'Initial version',
        author: 'admin@example.com',
      },
      {
        id: randomUUID(),
        workflowId: wf1.id,
        version: 2,
        graph: g1,
        createdAt: hoursAgo(4),
        note: 'Added retry + alert on failure',
        author: 'ops@example.com',
      },
    ]);
    this.executions.push(...seedExecutions(wf1.id, wf1.name, g1, 15));

    // ── Workflow 2: Customer Onboarding Alert ─────────────────────────────────
    const g2 = customerOnboardingGraph();
    const wf2: Workflow = {
      id: wfIds[1]!,
      name: 'Customer Onboarding Alert',
      description:
        'Receives webhook when a new customer is created; validates and sends welcome email.',
      active: true,
      version: 1,
      graph: g2,
      triggerType: 'WEBHOOK' as TriggerType,
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(36),
      executionCount: 58,
      lastExecutedAt: minutesAgo(23),
      successCount: 54,
      failureCount: 4,
      tags: ['crm', 'customers', 'notifications'],
    };
    this.workflows.set(wf2.id, wf2);
    this.versions.set(wf2.id, [
      {
        id: randomUUID(),
        workflowId: wf2.id,
        version: 1,
        graph: g2,
        createdAt: hoursAgo(36),
        note: 'Initial version',
        author: 'admin@example.com',
      },
    ]);
    this.executions.push(...seedExecutions(wf2.id, wf2.name, g2, 8));

    // ── Workflow 3: Daily Report ──────────────────────────────────────────────
    const g3 = dailyReportGraph();
    const wf3: Workflow = {
      id: wfIds[2]!,
      name: 'Daily Atlas Report',
      description: 'Runs every morning at 08:00 and emails a summary dashboard to admins.',
      active: false,
      version: 1,
      graph: g3,
      triggerType: 'CRON' as TriggerType,
      createdAt: hoursAgo(168),
      updatedAt: hoursAgo(24),
      executionCount: 14,
      lastExecutedAt: hoursAgo(16),
      successCount: 13,
      failureCount: 1,
      tags: ['reporting', 'daily', 'email'],
    };
    this.workflows.set(wf3.id, wf3);
    this.versions.set(wf3.id, [
      {
        id: randomUUID(),
        workflowId: wf3.id,
        version: 1,
        graph: g3,
        createdAt: hoursAgo(168),
        note: 'Initial version',
        author: 'admin@example.com',
      },
    ]);
    this.executions.push(...seedExecutions(wf3.id, wf3.name, g3, 5));

    // Sort executions newest-first
    this.executions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    // Seed queue
    this.queue.push({
      id: randomUUID(),
      workflowId: wf1.id,
      workflowName: wf1.name,
      triggerType: 'EVENT',
      input: { productId: 'P-001234' },
      priority: 1,
      enqueuedAt: minutesAgo(2),
      attempts: 0,
      maxAttempts: 3,
      status: 'QUEUED',
    });

    // Seed DLQ
    this.dlq.push({
      id: randomUUID(),
      workflowId: wf2.id,
      workflowName: wf2.name,
      triggerType: 'WEBHOOK',
      input: { customerId: 'C-999' },
      priority: 1,
      enqueuedAt: minutesAgo(45),
      attempts: 3,
      maxAttempts: 3,
      lastError: 'Customer record missing email address',
      status: 'FAILED',
    });
  }

  nextVersion(workflowId: string): number {
    const versions = this.versions.get(workflowId) ?? [];
    return versions.length + 1;
  }
}

export const orchestratorStore = new OrchestratorStore();
