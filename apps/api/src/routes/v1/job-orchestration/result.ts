import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { jobOrchestrationStore } from '../../../modules/job-orchestration/job-orchestration-store.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';
import { verifyRequestSignature } from '../../../modules/runtime-registration/signature.js';
import { canonicalJobResultPayload } from '../../../modules/job-orchestration/job-signature.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';

const REPLAY_TOLERANCE_MS = 5 * 60_000;

interface ReportResultBody {
  jobId?: string;
  runtimeId?: string;
  outcome?: 'success' | 'failure';
  result?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
  signature?: string;
}

export function registerJobResultRoute(router: Router): void {
  router.post('/jobs/result', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as ReportResultBody | undefined) ?? {};
    const { jobId, runtimeId, outcome, result, error, timestamp, signature } = body;
    if (!jobId || !runtimeId || !outcome || !timestamp || !signature) {
      return apiError(
        res,
        'jobId, runtimeId, outcome, timestamp, and signature are required',
        422,
        'VALIDATION_ERROR'
      );
    }
    if (outcome !== 'success' && outcome !== 'failure') {
      return apiError(res, 'outcome must be "success" or "failure"', 422, 'VALIDATION_ERROR');
    }

    const runtime = await runtimeRegistrationStore.getRuntime(runtimeId);
    if (!runtime) return apiError(res, 'Runtime not found', 404, 'NOT_FOUND');
    if (runtime.status === 'BLOCKED' || runtime.status === 'REVOKED') {
      return apiError(res, `Runtime is ${runtime.status.toLowerCase()}`, 403, 'RUNTIME_NOT_ACTIVE');
    }

    const timestampMs = new Date(timestamp).getTime();
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > REPLAY_TOLERANCE_MS) {
      return apiError(res, 'Timestamp outside acceptable window', 401, 'REPLAY_REJECTED');
    }
    if (jobOrchestrationStore.isReplayedResultSignature(jobId, signature)) {
      return apiError(
        res,
        'This exact result report was already processed',
        401,
        'REPLAY_REJECTED'
      );
    }

    const payload = canonicalJobResultPayload({
      jobId,
      runtimeId,
      outcome,
      result,
      error,
      timestamp,
    });
    if (!verifyRequestSignature(payload, signature, runtime.publicKey)) {
      return apiError(res, 'Invalid request signature', 401, 'INVALID_SIGNATURE');
    }

    const reported = jobOrchestrationStore.reportResult(
      jobId,
      runtimeId,
      outcome,
      { result, error },
      signature
    );
    if (!reported.ok) {
      const status = reported.error === 'JOB_NOT_FOUND' ? 404 : 409;
      return apiError(res, `Report rejected: ${reported.error}`, status, reported.error);
    }

    adminIdentityStore.recordAudit({
      action: 'JOB_RESULT_REPORTED',
      actorEmail: 'runtime-installer@system',
      target: jobId,
      metadata: { runtimeId, outcome, alreadyReported: reported.alreadyReported },
    });
    json(res, {
      job: jobOrchestrationStore.toDTO(reported.job),
      alreadyReported: reported.alreadyReported,
    });
  });
}
