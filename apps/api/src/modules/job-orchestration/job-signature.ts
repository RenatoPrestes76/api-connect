/**
 * Canonical payload builders for the two Runtime-signed job-orchestration
 * requests. Signature verification itself reuses
 * modules/runtime-registration/signature.ts's verifyRequestSignature — only
 * the shape of what gets signed is specific to this module.
 */

export function canonicalJobResultPayload(input: {
  jobId: string;
  runtimeId: string;
  outcome: 'success' | 'failure';
  result?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}): string {
  return JSON.stringify({
    jobId: input.jobId,
    runtimeId: input.runtimeId,
    outcome: input.outcome,
    result: input.result ?? null,
    error: input.error ?? null,
    timestamp: input.timestamp,
  });
}

export function canonicalClaimJobsPayload(input: { runtimeId: string; timestamp: string }): string {
  return JSON.stringify({ runtimeId: input.runtimeId, timestamp: input.timestamp });
}
