export interface ScheduleEntry {
  /** Human-readable label for logging / debugging. */
  readonly label?:      string;
  /** Interval in milliseconds. Mutually exclusive with cronExpr. */
  readonly intervalMs?: number;
  /** Cron expression (e.g. "0 * * * *"). Mutually exclusive with intervalMs. */
  readonly cronExpr?:   string;
  /** The task to execute. Errors are caught and forwarded to onError. */
  readonly task:        () => Promise<void>;
}

interface ScheduledJob {
  readonly jobId:       string;
  readonly connectorId: string;
  readonly entry:       ScheduleEntry;
  timer:                ReturnType<typeof setInterval> | null;
  running:              boolean;
}

/**
 * Connector-scoped scheduler.
 * Each connector uses this to register recurring jobs (health checks, syncs, discovery).
 * Errors in tasks are isolated — they never crash the scheduler.
 */
export class ConnectorScheduler {
  private readonly _jobs = new Map<string, ScheduledJob>();
  private _jobCounter  = 0;
  private _running     = false;
  private _onError?:    (connectorId: string, jobId: string, err: unknown) => void;

  onError(handler: (connectorId: string, jobId: string, err: unknown) => void): void {
    this._onError = handler;
  }

  /**
   * Register a recurring job for the given connector.
   * Returns a jobId that can be used to cancel the job.
   */
  schedule(connectorId: string, entry: ScheduleEntry): string {
    if (!entry.intervalMs && !entry.cronExpr) {
      throw new Error('ScheduleEntry must specify either intervalMs or cronExpr');
    }
    if (entry.intervalMs !== undefined && entry.intervalMs <= 0) {
      throw new Error('intervalMs must be positive');
    }

    const jobId = `job-${++this._jobCounter}-${connectorId}`;
    const job: ScheduledJob = { jobId, connectorId, entry, timer: null, running: false };
    this._jobs.set(jobId, job);

    if (this._running) {
      this._startJob(job);
    }

    return jobId;
  }

  /** Cancel a specific job. */
  cancel(jobId: string): void {
    const job = this._jobs.get(jobId);
    if (!job) return;
    this._stopJob(job);
    this._jobs.delete(jobId);
  }

  /** Cancel all jobs registered for a connector. */
  cancelAll(connectorId: string): void {
    for (const [jobId, job] of this._jobs) {
      if (job.connectorId === connectorId) {
        this._stopJob(job);
        this._jobs.delete(jobId);
      }
    }
  }

  /** Start all registered timers. Call once during runtime startup. */
  start(): void {
    if (this._running) return;
    this._running = true;
    for (const job of this._jobs.values()) {
      this._startJob(job);
    }
  }

  /** Stop all timers. Jobs remain registered; call start() to resume. */
  stop(): void {
    if (!this._running) return;
    this._running = false;
    for (const job of this._jobs.values()) {
      this._stopJob(job);
    }
  }

  /** Number of currently registered jobs. */
  get size(): number { return this._jobs.size; }

  /** Whether the scheduler is currently running. */
  get isRunning(): boolean { return this._running; }

  private _startJob(job: ScheduledJob): void {
    if (job.timer !== null) return;
    if (!job.entry.intervalMs) return; // cron support is a future extension

    job.timer = setInterval(async () => {
      if (job.running) return; // skip if previous run hasn't finished
      job.running = true;
      try {
        await job.entry.task();
      } catch (err) {
        this._onError?.(job.connectorId, job.jobId, err);
      } finally {
        job.running = false;
      }
    }, job.entry.intervalMs);
  }

  private _stopJob(job: ScheduledJob): void {
    if (job.timer !== null) {
      clearInterval(job.timer);
      job.timer = null;
    }
  }
}
