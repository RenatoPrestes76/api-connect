import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncScheduler } from '../scheduler/sync-scheduler.js';
import { asSyncJobId, asTenantId } from '../types/index.js';

const JOB_A  = asSyncJobId('job-sched-a');
const JOB_B  = asSyncJobId('job-sched-b');
const TENANT = asTenantId('tenant-acme');

describe('SyncScheduler', () => {
  let scheduler: SyncScheduler;

  beforeEach(() => { scheduler = new SyncScheduler(); });
  afterEach(() => { scheduler.stop(); });

  it('registers a job and returns ScheduledJob', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@every 5m', mode: 'INCREMENTAL' });
    expect(job.id).toBe(JOB_A);
    expect(job.intervalMs).toBe(5 * 60 * 1000);
    expect(job.enabled).toBe(true);
    expect(job.runCount).toBe(0);
  });

  it('job() retrieves a registered job', () => {
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@hourly', mode: 'FULL' });
    expect(scheduler.job(JOB_A)?.id).toBe(JOB_A);
  });

  it('job() returns undefined for unknown id', () => {
    expect(scheduler.job(asSyncJobId('nope'))).toBeUndefined();
  });

  it('allJobs() returns all registered jobs', () => {
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@hourly',  mode: 'FULL' });
    scheduler.register({ jobId: JOB_B, tenantId: TENANT, interval: '@daily',   mode: 'INCREMENTAL' });
    expect(scheduler.allJobs()).toHaveLength(2);
  });

  it('jobsByTenant() filters by tenant', () => {
    const OTHER = asTenantId('tenant-other');
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@hourly', mode: 'FULL' });
    scheduler.register({ jobId: JOB_B, tenantId: OTHER,  interval: '@hourly', mode: 'FULL' });
    expect(scheduler.jobsByTenant(TENANT)).toHaveLength(1);
  });

  it('disable() prevents execution', async () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@every 100ms', mode: 'FULL', enabled: false });
    scheduler.start(runner);
    vi.advanceTimersByTime(500);
    expect(runner).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('enable()/disable() toggle job', () => {
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@hourly', mode: 'FULL' });
    scheduler.disable(JOB_A);
    expect(scheduler.job(JOB_A)?.enabled).toBe(false);
    scheduler.enable(JOB_A);
    expect(scheduler.job(JOB_A)?.enabled).toBe(true);
  });

  it('unregister() removes job and stops timer', () => {
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@hourly', mode: 'FULL' });
    scheduler.unregister(JOB_A);
    expect(scheduler.job(JOB_A)).toBeUndefined();
    expect(scheduler.allJobs()).toHaveLength(0);
  });

  it('parseInterval: @daily = 24h', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@daily', mode: 'FULL' });
    expect(job.intervalMs).toBe(24 * 60 * 60 * 1000);
  });

  it('parseInterval: @weekly = 7d', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@weekly', mode: 'FULL' });
    expect(job.intervalMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('parseInterval: ISO PT5M = 5 minutes', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: 'PT5M', mode: 'FULL' });
    expect(job.intervalMs).toBe(5 * 60 * 1000);
  });

  it('parseInterval: @every 30s', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@every 30s', mode: 'FULL' });
    expect(job.intervalMs).toBe(30 * 1000);
  });

  it('stop() stops all timers', () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '@every 10ms', mode: 'FULL' });
    scheduler.start(runner);
    scheduler.stop();
    vi.advanceTimersByTime(100);
    expect(runner).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('timer callback increments runCount after successful execution', async () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '100', mode: 'FULL' });
    scheduler.start(runner);
    await vi.advanceTimersByTimeAsync(150);
    expect(runner).toHaveBeenCalledWith(JOB_A);
    expect(scheduler.job(JOB_A)?.runCount).toBe(1);
    vi.useRealTimers();
  });

  it('timer callback increments errorCount when runner throws', async () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockRejectedValue(new Error('runner failed'));
    scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '100', mode: 'FULL' });
    scheduler.start(runner);
    await vi.advanceTimersByTimeAsync(150);
    expect(scheduler.job(JOB_A)?.errorCount).toBe(1);
    vi.useRealTimers();
  });

  it('parseInterval: ISO PT1H = 1 hour', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: 'PT1H', mode: 'FULL' });
    expect(job.intervalMs).toBe(60 * 60 * 1000);
  });

  it('parseInterval: plain ms string', () => {
    const job = scheduler.register({ jobId: JOB_A, tenantId: TENANT, interval: '5000', mode: 'FULL' });
    expect(job.intervalMs).toBe(5000);
  });
});
