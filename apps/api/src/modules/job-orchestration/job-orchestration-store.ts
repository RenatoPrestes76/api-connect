import { randomUUID } from 'node:crypto';
import { runtimeRegistrationStore } from '../runtime-registration/runtime-registration-store.js';
import { computeBackoffDelayMs, DEFAULT_MAX_ATTEMPTS, DEFAULT_TIMEOUT_MS } from './retry-policy.js';
import type {
  JobRecord,
  JobDTO,
  JobStatus,
  CreateJobInput,
  CreateJobError,
  CancelJobError,
  ReportResultError,
} from './types.js';
import { TERMINAL_JOB_STATUSES } from './types.js';

export type CreateJobResult = { ok: true; job: JobRecord } | { ok: false; error: CreateJobError };
export type CancelJobResult = { ok: true; job: JobRecord } | { ok: false; error: CancelJobError };
export type ReportResultResult =
  | { ok: true; job: JobRecord; alreadyReported: boolean }
  | { ok: false; error: ReportResultError };

let _instance: JobOrchestrationStore | null = null;

export class JobOrchestrationStore {
  private jobs: JobRecord[] = [];

  static getInstance(): JobOrchestrationStore {
    if (!_instance) _instance = new JobOrchestrationStore();
    return _instance;
  }

  // ─── Timeout / expiry (lazy — no background scheduler in this codebase) ──

  private evaluateTimeout(job: JobRecord): JobRecord {
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return job;
    const now = Date.now();

    if (job.status === 'QUEUED') {
      const elapsed = now - new Date(job.createdAt).getTime();
      if (elapsed > job.timeoutMs) {
        job.status = 'EXPIRED';
        job.finishedAt = new Date().toISOString();
      }
      return job;
    }

    if (job.status === 'DISPATCHED' || job.status === 'RUNNING') {
      const startedAt = job.startedAt ?? job.createdAt;
      const elapsed = now - new Date(startedAt).getTime();
      if (elapsed > job.timeoutMs) {
        this.recordFailure(job, 'Attempt timed out', 'timeout');
      }
      return job;
    }

    return job;
  }

  private recordFailure(job: JobRecord, error: string, outcome: 'failure' | 'timeout'): void {
    const now = new Date().toISOString();
    job.attempts += 1;
    job.history.push({
      attempt: job.attempts,
      startedAt: job.startedAt ?? job.createdAt,
      finishedAt: now,
      outcome,
      error,
    });
    job.lastError = error;

    if (job.attempts < job.maxAttempts) {
      job.status = 'RETRYING';
      const delayMs = computeBackoffDelayMs(job.attempts);
      job.scheduledAt = new Date(Date.now() + delayMs).toISOString();
      job.startedAt = null;
    } else {
      job.status = 'FAILED';
      job.finishedAt = now;
    }
  }

  // ─── Reads ───────────────────────────────────────────────────────────────

  getJob(id: string): JobRecord | undefined {
    const job = this.jobs.find((j) => j.id === id);
    return job ? this.evaluateTimeout(job) : undefined;
  }

  listJobs(
    filters: { organizationId?: string; runtimeId?: string; status?: JobStatus } = {}
  ): JobRecord[] {
    return this.jobs
      .map((j) => this.evaluateTimeout(j))
      .filter((j) => {
        if (filters.organizationId && j.organizationId !== filters.organizationId) return false;
        if (filters.runtimeId && j.runtimeId !== filters.runtimeId) return false;
        if (filters.status && j.status !== filters.status) return false;
        return true;
      });
  }

