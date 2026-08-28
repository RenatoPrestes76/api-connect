import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { messageDeliveryStore } from '../../../modules/message-delivery/message-delivery-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { MessageType, SendMessageError } from '../../../modules/message-delivery/types.js';

interface SendMessageBody {
  organizationId?: string;
  runtimeId?: string;
  jobId?: string;
  resourceKey?: string;
  messageType?: MessageType;
  payload?: Record<string, unknown>;
  correlationId?: string;
  traceId?: string;
  maxDeliveryAttempts?: number;
  ackTimeoutMs?: number;
  ttlMs?: number;
}

const SEND_ERROR_STATUS: Record<SendMessageError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  RUNTIME_ORGANIZATION_MISMATCH: {
    status: 403,
    message: 'This Runtime does not belong to the given organizationId',
  },
};

export function registerMessageSendRoute(router: Router): void {
  router.post(
    '/messages/send',
    requirePermission('message-delivery.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as SendMessageBody | undefined) ?? {};
      const { organizationId, runtimeId, messageType } = body;
      if (!organizationId || !runtimeId || !messageType) {
        return apiError(
          res,
          'organizationId, runtimeId, and messageType are required',
          422,
          'VALIDATION_ERROR'
        );
      }

      const result = await messageDeliveryStore.sendMessage({
        organizationId,
        runtimeId,
        jobId: body.jobId,
        resourceKey: body.resourceKey,
        messageType,
        payload: body.payload,
        correlationId: body.correlationId,
        traceId: body.traceId,
        maxDeliveryAttempts: body.maxDeliveryAttempts,
        ackTimeoutMs: body.ackTimeoutMs,
        ttlMs: body.ttlMs,
      });
      if (!result.ok) {
        const mapped = SEND_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'MESSAGE_ENQUEUED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.message.id,
        metadata: { runtimeId, messageType, organizationId, jobId: body.jobId },
      });
      json(res, { message: messageDeliveryStore.toDTO(result.message) }, 201);
    })
  );
}
