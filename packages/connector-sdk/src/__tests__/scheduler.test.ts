import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectorScheduler } from '../scheduler/connector-scheduler.js';

describe('ConnectorScheduler', () => {
  let scheduler: ConnectorScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new ConnectorScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('registers a job and returns a jobId', () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const id   = scheduler.schedule('conn-1', { intervalMs: 1000, task });
    expect(id).toMatch(/^job-\d+-conn-1$/);
    expect(scheduler.size).toBe(1);
  });

  it('throws when neither intervalMs nor cronExpr is given', () => {
    expect(() => scheduler.schedule('conn-1', { task: vi.fn() })).toThrow();
  });

  it('throws when intervalMs is zero or negative', () => {
    expect(() => scheduler.schedule('conn-1', { intervalMs: 0, task: vi.fn() })).toThrow();
    expect(() => scheduler.schedule('conn-1', { intervalMs: -1, task: vi.fn() })).toThrow();
  });

  it('runs the task at each interval after start()', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule('conn-1', { intervalMs: 500, task });
    scheduler.start();

    await vi.advanceTimersByTimeAsync(1600);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('does not run tasks before start() is called', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule('conn-1', { intervalMs: 100, task });

    await vi.advanceTimersByTimeAsync(500);
    expect(task).not.toHaveBeenCalled();
  });

  it('cancel() removes the job', async () => {
    const task  = vi.fn().mockResolvedValue(undefined);
    const jobId = scheduler.schedule('conn-1', { intervalMs: 100, task });
    scheduler.start();
    scheduler.cancel(jobId);

    await vi.advanceTimersByTimeAsync(300);
    expect(task).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);
  });

  it('cancelAll() removes all jobs for a connector', () => {
    scheduler.schedule('conn-1', { intervalMs: 100, task: vi.fn() });
    scheduler.schedule('conn-1', { intervalMs: 200, task: vi.fn() });
    scheduler.schedule('conn-2', { intervalMs: 100, task: vi.fn() });

    scheduler.cancelAll('conn-1');
    expect(scheduler.size).toBe(1);
  });

  it('forwards task errors to onError without stopping the scheduler', async () => {
    const errHandler = vi.fn();
    scheduler.onError(errHandler);
    scheduler.schedule('conn-1', {
      intervalMs: 100,
      task: async () => { throw new Error('task error'); },
    });
    scheduler.start();

    await vi.advanceTimersByTimeAsync(250);
    expect(errHandler).toHaveBeenCalled();
    expect(scheduler.isRunning).toBe(true);
  });

  it('stop() halts all timers; start() resumes them', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule('conn-1', { intervalMs: 100, task });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(150);

    scheduler.stop();
    const countAfterStop = task.mock.calls.length;
    await vi.advanceTimersByTimeAsync(300);
    expect(task.mock.calls.length).toBe(countAfterStop); // no new calls while stopped

    scheduler.start();
    await vi.advanceTimersByTimeAsync(200);
    expect(task.mock.calls.length).toBeGreaterThan(countAfterStop);
  });
});
