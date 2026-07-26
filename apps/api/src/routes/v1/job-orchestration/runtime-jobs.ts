import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { jobOrchestrationStore } from '../../../modules/job-orchestration/job-orchestration-store.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { verifyRequestSignature } from '../../../modules/runtime-registration/signature.js';
import { canonicalClaimJobsPayload } from '../../../modules/job-orchestration/job-signature.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

/**
 * GET /runtime/jobs — the Runtime polls for its own queued work, proving its
 * identity with the same Ed25519 signature scheme as heartbeat/job-result.
 * No exact-signature replay cache here (unlike /jobs/result): claiming is
 * naturally idempotent — replaying an old claim request just re-returns
 * whatever is still QUEUED/RETRYING, it can't re-claim jobs already
 * DISPATCHED, so there's no duplicate-side-effect risk to guard against.
 */
export function registerRuntimeJobsRoute(router: Router): void {
  router.get('/runtime/jobs', async (ctx: RouteContext, res: ServerResponse) => {
    const runtimeId = ctx.query.get('runtimeId');
    const timestamp = ctx.query.get('timestamp');
    const signature = ctx.query.get('signature');
    if (!runtimeId || !timestamp || !signature) {
      return apiError(
        res,
        'runtimeId, timestamp, and signature query params are required',
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

    const payload = canonicalClaimJobsPayload({ runtimeId, timestamp });
    if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
      return apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
    }

    const jobs = jobOrchestrationStore.claimJobsForRuntime(runtimeId);
    json(res, { total: jobs.length, jobs: jobs.map((j) => jobOrchestrationStore.toDTO(j)) });
  });
}
