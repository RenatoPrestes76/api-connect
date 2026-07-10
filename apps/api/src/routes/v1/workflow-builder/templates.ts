import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { wbStore } from '../../../modules/workflow-builder/wb-store.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';
import type { TriggerType } from '../../../modules/orchestrator/types.js';

export async function listTemplates(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const category = ctx.query.get('category') ?? undefined;
  json(res, wbStore.listTemplates(category));
}

export async function getTemplateById(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tpl = wbStore.getTemplate(ctx.params['id']!);
  if (!tpl) {
    apiError(res, 'Template not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, tpl);
}

export async function useTemplate(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tpl = wbStore.getTemplate(ctx.params['id']!);
  if (!tpl) {
    apiError(res, 'Template not found', 404, 'NOT_FOUND');
    return;
  }

  const body = ctx.body as { name?: string; description?: string } | undefined;
  const now = new Date().toISOString();
  const wf = {
    id: randomUUID(),
    name: body?.name ?? tpl.name,
    description: body?.description ?? tpl.description,
    active: false,
    version: 1,
    graph: tpl.graph,
    triggerType: 'MANUAL' as TriggerType,
    createdAt: now,
    updatedAt: now,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    tags: [...tpl.tags],
  };
  orchestratorStore.workflows.set(wf.id, wf);
  json(res, wf, 201);
}
