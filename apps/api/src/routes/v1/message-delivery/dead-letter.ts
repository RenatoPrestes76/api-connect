import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { messageDeliveryStore } from '../../../modules/message-delivery/message-delivery-store.js';

export function registerMessageDeadLetterRoute(router: Router): void {
  router.get(
    '/messages/dead-letter',
    requirePermission('message-delivery.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const runtimeId = ctx.query.get('runtimeId') ?? undefined;
      const entries = messageDeliveryStore.listDeadLetters({ organizationId, runtimeId });
      json(res, { total: entries.length, entries });
    })
  );
}
