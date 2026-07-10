import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { wbStore } from '../../../modules/workflow-builder/wb-store.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import type { WorkflowGraph } from '../../../modules/orchestrator/types.js';

export async function rollbackWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const workflowId = ctx.params['id']!;
  const version = parseInt(ctx.params['version'] ?? '0', 10);

  const wf = orchestratorStore.workflows.get(workflowId);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }

  const rec = wbStore.getVersion(workflowId, version);
  if (!rec) {
    apiError(res, `Version ${version} not found`, 404, 'NOT_FOUND');
    return;
  }

  // Save current graph as a new version before overwriting
  wbStore.addVersion(
    workflowId,
    wf.graph as unknown as import('@seltriva/workflow-builder').WorkflowGraph,
    `Auto-saved before rollback to v${version}`,
    'system'
  );

  wf.graph = rec.graph as unknown as WorkflowGraph;
  wf.version = wf.version + 1;
  wf.updatedAt = new Date().toISOString();

  orchestratorStore.workflows.set(workflowId, wf);
  json(res, { success: true, rolledBackTo: version, newVersion: wf.version, workflow: wf });
}
