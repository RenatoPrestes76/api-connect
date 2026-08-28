import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import {
  verifyRequestSignature,
  canonicalHeartbeatPayload,
} from '../../../modules/runtime-registration/signature.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { classifyLiveness } from '../../../modules/runtime-registration/liveness.js';
import type { HeartbeatInput } from '../../../modules/runtime-registration/types.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000; // 5 minutes

export async function runtimeHeartbeatHandler(
  ctx: RouteContext,
  res: ServerResponse
): Promise<void> {
  const body = ctx.body as Partial<HeartbeatInput> | undefined;
  const required: Array<keyof HeartbeatInput> = [
    'runtimeId',
    'version',
    'memory',
    'cpu',
    'timestamp',
    'signature',
  ];
  const missing = required.filter((k) => body?.[k] === undefined || body?.[k] === null);
  if (missing.length > 0) {
    apiError(res, `Missing required fields: ${missing.join(', ')}`, 422, 'VALIDATION_ERROR');
    return;
  }

  const input = body as HeartbeatInput;
  const runtime = await runtimeRegistrationStore.getRuntime(input.runtimeId);
  if (!runtime) {
    apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
    return;
  }
  if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
    apiError(res, `Runtime is ${runtime.status.toLowerCase()}`, 403, 'RUNTIME_NOT_ACTIVE');
    return;
  }

  const timestampMs = new Date(input.timestamp).getTime();
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS) {
    apiError(res, 'Heartbeat timestamp outside acceptable window', 401, 'REPLAY_REJECTED');
    return;
  }
  if (await runtimeRegistrationStore.isReplayedSignature(input.runtimeId, input.signature)) {
    apiError(res, 'This exact heartbeat request was already processed', 401, 'REPLAY_REJECTED');
    return;
  }

  const payload = canonicalHeartbeatPayload({
    runtimeId: input.runtimeId,
    version: input.version,
    memory: input.memory,
    cpu: input.cpu,
    status: input.status,
    timestamp: input.timestamp,
  });
  if (!verifyRequestSignature(payload, input.signature, runtime.publicKey)) {
    apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
    return;
  }

  const wasActivating = runtime.status === 'REGISTERED' || runtime.status === 'PENDING';
  const updated = await runtimeRegistrationStore.recordHeartbeat(input.runtimeId, {
    version: input.version,
    status: input.status,
    signature: input.signature,
    memory: input.memory,
    cpu: input.cpu,
    uptimeSeconds: input.uptimeSeconds,
    capabilities: input.capabilities,
  });
  if (!updated) {
    apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
    return;
  }

  if (wasActivating && updated.status === 'ACTIVE') {
    adminIdentityStore.recordAudit({
      action: 'RUNTIME_ACTIVATED',
      actorEmail: 'runtime-installer@system',
      target: updated.id,
      metadata: { organizationId: updated.organizationId },
    });
  }

  json(res, {
    data: {
      runtimeId: updated.id,
      status: updated.status,
      capabilities: updated.capabilities,
      lastHeartbeat: updated.lastHeartbeat,
      liveness: classifyLiveness(updated.lastHeartbeat, new Date()),
    },
  });
}
