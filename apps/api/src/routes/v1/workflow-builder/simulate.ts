import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import { workflowSimulator } from '@seltriva/workflow-builder';
import type { WorkflowGraph } from '@seltriva/workflow-builder';

export async function simulateWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const wf = orchestratorStore.workflows.get(ctx.params['id']!);
  if (!wf) {
    apiError(res, 'Workflow not found', 404, 'NOT_FOUND');
    return;
  }

  const body = ctx.body as { input?: Record<string, unknown> } | undefined;
  const input = body?.input ?? {};

  const graph = wf.graph as unknown as WorkflowGraph;
  const result = workflowSimulator.simulate(graph, input);

  json(res, result);
}
