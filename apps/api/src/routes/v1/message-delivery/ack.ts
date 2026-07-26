import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { messageDeliveryStore } from '../../../modules/message-delivery/message-delivery-store.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { verifyRequestSignature } from '../../../modules/runtime-registration/signature.js';
import { canonicalAckPayload } from '../../../modules/message-delivery/message-signature.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

interface AcknowledgeBody {
  messageId?: string;
  runtimeId?: string;
  timestamp?: string;
  signature?: string;
}

export function registerMessageAckRoute(router: Router): void {
  router.post('/messages/ack', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as AcknowledgeBody | undefined) ?? {};
    const { messageId, runtimeId, timestamp, signature } = body;
    if (!messageId || !runtimeId || !timestamp || !signature) {
      return apiError(
        res,
        'messageId, runtimeId, timestamp, and signature are required',
        422,
        'VALIDATION_ERROR'
      );
    }

    const runtime = runtimeRegistrationStore.getRuntime(runtimeId);
    if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
      return apiError(res, `Runtime is ${runtime.status.toLowerCase()}`, 403, 'RUNTIME_NOT_ACTIVE');
    }

    const timestampMs = new Date(timestamp).getTime();
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS) {
      return apiError(res, 'Timestamp outside acceptable window', 401, 'REPLAY_REJECTED');
    }
    if (messageDeliveryStore.isReplayedAckSignature(messageId, signature)) {
      return apiError(
        res,
        'This exact acknowledgement was already processed',
        401,
        'REPLAY_REJECTED'
      );
    }

    const payload = canonicalAckPayload({ messageId, runtimeId, timestamp });
    if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
      return apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
    }

    const result = messageDeliveryStore.acknowledge(messageId, runtimeId, signature);
    if (!result.ok) {
      const status = result.error === 'MESSAGE_NOT_FOUND' ? 404 : 409;
      return apiError(res, `Acknowledgement rejected: ${result.error}`, status, result.error);
    }

    adminIdentityStore.recordAudit({
      action: 'MESSAGE_ACKNOWLEDGED',
      actorEmail: 'runtime-installer@system',
      target: messageId,
      metadata: { runtimeId, alreadyAcknowledged: result.alreadyAcknowledged },
    });
    json(res, {
      message: messageDeliveryStore.toDTO(result.message),
      alreadyAcknowledged: result.alreadyAcknowledged,
    });
  });
}
