import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { workflowValidator } from '@seltriva/workflow-builder';
import type { WorkflowGraph } from '@seltriva/workflow-builder';

export async function validateWorkflow(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { graph?: WorkflowGraph } | undefined;
  if (!body?.graph) {
    apiError(res, 'graph is required', 400, 'VALIDATION_ERROR');
    return;
  }
  const result = workflowValidator.validate(body.graph);
  json(res, result);
}
