import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { hubStore } from './hub-store.js';

export async function hubListAgents(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, [...hubStore.agents.values()]);
}

export async function hubGetAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const a = hubStore.agents.get(ctx.params['id']!);
  if (!a) {
    apiError(res, 'Agent not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, a);
}

export async function hubRestartAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const a = hubStore.agents.get(ctx.params['id']!);
  if (!a) {
    apiError(res, 'Agent not found', 404, 'NOT_FOUND');
    return;
  }
  a.status = 'ONLINE';
  a.lastSeen = new Date().toISOString();
  json(res, a);
}
