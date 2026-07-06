/**
 * @seltriva/runtime/scheduler
 * Scheduler — reliable job scheduling with cron, interval, and event triggers
 *
 * Jobs are the unit of scheduled work in the CRP.
 * The scheduler:
 *   - Manages job definitions and their triggers
 *   - Ensures at-most-once execution per tick (distributed locking)
 *   - Tracks execution history and outcomes
 *   - Supports pause/resume for individual jobs
 *   - Integrates with the worker pool for execution
 */

import type {
  RuntimeResult, JobId, ScheduleId, ModuleId, Priority,
  TimeRange, Disposable,
} from '../kernel/index';

// ─── Scheduler ────────────────────────────────────────────────────────────

export interface Scheduler {
  /**
   * Register a new job definition
   */
  define(definition: JobDefinition): RuntimeResult<JobDescriptor>;

  /**
   * Schedule a defined job (starts its trigger)
   */
  schedule(jobId: JobId): RuntimeResult<ScheduleId>;

  /**
   * Unschedule a job (stops trigger, does not remove definition)
   */
  unschedule(scheduleId: ScheduleId): RuntimeResult<void>;

  /**
   * Pause a scheduled job
   */
  pause(scheduleId: ScheduleId): RuntimeResult<void>;

  /**
   * Resume a paused job
   */
  resume(scheduleId: ScheduleId): RuntimeResult<void>;

  /**
   * Trigger a job immediately (one-shot, outside normal schedule)
   */
  trigger(jobId: JobId, options?: TriggerOptions): Promise<RuntimeResult<JobExecution>>;

  /**
   * Cancel a running execution
   */
  cancel(executionId: string): RuntimeResult<void>;

  /**
   * Remove a job definition and all its schedules
   */
  remove(jobId: JobId): RuntimeResult<void>;

  /**
   * Get a job descriptor
   */
  getJob(jobId: JobId): JobDescriptor | null;

  /**
   * Get all job descriptors
   */
  getAllJobs(): JobDescriptor[];

  /**
   * Get execution history
   */
  getHistory(jobId: JobId, limit?: number): JobExecution[];

  /**
   * Get current scheduler stats
   */
  getStats(): SchedulerStats;

  /**
   * Subscribe to job execution events
   */
  onExecution(handler: JobExecutionEventHandler): Disposable;
}

// ─── Job Definition ───────────────────────────────────────────────────────

export interface JobDefinition {
  readonly id: JobId;
  readonly name: string;
  readonly description?: string;
  readonly ownerModuleId: ModuleId;
  readonly trigger: JobTrigger;
  readonly priority: Priority;
  readonly timeoutMs?: number;
  readonly maxConcurrent?: number;
  readonly retryPolicy?: JobRetryPolicy;
  readonly tags?: string[];
  readonly handler: JobHandler;
  readonly metadata?: Record<string, unknown>;
}

export interface JobDescriptor {
  readonly id: JobId;
  readonly name: string;
  readonly ownerModuleId: ModuleId;
  readonly trigger: JobTrigger;
  readonly priority: Priority;
  readonly scheduleId?: ScheduleId;
  readonly isPaused: boolean;
  readonly isEnabled: boolean;
  readonly nextRunAt?: Date;
  readonly lastRunAt?: Date;
  readonly lastStatus?: JobExecutionStatus;
  readonly executionCount: number;
  readonly failureCount: number;
  readonly registeredAt: Date;
}

// ─── Job Handler ──────────────────────────────────────────────────────────

export type JobHandler = (context: JobExecutionContext) => Promise<JobResult>;

export interface JobExecutionContext {
  readonly jobId: JobId;
  readonly executionId: string;
  readonly attempt: number;
  readonly scheduledAt: Date;
  readonly triggeredAt: Date;
  readonly metadata?: Record<string, unknown>;
  readonly signal: AbortSignal;
}

export interface JobResult {
  readonly success: boolean;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

// ─── Triggers ─────────────────────────────────────────────────────────────

export type JobTrigger =
  | CronTrigger
  | IntervalTrigger
  | OnceTrigger
  | EventTrigger;

export interface CronTrigger {
  readonly kind: 'cron';
  readonly expression: string;
  readonly timezone?: string;
}

export interface IntervalTrigger {
  readonly kind: 'interval';
  readonly intervalMs: number;
  readonly initialDelayMs?: number;
}

export interface OnceTrigger {
  readonly kind: 'once';
  readonly runAt: Date;
}

export interface EventTrigger {
  readonly kind: 'event';
  readonly topicPattern: string;
  readonly filter?: (eventPayload: Record<string, unknown>) => boolean;
}

// ─── Job Execution ────────────────────────────────────────────────────────

export interface JobExecution {
  readonly id: string;
  readonly jobId: JobId;
  readonly scheduleId?: ScheduleId;
  readonly status: JobExecutionStatus;
  readonly attempt: number;
  readonly scheduledAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
  readonly workerId?: string;
}

export type JobExecutionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed-out'
  | 'skipped';

// ─── Retry Policy ─────────────────────────────────────────────────────────

export interface JobRetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
  readonly maxDelayMs?: number;
}

// ─── Trigger Options ──────────────────────────────────────────────────────

export interface TriggerOptions {
  readonly priority?: Priority;
  readonly metadata?: Record<string, unknown>;
  readonly timeoutMs?: number;
}

// ─── Built-in Job IDs ─────────────────────────────────────────────────────

export const BUILT_IN_JOB_IDS = {
  HEALTH_CHECK:             'job-health-check'               as JobId,
  TELEMETRY_FLUSH:          'job-telemetry-flush'            as JobId,
  MEMORY_CONSOLIDATION:     'job-memory-consolidation'       as JobId,
  DEAD_LETTER_RETRY:        'job-dead-letter-retry'          as JobId,
  DIAGNOSTICS_SNAPSHOT:     'job-diagnostics-snapshot'       as JobId,
  PLUGIN_HEALTH_CHECK:      'job-plugin-health-check'        as JobId,
  RESILIENCE_METRICS:       'job-resilience-metrics'         as JobId,
  CIRCUIT_BREAKER_SWEEP:    'job-circuit-breaker-sweep'      as JobId,
} as const;

// ─── Stats ────────────────────────────────────────────────────────────────

export interface SchedulerStats {
  readonly totalJobs: number;
  readonly activeJobs: number;
  readonly pausedJobs: number;
  readonly runningExecutions: number;
  readonly queuedExecutions: number;
  readonly completedToday: number;
  readonly failedToday: number;
  readonly nextRunAt?: Date;
}

// ─── Job Execution Events ─────────────────────────────────────────────────

export type JobExecutionEventKind = 'queued' | 'started' | 'completed' | 'failed' | 'cancelled' | 'skipped';

export interface JobExecutionEvent {
  readonly kind: JobExecutionEventKind;
  readonly execution: JobExecution;
  readonly timestamp: Date;
}

export type JobExecutionEventHandler = (event: JobExecutionEvent) => void;

// ─── Job Store ────────────────────────────────────────────────────────────

export interface JobStore {
  saveDefinition(definition: JobDefinition): Promise<void>;
  getDefinition(jobId: JobId): Promise<JobDefinition | null>;
  saveExecution(execution: JobExecution): Promise<void>;
  getExecution(executionId: string): Promise<JobExecution | null>;
  getHistory(jobId: JobId, limit?: number): Promise<JobExecution[]>;
  deleteDefinition(jobId: JobId): Promise<void>;
}
