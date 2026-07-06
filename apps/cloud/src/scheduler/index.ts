/**
 * @seltriva/cloud — scheduler
 * Cloud-side job scheduler: cron-based, interval-based, and one-time jobs.
 */

import type { OrganizationId, DomainResult } from '../domain/index';

export interface ICloudScheduler {
  define(job: ScheduledJobDefinition): void;
  start(jobId: string): DomainResult<void>;
  stop(jobId: string): DomainResult<void>;
  trigger(jobId: string): Promise<DomainResult<void>>;
  getStatus(jobId: string): ScheduledJobStatus | null;
  listAll(): ScheduledJobDescriptor[];
  isRunning: boolean;
  startAll(): void;
  stopAll(): Promise<void>;
}

export interface ScheduledJobDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly trigger: CloudJobTrigger;
  readonly handler: CloudJobHandler;
  readonly options?: CloudJobOptions;
}

export type CloudJobTrigger =
  | { readonly kind: 'cron'; readonly expression: string; readonly timezone?: string }
  | { readonly kind: 'interval'; readonly intervalMs: number }
  | { readonly kind: 'once'; readonly at: Date };

export type CloudJobHandler = (context: CloudJobContext) => Promise<void>;

export interface CloudJobContext {
  readonly jobId: string;
  readonly runId: string;
  readonly scheduledAt: Date;
  readonly signal: AbortSignal;
}

export interface CloudJobOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly enabled?: boolean;
  readonly organizationId?: OrganizationId;
}

export interface ScheduledJobStatus {
  readonly id: string;
  readonly name: string;
  readonly isRunning: boolean;
  readonly isEnabled: boolean;
  readonly lastRunAt?: Date;
  readonly lastStatus?: 'completed' | 'failed' | 'timed-out';
  readonly nextRunAt?: Date;
  readonly consecutiveFailures: number;
}

export interface ScheduledJobDescriptor extends ScheduledJobStatus {
  readonly trigger: CloudJobTrigger;
}

export const CLOUD_JOB_IDS = {
  AGENT_STALE_CHECK:         'job-agent-stale-check',
  LICENSE_EXPIRY_CHECK:      'job-license-expiry-check',
  NOTIFICATION_DIGEST:       'job-notification-digest',
  AUDIT_EXPORT_CLEANUP:      'job-audit-export-cleanup',
  METRICS_ROLLUP:            'job-metrics-rollup',
  DEAD_AGENT_CLEANUP:        'job-dead-agent-cleanup',
  SESSION_CLEANUP:           'job-session-cleanup',
  WEBHOOK_RETRY:             'job-webhook-retry',
  ALERT_ESCALATION:          'job-alert-escalation',
  PLATFORM_HEALTH_REPORT:    'job-platform-health-report',
} as const;
