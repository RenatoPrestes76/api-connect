import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { wbStore } from '../../../modules/workflow-builder/wb-store.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import type { WorkflowGraph as OrchestratorGraph } from '../../../modules/orchestrator/types.js';
import type { WorkflowGraph } from '@seltriva/workflow-builder';

export async function listWorkflowVersions(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const workflowId = ctx.params['id']!;
  const wf = orchestratorStore.workflows.get(workflowId);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, wbStore.listVersions(workflowId));
}

export async function saveWorkflowVersion(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const workflowId = ctx.params['id']!;
  const wf = orchestratorStore.workflows.get(workflowId);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }

  const body = ctx.body as { note?: string; author?: string } | undefined;
  const rec = wbStore.addVersion(
    workflowId,
    wf.graph as unknown as WorkflowGraph,
    body?.note,
    body?.author ?? 'system'
  );
  json(res, rec, 201);
}
