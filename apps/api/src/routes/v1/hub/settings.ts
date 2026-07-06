import type { ServerResponse }   from 'node:http';
import type { RouteContext }     from '../../../http/router.js';
import { json }                  from '../../../http/router.js';
import { hubStore }              from './hub-store.js';

export async function hubGetSettings(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, hubStore.settings);
}

export async function hubUpdateSettings(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const patch = ctx.body as Partial<typeof hubStore.settings>;
  if (patch && typeof patch === 'object') {
    if (patch.sync)          hubStore.settings.sync          = { ...hubStore.settings.sync,          ...patch.sync };
    if (patch.cache)         hubStore.settings.cache         = { ...hubStore.settings.cache,         ...patch.cache };
    if (patch.discovery)     hubStore.settings.discovery     = { ...hubStore.settings.discovery,     ...patch.discovery };
    if (patch.notifications) hubStore.settings.notifications = { ...hubStore.settings.notifications, ...patch.notifications };
  }
  json(res, hubStore.settings);
}
