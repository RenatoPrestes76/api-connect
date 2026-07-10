/**
 * Sprint 29 — ORCHESTRATOR
 * Workflow CRUD + versioning + activation routes.
 */
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import { scheduler } from '../../../modules/orchestrator/scheduler.js';
import { executeWorkflow } from '../../../modules/orchestrator/execution-engine.js';
import type { Workflow, WorkflowGraph, TriggerType } from '../../../modules/orchestrator/types.js';

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listWorkflows(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const workflows = [...orchestratorStore.workflows.values()];
  json(res, workflows);
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, wf);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as
    | {
        name?: string;
        description?: string;
        triggerType?: TriggerType;
        graph?: WorkflowGraph;
        tags?: string[];
      }
    | undefined;

  if (!body?.name || !body.triggerType) {
    apiError(res, 'name and triggerType are required', 400, 'VALIDATION_ERROR');
    return;
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const graph: WorkflowGraph = body.graph ?? {
    nodes: [
      {
        id: randomUUID(),
        type: 'trigger',
        label: 'Trigger',
        config: { triggerType: body.triggerType },
        position: { x: 250, y: 50 },
      },
    ],
    edges: [],
  };

  const wf: Workflow = {
    id,
    name: body.name,
    description: body.description ?? '',
    active: false,
    version: 1,
    graph,
    triggerType: body.triggerType,
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    tags: body.tags ?? [],
  };

  orchestratorStore.workflows.set(id, wf);
  orchestratorStore.versions.set(id, [
    {
      id: randomUUID(),
      workflowId: id,
      version: 1,
      graph,
      createdAt: now,
      note: 'Initial version',
      author: 'admin',
    },
  ]);

  json(res, wf, 201);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }

  const body = ctx.body as
    | (Partial<Workflow> & { graph?: WorkflowGraph; note?: string })
    | undefined;
  if (!body) {
    json(res, wf);
    return;
  }

  const graphChanged = body.graph && JSON.stringify(body.graph) !== JSON.stringify(wf.graph);

  if (body.name !== undefined) wf.name = body.name;
  if (body.description !== undefined) wf.description = body.description;
  if (body.tags !== undefined) wf.tags = body.tags;
  if (body.graph !== undefined) wf.graph = body.graph;

  if (graphChanged) {
    const nextVer = orchestratorStore.nextVersion(wf.id);
    wf.version = nextVer;
    const versions = orchestratorStore.versions.get(wf.id) ?? [];
    versions.push({
      id: randomUUID(),
      workflowId: wf.id,
      version: nextVer,
      graph: wf.graph,
      createdAt: new Date().toISOString(),
      note: body.note ?? `Version ${nextVer}`,
      author: 'admin',
    });
    orchestratorStore.versions.set(wf.id, versions);
  }

  wf.updatedAt = new Date().toISOString();
  json(res, wf);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const id = ctx.params['id']!;
  if (!orchestratorStore.workflows.has(id)) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  scheduler.unschedule(id);
  orchestratorStore.workflows.delete(id);
  orchestratorStore.versions.delete(id);
  res.writeHead(204);
  res.end();
}

// ─── Activate / Deactivate ───────────────────────────────────────────────────

export async function activateWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  wf.active = true;
  wf.updatedAt = new Date().toISOString();
  if (wf.triggerType === 'CRON') scheduler.schedule(wf);
  json(res, wf);
}

export async function deactivateWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  wf.active = false;
  wf.updatedAt = new Date().toISOString();
  scheduler.unschedule(wf.id);
  json(res, wf);
}

// ─── Run (manual trigger) ─────────────────────────────────────────────────────

export async function runWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }

  const body = ctx.body as { input?: Record<string, unknown> } | undefined;
  const input = body?.input ?? {};

  // Fire-and-forget: start execution asynchronously
  void executeWorkflow(wf, input, 'MANUAL');

  // Return the pending execution (head of the list after enqueue)
  const exec = orchestratorStore.executions[0];
  json(res, exec ?? { workflowId: wf.id, status: 'PENDING' }, 202);
}

// ─── Versions ────────────────────────────────────────────────────────────────

export async function listWorkflowVersions(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const id = ctx.params['id']!;
  if (!orchestratorStore.workflows.has(id)) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  const versions = orchestratorStore.versions.get(id) ?? [];
  json(res, versions);
}
