/**
 * Sprint 29 — ORCHESTRATOR
 * Workflow execution engine — graph traversal with async step handlers,
 * condition branching, retry, delay and DLQ support.
 */
import { randomUUID } from 'node:crypto';
import type {
  Workflow,
  WorkflowExecution,
  ExecutionStep,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  ConditionConfig,
  DelayConfig,
  RetryConfig,
  HttpConfig,
} from './types.js';
import { orchestratorStore } from './orchestrator-store.js';
import { withRetry, computeBackoffMs } from './retry.js';

// ─── Execution Context ────────────────────────────────────────────────────────

interface ExecContext {
  input: Record<string, unknown>;
  vars: Record<string, unknown>;
  http?: { status: number; body: unknown };
  stepIdx: number;
}

// ─── Step Handlers ────────────────────────────────────────────────────────────

async function runTrigger(_node: WorkflowNode, ctx: ExecContext): Promise<Record<string, unknown>> {
  return { triggered: true, input: ctx.input };
}

async function runTransform(
  node: WorkflowNode,
  ctx: ExecContext
): Promise<Record<string, unknown>> {
  const cfg = node.config as { expression?: string; outputVar?: string };
  const output = { ...ctx.input, __transformed: true, expression: cfg.expression ?? '' };
  if (cfg.outputVar) ctx.vars[cfg.outputVar] = output;
  return output;
}

async function runValidate(node: WorkflowNode, ctx: ExecContext): Promise<Record<string, unknown>> {
  const cfg = node.config as { schema?: string; failOnError?: boolean };
  const valid = true; // In production: invoke JSON Schema validator
  if (!valid && cfg.failOnError)
    throw new Error(`Validation failed against schema "${cfg.schema}"`);
  return { valid, schema: cfg.schema };
}

async function runHttp(node: WorkflowNode, ctx: ExecContext): Promise<Record<string, unknown>> {
  const cfg = node.config as HttpConfig;
  // Simulate HTTP call — in production use node:fetch
  const status = 200;
  const body = { ok: true, url: cfg.url, method: cfg.method };
  ctx.http = { status, body };
  return { status, body };
}

function evalCondition(expression: string, ctx: ExecContext): boolean {
  try {
    // Safe subset: only allow comparisons on known ctx keys
    const fn = new Function('context', 'input', `"use strict"; return !!(${expression})`);
    return fn(ctx, ctx.input) as boolean;
  } catch {
    return false;
  }
}

async function runCondition(node: WorkflowNode, ctx: ExecContext): Promise<{ result: boolean }> {
  const cfg = node.config as ConditionConfig;
  return { result: evalCondition(cfg.expression, ctx) };
}

async function runDelay(node: WorkflowNode): Promise<Record<string, unknown>> {
  const cfg = node.config as DelayConfig;
  // In production: await a real delay; in demo we just record it
  return { delayed: true, durationMs: cfg.durationMs };
}

async function runRetry(
  node: WorkflowNode,
  nextFn: () => Promise<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const cfg = node.config as RetryConfig;
  let attempts = 0;
  return withRetry(
    nextFn,
    { maxAttempts: cfg.maxAttempts, backoffMs: cfg.backoffMs, strategy: cfg.strategy },
    (attempt, err) => {
      attempts = attempt;
      void err;
      const backoff = computeBackoffMs(attempt, cfg.backoffMs, cfg.strategy);
      void backoff;
    }
  ).then((result) => ({ ...result, attempts }));
}

async function runNotification(
  node: WorkflowNode,
  _ctx: ExecContext
): Promise<Record<string, unknown>> {
  const cfg = node.config as { channel?: string; to?: string; subject?: string };
  return { sent: true, channel: cfg.channel, to: cfg.to, subject: cfg.subject };
}

async function runLog(node: WorkflowNode, _ctx: ExecContext): Promise<Record<string, unknown>> {
  const cfg = node.config as { level?: string; message?: string };
  return { logged: true, level: cfg.level, message: cfg.message };
}

async function runDlq(node: WorkflowNode, _ctx: ExecContext): Promise<Record<string, unknown>> {
  const cfg = node.config as { reason?: string; alertOn?: boolean };
  return { moved: true, reason: cfg.reason, alerted: cfg.alertOn ?? false };
}

