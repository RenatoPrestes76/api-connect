/**
 * SyncScheduler — manages scheduled sync jobs (cron-like).
 *
 * Jobs are registered with a cron expression (simplified: interval-based here).
 * In a production environment, a distributed scheduler (BullMQ, Temporal)
 * would replace this in-process implementation.
 *
 * Supported interval formats:
 *  - "@every 5m"   → every 5 minutes
 *  - "@every 1h"   → every 1 hour
 *  - "@daily"      → every 24 hours
 *  - "@hourly"     → every 1 hour
 *  - ISO duration  → "PT5M" = 5 minutes (parsed as ms)
 */
import type {
  SyncJobId,
  SyncMode,
  TenantId,
} from '../types/index.js';

export interface ScheduledJob {
  readonly id:          SyncJobId;
  readonly tenantId:    TenantId;
  readonly intervalMs:  number;
  readonly mode:        SyncMode;
  readonly enabled:     boolean;
  readonly lastRunAt:   number | null;
  readonly nextRunAt:   number;
  readonly runCount:    number;
  readonly errorCount:  number;
}

export type ScheduledJobRunner = (jobId: SyncJobId) => Promise<void>;

export class SyncScheduler {
  private readonly _jobs    = new Map<SyncJobId, ScheduledJob>();
  private readonly _timers  = new Map<SyncJobId, ReturnType<typeof setInterval>>();
  private          _running = false;

  register(params: {
    jobId:      SyncJobId;
    tenantId:   TenantId;
    interval:   string;
    mode:       SyncMode;
    enabled?:   boolean;
  }): ScheduledJob {
    const intervalMs = parseInterval(params.interval);
    const now = Date.now();

    const job: ScheduledJob = {
      id:          params.jobId,
      tenantId:    params.tenantId,
      intervalMs,
      mode:        params.mode,
      enabled:     params.enabled ?? true,
      lastRunAt:   null,
      nextRunAt:   now + intervalMs,
      runCount:    0,
      errorCount:  0,
    };

    this._jobs.set(params.jobId, job);
    return job;
  }

  unregister(jobId: SyncJobId): void {
    this._stopTimer(jobId);
    this._jobs.delete(jobId);
  }

  start(runner: ScheduledJobRunner): void {
    if (this._running) return;
    this._running = true;

    for (const [jobId, job] of this._jobs) {
      if (!job.enabled) continue;
      this._scheduleTimer(jobId, job, runner);
    }
  }

  stop(): void {
    for (const jobId of this._timers.keys()) {
      this._stopTimer(jobId);
    }
    this._running = false;
  }

  enable(jobId: SyncJobId): void  { this._setEnabled(jobId, true); }
  disable(jobId: SyncJobId): void { this._setEnabled(jobId, false); }

  job(jobId: SyncJobId): ScheduledJob | undefined {
    return this._jobs.get(jobId);
  }

  allJobs(): readonly ScheduledJob[] {
    return [...this._jobs.values()];
  }

  jobsByTenant(tenantId: TenantId): readonly ScheduledJob[] {
    return [...this._jobs.values()].filter((j) => j.tenantId === tenantId);
  }

  private _scheduleTimer(jobId: SyncJobId, job: ScheduledJob, runner: ScheduledJobRunner): void {
    const timer = setInterval(async () => {
      const current = this._jobs.get(jobId);
      if (!current?.enabled) return;

      try {
        await runner(jobId);
        this._jobs.set(jobId, {
          ...current,
          lastRunAt: Date.now(),
          nextRunAt: Date.now() + current.intervalMs,
          runCount:  current.runCount + 1,
        });
      } catch {
        this._jobs.set(jobId, {
          ...current,
          lastRunAt:  Date.now(),
          errorCount: current.errorCount + 1,
        });
      }
    }, job.intervalMs);

    this._timers.set(jobId, timer);
  }

  private _stopTimer(jobId: SyncJobId): void {
    const t = this._timers.get(jobId);
    if (t) { clearInterval(t); this._timers.delete(jobId); }
  }

  private _setEnabled(jobId: SyncJobId, enabled: boolean): void {
    const job = this._jobs.get(jobId);
    if (job) this._jobs.set(jobId, { ...job, enabled });
  }
}

// ─── Interval parser ──────────────────────────────────────────────────────────

function parseInterval(expr: string): number {
  const s = expr.trim().toLowerCase();

  if (s === '@daily')   return 24 * 60 * 60 * 1_000;
  if (s === '@hourly')  return  1 * 60 * 60 * 1_000;
  if (s === '@weekly')  return  7 * 24 * 60 * 60 * 1_000;

  const every = s.match(/^@every\s+(\d+)(s|m|h|d)$/);
  if (every) {
    const n = parseInt(every[1]!, 10);
    const unit = every[2]!;
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return n * (multipliers[unit] ?? 60_000);
  }

  // ISO 8601 duration PT5M, PT1H, etc.
  const iso = s.match(/^pt?(\d+)(s|m|h)$/i);
  if (iso) {
    const n    = parseInt(iso[1]!, 10);
    const unit = iso[2]!.toLowerCase();
    if (unit === 's') return n * 1_000;
    if (unit === 'm') return n * 60_000;
    if (unit === 'h') return n * 3_600_000;
  }

  // Plain milliseconds
  const ms = Number(s);
  if (!isNaN(ms) && ms > 0) return ms;

  // Default: 1 hour
  return 3_600_000;
}
