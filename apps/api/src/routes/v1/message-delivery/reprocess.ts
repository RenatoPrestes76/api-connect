import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { messageDeliveryStore } from '../../../modules/message-delivery/message-delivery-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';

interface ReprocessBody {
  messageId?: string;
}

export function registerMessageReprocessRoute(router: Router): void {
  router.post(
    '/messages/reprocess',
    requirePermission('message-delivery.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as ReprocessBody | undefined) ?? {};
      const { messageId } = body;
      if (!messageId) {
        return apiError(res, 'messageId is required', 422, 'VALIDATION_ERROR');
      }

      const result = messageDeliveryStore.reprocessMessage(messageId);
      if (!result.ok) {
        return apiError(res, 'Dead-letter entry not found for this messageId', 404, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'MESSAGE_REPROCESSED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: messageId,
      });
      json(res, { message: messageDeliveryStore.toDTO(result.message) });
    })
  );
}