  toDTO(job: JobRecord): JobDTO {
    return {
      id: job.id,
      organizationId: job.organizationId,
      runtimeId: job.runtimeId,
      connectorId: job.connectorId,
      command: job.command,
      payload: job.payload,
      priority: job.priority,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdBy: job.createdBy,
      origin: job.origin,
      result: job.result,
      lastError: job.lastError,
      history: job.history,
      createdAt: job.createdAt,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  createJob(input: CreateJobInput): CreateJobResult {
    const runtime = runtimeRegistrationStore.getRuntime(input.runtimeId);
    if (!runtime) return { ok: false, error: 'RUNTIME_NOT_FOUND' };
    if (runtime.organizationId !== input.organizationId) {
      return { ok: false, error: 'RUNTIME_ORGANIZATION_MISMATCH' };
    }

    if (input.idempotencyKey) {
      const existing = this.jobs.find(
        (j) =>
          j.organizationId === input.organizationId && j.idempotencyKey === input.idempotencyKey
      );
      if (existing) return { ok: true, job: this.evaluateTimeout(existing) };
    }

    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      runtimeId: input.runtimeId,
      connectorId: input.connectorId ?? null,
      command: input.command,
      payload: input.payload ?? {},
      priority: input.priority ?? 'NORMAL',
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      idempotencyKey: input.idempotencyKey ?? null,
      createdBy: input.createdBy,
      origin: input.origin,
      result: null,
      lastError: null,
      history: [],
      createdAt: now,
      scheduledAt: now,
      startedAt: null,
      finishedAt: null,
      lastResultSignature: null,
    };
    this.jobs.push(job);
    return { ok: true, job };
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  cancelJob(id: string): CancelJobResult {
    const job = this.getJob(id);
    if (!job) return { ok: false, error: 'JOB_NOT_FOUND' };
    if (TERMINAL_JOB_STATUSES.includes(job.status)) {
      return { ok: false, error: 'JOB_ALREADY_TERMINAL' };
    }
    job.status = 'CANCELLED';
    job.finishedAt = new Date().toISOString();
    return { ok: true, job };
  }

  // ─── Claim (Runtime polls for its own work) ─────────────────────────────

  claimJobsForRuntime(runtimeId: string): JobRecord[] {
    const now = Date.now();
    const claimable = this.jobs
      .map((j) => this.evaluateTimeout(j))
      .filter(
        (j) =>
          j.runtimeId === runtimeId &&
          (j.status === 'QUEUED' || j.status === 'RETRYING') &&
          new Date(j.scheduledAt).getTime() <= now
      );

    const claimedAt = new Date().toISOString();
    for (const job of claimable) {
      job.status = 'DISPATCHED';
      job.startedAt = claimedAt;
    }
    return claimable;
  }

  // ─── Report result (idempotent) ─────────────────────────────────────────

  reportResult(
    jobId: string,
    runtimeId: string,
    outcome: 'success' | 'failure',
    data: { result?: Record<string, unknown>; error?: string },
    resultSignature: string
  ): ReportResultResult {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return { ok: false, error: 'JOB_NOT_FOUND' };
    if (job.runtimeId !== runtimeId) return { ok: false, error: 'RUNTIME_MISMATCH' };

    // Idempotency: the Runtime may resend the same result more than once
    // (e.g. after a network blip) — never re-process a terminal job.
    if (TERMINAL_JOB_STATUSES.includes(job.status)) {
      return { ok: true, job, alreadyReported: true };
    }

    const now = new Date().toISOString();
    if (outcome === 'success') {
      job.attempts += 1;
      job.history.push({
        attempt: job.attempts,
        startedAt: job.startedAt ?? job.createdAt,
        finishedAt: now,
        outcome: 'success',
        error: null,
      });
      job.status = 'SUCCESS';
      job.result = data.result ?? {};
      job.finishedAt = now;
      job.lastError = null;
    } else {
      this.recordFailure(job, data.error ?? 'Job execution failed', 'failure');
    }
    job.lastResultSignature = resultSignature;
    return { ok: true, job, alreadyReported: false };
  }

  /** True when `signature` was already accepted for this job — rejects verbatim request replay. */
  isReplayedResultSignature(jobId: string, signature: string): boolean {
    const job = this.jobs.find((j) => j.id === jobId);
    return job?.lastResultSignature === signature;
  }
}

export const jobOrchestrationStore = JobOrchestrationStore.getInstance();
