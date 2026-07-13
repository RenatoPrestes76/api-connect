import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { hubStore } from './hub-store.js';

export async function hubListDatabases(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, [...hubStore.databases.values()]);
}

export async function hubGetDatabase(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const d = hubStore.databases.get(ctx.params['id']!);
  if (!d) {
    apiError(res, 'Database not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, d);
}
