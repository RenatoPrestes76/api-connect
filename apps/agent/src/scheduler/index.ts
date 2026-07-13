/**
 * @seltriva/agent — scheduler
 * Job scheduling for the Sentinel agent.
 *
 * Trigger kinds:
 *   - manual       — triggered by CLI or cloud command only
 *   - cron         — standard cron expression (with timezone)
 *   - interval     — fixed interval in milliseconds
 *   - event-driven — fires when a specific event is received from the cloud
 *
 * All jobs are durable — if the agent restarts while a job was running,
 * the job's last status is preserved and it will not double-fire.
 */

import type { AgentResult, SyncJobId } from '../configuration/index';
import type { ConnectorId } from '../configuration/index';

// ─── Agent Scheduler ──────────────────────────────────────────────────────

export interface AgentScheduler {
  /**
   * Define (register) a job
   */
  define(job: JobDefinition): AgentResult<void>;

  /**
   * Schedule a defined job
   */
  schedule(jobId: SyncJobId): AgentResult<void>;

  /**
   * Unschedule (pause without removing) a job
   */
  unschedule(jobId: SyncJobId): AgentResult<void>;

  /**
   * Remove a job completely
   */
  remove(jobId: SyncJobId): AgentResult<void>;

  /**
   * Trigger a job immediately (manual run)
   */
  trigger(jobId: SyncJobId): Promise<AgentResult<JobRun>>;

  /**
   * Get job descriptor
   */
  get(jobId: SyncJobId): JobDescriptor | null;

  /**
   * List all jobs
   */
  list(): JobDescriptor[];

  /**
   * Get the run history for a job
   */
  getHistory(jobId: SyncJobId, limit?: number): JobRun[];

  /**
   * Get the next scheduled execution time for a job
   */
  getNextRunTime(jobId: SyncJobId): Date | null;

  /**
   * Start the scheduler
   */
  start(): AgentResult<void>;

  /**
   * Stop the scheduler gracefully
   */
  stop(): Promise<AgentResult<void>>;

  /**
   * True if the scheduler is running
   */
  readonly isRunning: boolean;

  /**
   * Subscribe to job execution events
   */
  onJobEvent(handler: JobEventHandler): JobEventSubscription;
}

// ─── Job Definition ───────────────────────────────────────────────────────

export interface JobDefinition {
  readonly id: SyncJobId;
  readonly name: string;
  readonly description?: string;
  readonly trigger: JobTrigger;
  readonly handler: JobHandler;
  readonly options?: JobOptions;
}

export interface JobOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly retryDelayMs?: number;
  readonly concurrentRuns?: boolean;
  readonly enabled?: boolean;
  readonly runOnStartup?: boolean;
}

// ─── Triggers ─────────────────────────────────────────────────────────────

export type JobTrigger = ManualTrigger | CronTrigger | IntervalTrigger | EventDrivenTrigger;

export interface ManualTrigger {
  readonly kind: 'manual';
}

export interface CronTrigger {
  readonly kind: 'cron';
  /** Standard cron expression, e.g. every 6 hours: "0 0/6 * * *" */
  readonly expression: string;
  /** IANA timezone — defaults to UTC */
  readonly timezone?: string;
}

export interface IntervalTrigger {
  readonly kind: 'interval';
  readonly intervalMs: number;
  /** Delay before first run */
  readonly initialDelayMs?: number;
}

export interface EventDrivenTrigger {
  readonly kind: 'event';
  /** Cloud command type that triggers this job */
  readonly commandType: string;
  /** Optional filter expression */
  readonly filter?: string;
}

// ─── Job Handler ──────────────────────────────────────────────────────────

export type JobHandler = (context: JobExecutionContext) => Promise<AgentResult<void>>;

export interface JobExecutionContext {
  readonly jobId: SyncJobId;
  readonly runId: string;
  readonly triggeredBy: TriggerReason;
  readonly connectorId?: ConnectorId;
  readonly signal: AbortSignal;
  readonly attempt: number;
}

export type TriggerReason =
  | 'manual-cli'
  | 'manual-cloud'
  | 'scheduled'
  | 'event-driven'
  | 'startup'
  | 'retry';

// ─── Job Descriptor ───────────────────────────────────────────────────────

export interface JobDescriptor {
  readonly id: SyncJobId;
  readonly name: string;
  readonly trigger: JobTrigger;
  readonly isScheduled: boolean;
  readonly isRunning: boolean;
  readonly lastRunAt?: Date;
  readonly lastRunStatus?: JobRunStatus;
  readonly nextRunAt?: Date;
  readonly totalRuns: number;
  readonly consecutiveFailures: number;
}

// ─── Job Run ──────────────────────────────────────────────────────────────

export interface JobRun {
  readonly runId: string;
  readonly jobId: SyncJobId;
  readonly status: JobRunStatus;
  readonly triggeredBy: TriggerReason;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly attempt: number;
  readonly error?: string;
}

export type JobRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed-out'
  | 'skipped';

// ─── Built-in Job IDs ─────────────────────────────────────────────────────

export const AGENT_JOB_IDS = {
  SCHEMA_SYNC: 'job-schema-sync' as SyncJobId,
  INCREMENTAL_SYNC: 'job-incremental-sync' as SyncJobId,
  HEALTH_CHECK: 'job-health-check' as SyncJobId,
  HEARTBEAT: 'job-heartbeat' as SyncJobId,
  QUEUE_FLUSH: 'job-queue-flush' as SyncJobId,
  TOKEN_ROTATION: 'job-token-rotation' as SyncJobId,
  UPDATE_CHECK: 'job-update-check' as SyncJobId,
  LOG_ROTATION: 'job-log-rotation' as SyncJobId,
  CREDENTIAL_ROTATION: 'job-credential-rotation' as SyncJobId,
  DIAGNOSTICS_SNAPSHOT: 'job-diagnostics-snapshot' as SyncJobId,
} as const;

// ─── Scheduler Events ─────────────────────────────────────────────────────

export type JobEventKind =
  | 'job-started'
  | 'job-completed'
  | 'job-failed'
  | 'job-cancelled'
  | 'job-timed-out'
  | 'job-skipped'
  | 'job-scheduled'
  | 'job-unscheduled';

export interface JobEvent {
  readonly kind: JobEventKind;
  readonly jobId: SyncJobId;
  readonly runId?: string;
  readonly timestamp: Date;
  readonly error?: string;
}

export type JobEventHandler = (event: JobEvent) => void;

export interface JobEventSubscription {
  unsubscribe(): void;
}

// ─── Scheduler Stats ──────────────────────────────────────────────────────

export interface SchedulerStats {
  readonly totalJobs: number;
  readonly scheduledJobs: number;
  readonly runningJobs: number;
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly failedRuns: number;
  readonly uptimeMs: number;
}
