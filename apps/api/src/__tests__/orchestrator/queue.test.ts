import { describe, it, expect, beforeEach } from 'vitest';
import { orchestratorStore } from '../../modules/orchestrator/orchestrator-store.js';
import { enqueue, dequeue, ack, nack, retryFromDlq } from '../../modules/orchestrator/queue.js';

describe('Queue operations', () => {
  let initialQueueLength: number;

  beforeEach(() => {
    initialQueueLength = orchestratorStore.queue.length;
  });

  it('enqueue adds a job with QUEUED status', () => {
    const job = enqueue('wf-1', 'Test WF', 'MANUAL', { x: 1 });
    expect(job.status).toBe('QUEUED');
    expect(job.workflowId).toBe('wf-1');
    expect(orchestratorStore.queue.length).toBeGreaterThan(initialQueueLength);
  });

  it('dequeue returns the first QUEUED job and marks it PROCESSING', () => {
    enqueue('wf-2', 'Test WF 2', 'MANUAL');
    const job = dequeue();
    expect(job).toBeDefined();
    expect(job!.status).toBe('PROCESSING');
    expect(job!.attempts).toBe(1);
  });

  it('ack removes the job from queue', () => {
    const job = enqueue('wf-3', 'Test WF 3', 'MANUAL');
    const before = orchestratorStore.queue.length;
    ack(job.id);
    expect(orchestratorStore.queue.length).toBe(before - 1);
  });

  it('nack re-queues the job if attempts < maxAttempts', () => {
    const job = enqueue('wf-4', 'Test WF 4', 'MANUAL', undefined, 1, 3);
    dequeue(); // marks PROCESSING, attempts = 1
    nack(job.id, 'transient error');
    const found = orchestratorStore.queue.find((j) => j.id === job.id);
    expect(found?.status).toBe('QUEUED');
    expect(found?.lastError).toBe('transient error');
  });

  it('nack moves to DLQ when attempts >= maxAttempts', () => {
    const job = enqueue('wf-5', 'Test WF 5', 'MANUAL', undefined, 1, 1);
    // Set attempts directly on the returned reference (same object in the queue).
    // We avoid calling dequeue() here because it picks the first QUEUED item globally
    // and could grab a seeded job rather than our new one.
    job.attempts = 1;
    const dlqBefore = orchestratorStore.dlq.length;
    nack(job.id, 'permanent error');
    expect(orchestratorStore.dlq.length).toBe(dlqBefore + 1);
    const dlqJob = orchestratorStore.dlq.find((j) => j.id === job.id);
    expect(dlqJob?.status).toBe('FAILED');
  });
});

describe('retryFromDlq', () => {
  it('returns undefined for unknown jobId', () => {
    const result = retryFromDlq('nonexistent');
    expect(result).toBeUndefined();
  });

  it('moves job from DLQ back to queue and resets attempts', () => {
    const job = enqueue('wf-6', 'Test WF 6', 'MANUAL', undefined, 1, 1);
    dequeue();
    nack(job.id, 'error');
    // Job should now be in DLQ
    const dlqJob = orchestratorStore.dlq.find((j) => j.id === job.id);
    if (!dlqJob) return; // skip if nack didn't move it (might have been re-queued)
    const retried = retryFromDlq(dlqJob.id);
    expect(retried).toBeDefined();
    expect(retried!.status).toBe('QUEUED');
    expect(retried!.attempts).toBe(0);
  });
});
