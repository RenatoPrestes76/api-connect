import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { messageDeliveryStore } from '../../../modules/message-delivery/message-delivery-store.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { verifyRequestSignature } from '../../../modules/runtime-registration/signature.js';
import { canonicalPendingPollPayload } from '../../../modules/message-delivery/message-signature.js';
import type { MessageStatus } from '../../../modules/message-delivery/types.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

const adminListHandler = requirePermission('message-delivery.read')(async (
  ctx: RouteContext,
  res: ServerResponse
) => {
  const organizationId = ctx.query.get('organizationId') ?? undefined;
  const runtimeId = ctx.query.get('runtimeId') ?? undefined;
  const status = (ctx.query.get('status') as MessageStatus | null) ?? undefined;
  const messages = messageDeliveryStore.listMessages({ organizationId, runtimeId, status });
  json(res, {
    total: messages.length,
    messages: messages.map((m) => messageDeliveryStore.toDTO(m)),
  });
});

/**
 * GET /messages/pending serves two audiences on the one path the spec lists:
 * a Runtime polling its own queue (runtimeId + timestamp + signature query
 * params, Ed25519-signed exactly like GET /runtime/jobs) — which transitions
 * eligible QUEUED messages to SENT and also returns anything already in
 * flight for that Runtime so a restarted Runtime can recover its own
 * in-progress work — or, absent those params, an authenticated admin with
 * message-delivery.read gets a read-only cross-organization listing.
 */
export function registerMessagePendingRoute(router: Router): void {
  router.get('/messages/pending', async (ctx: RouteContext, res: ServerResponse) => {
    const runtimeId = ctx.query.get('runtimeId');
    const timestamp = ctx.query.get('timestamp');
    const signature = ctx.query.get('signature');

    if (runtimeId && timestamp && signature) {
      const runtime = runtimeRegistrationStore.getRuntime(runtimeId);
      if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
      if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
        return apiError(
          res,
          `Runtime is ${runtime.status.toLowerCase()}`,
          403,
          'RUNTIME_NOT_ACTIVE'
        );
      }

      const timestampMs = new Date(timestamp).getTime();
      if (
        !Number.isFinite(timestampMs) ||
        Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS
      ) {
        return apiError(res, 'Timestamp outside acceptable window', 401, 'REPLAY_REJECTED');
      }

      const payload = canonicalPendingPollPayload({ runtimeId, timestamp });
      if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
        return apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
      }

      const messages = messageDeliveryStore.pollPendingForRuntime(runtimeId);
      return json(res, {
        total: messages.length,
        messages: messages.map((m) => messageDeliveryStore.toDTO(m)),
      });
    }

    return adminListHandler(ctx, res);
  });
}
