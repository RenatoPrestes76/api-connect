import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { hubStore } from './hub-store.js';

export async function hubListConnectors(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, [...hubStore.connectors.values()]);
}

export async function hubGetConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const c = hubStore.connectors.get(ctx.params['id']!);
  if (!c) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, c);
}

export async function hubStartConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const c = hubStore.connectors.get(ctx.params['id']!);
  if (!c) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }
  if (c.status === 'RUNNING') {
    apiError(res, 'Already running', 409, 'INVALID_STATE');
    return;
  }
  c.status = 'RUNNING';
  c.health = 'healthy';
  json(res, c);
}

export async function hubStopConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const c = hubStore.connectors.get(ctx.params['id']!);
  if (!c) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }
  if (c.status === 'STOPPED') {
    apiError(res, 'Already stopped', 409, 'INVALID_STATE');
    return;
  }
  c.status = 'STOPPED';
  json(res, c);
}

export async function hubRestartConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const c = hubStore.connectors.get(ctx.params['id']!);
  if (!c) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }
  c.status = 'RUNNING';
  c.health = 'healthy';
  c.lastSync = new Date().toISOString();
  json(res, c);
}
