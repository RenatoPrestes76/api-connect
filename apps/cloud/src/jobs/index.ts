/**
 * @seltriva/cloud — jobs
 * Job engine: definition, execution, retry, and history.
 */

import type { OrganizationId, JobId, DomainResult, PaginatedResult } from '../domain/index';

export interface IJobEngine {
  enqueue(input: EnqueueJobInput): Promise<DomainResult<JobRecord>>;
  cancel(jobId: JobId): Promise<DomainResult<void>>;
  retry(jobId: JobId): Promise<DomainResult<void>>;
  getById(jobId: JobId): Promise<JobRecord | null>;
  listByOrganization(
    orgId: OrganizationId,
    filter?: JobFilter
  ): Promise<PaginatedResult<JobRecord>>;
  listPending(): Promise<JobRecord[]>;
  registerHandler(kind: string, handler: JobHandler): void;
  startProcessing(concurrency?: number): void;
  stopProcessing(): Promise<void>;
  getStats(): JobEngineStats;
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export interface EnqueueJobInput {
  readonly organizationId?: OrganizationId;
  readonly kind: string;
  readonly name: string;
  readonly payload?: Record<string, unknown>;
  readonly scheduledAt?: Date;
  readonly expiresAt?: Date;
  readonly maxAttempts?: number;
  readonly priority?: number;
}

export interface JobRecord {
  readonly id: JobId;
  readonly organizationId?: OrganizationId;
  readonly kind: string;
  readonly name: string;
  readonly status: JobStatus;
  readonly payload?: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly scheduledAt?: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RETRYING'
  | 'EXPIRED';

export interface JobFilter {
  readonly kind?: string;
  readonly status?: JobStatus;
  readonly since?: Date;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface JobEngineStats {
  readonly pending: number;
  readonly running: number;
  readonly completed: number;
  readonly failed: number;
  readonly successRatePercent: number;
  readonly avgDurationMs: number;
  readonly processedToday: number;
}

export const JOB_KINDS = {
  AGENT_STATUS_CHECK: 'agent-status-check',
  LICENSE_EXPIRY_NOTIFY: 'license-expiry-notify',
  SEND_EMAIL: 'send-email',
  SEND_WEBHOOK: 'send-webhook',
  AUDIT_EXPORT: 'audit-export',
  METRICS_ROLLUP: 'metrics-rollup',
  DEAD_AGENT_ALERT: 'dead-agent-alert',
  INVITE_EMAIL: 'invite-email',
} as const;