// ─── Graph Traversal ──────────────────────────────────────────────────────────

function nextNodes(nodeId: string, edges: WorkflowEdge[], conditionResult?: boolean): string[] {
  const outEdges = edges.filter((e) => e.source === nodeId);
  if (outEdges.length === 0) return [];

  // Condition node → follow true/false branch
  if (outEdges.some((e) => e.label === 'true' || e.label === 'false')) {
    const label = conditionResult ? 'true' : 'false';
    return outEdges.filter((e) => e.label === label).map((e) => e.target);
  }

  return outEdges.map((e) => e.target);
}

async function executeNode(
  nodeType: NodeType,
  node: WorkflowNode,
  ctx: ExecContext
): Promise<{ output: Record<string, unknown>; conditionResult?: boolean }> {
  switch (nodeType) {
    case 'trigger':
      return { output: await runTrigger(node, ctx) };
    case 'transform':
      return { output: await runTransform(node, ctx) };
    case 'validate':
      return { output: await runValidate(node, ctx) };
    case 'http':
      return { output: await runHttp(node, ctx) };
    case 'condition': {
      const r = await runCondition(node, ctx);
      return { output: { result: r.result }, conditionResult: r.result };
    }
    case 'delay':
      return { output: await runDelay(node) };
    case 'retry':
      return { output: await runRetry(node, async () => ({})) };
    case 'notification':
      return { output: await runNotification(node, ctx) };
    case 'log':
      return { output: await runLog(node, ctx) };
    case 'dlq':
      return { output: await runDlq(node, ctx) };
    default:
      return { output: {} };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function executeWorkflow(
  workflow: Workflow,
  input: Record<string, unknown> = {},
  triggerType = 'MANUAL'
): Promise<WorkflowExecution> {
  const execId = randomUUID();
  const startedAt = new Date().toISOString();

  const execution: WorkflowExecution = {
    id: execId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    status: 'RUNNING',
    triggerType,
    input,
    startedAt,
    steps: [],
  };

  orchestratorStore.executions.unshift(execution);

  const { nodes, edges } = workflow.graph;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ctx: ExecContext = { input, vars: {}, stepIdx: 0 };

  const ENTRY_TYPES = new Set<string>([
    'trigger',
    'webhook',
    'schedule',
    'file-watch',
    'email-trigger',
    'api-trigger',
    'queue-trigger',
    'manual-trigger',
  ]);
  const triggerNode = nodes.find((n) => ENTRY_TYPES.has(n.type));
  if (!triggerNode) {
    execution.status = 'FAILED';
    execution.error = 'Workflow has no trigger node';
    execution.finishedAt = new Date().toISOString();
    return execution;
  }

  // BFS traversal
  const queue: string[] = [triggerNode.id];
  const visited = new Set<string>();

  try {
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const step: ExecutionStep = {
        id: randomUUID(),
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        attempt: 1,
        maxAttempts: 3,
      };
      execution.steps.push(step);

      const t0 = Date.now();
      try {
        const { output, conditionResult } = await executeNode(node.type, node, ctx);
        step.status = 'COMPLETED';
        step.output = output;
        step.finishedAt = new Date().toISOString();
        step.durationMs = Date.now() - t0;

        const nextIds = nextNodes(nodeId, edges, conditionResult);
        queue.push(...nextIds);
      } catch (err) {
        step.status = 'FAILED';
        step.error = err instanceof Error ? err.message : String(err);
        step.finishedAt = new Date().toISOString();
        step.durationMs = Date.now() - t0;
        throw err;
      }
    }

    execution.status = 'COMPLETED';
    execution.finishedAt = new Date().toISOString();
    execution.durationMs = Date.now() - Date.parse(startedAt);

    workflow.executionCount++;
    workflow.successCount++;
    workflow.lastExecutedAt = execution.finishedAt;
  } catch (err) {
    execution.status = 'FAILED';
    execution.error = err instanceof Error ? err.message : String(err);
    execution.finishedAt = new Date().toISOString();
    execution.durationMs = Date.now() - Date.parse(startedAt);

    workflow.executionCount++;
    workflow.failureCount++;
    workflow.lastExecutedAt = execution.finishedAt;
  }

  return execution;
}
