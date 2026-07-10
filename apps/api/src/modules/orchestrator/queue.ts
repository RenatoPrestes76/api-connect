/**
 * Sprint 29 — ORCHESTRATOR
 * In-memory job queue with Dead Letter Queue support.
 */
import { randomUUID } from 'node:crypto';
import type { QueueJob } from './types.js';
import { orchestratorStore } from './orchestrator-store.js';

export function enqueue(
  workflowId: string,
  workflowName: string,
  triggerType: string,
  input?: Record<string, unknown>,
  priority = 1,
  maxAttempts = 3
): QueueJob {
  const job: QueueJob = {
    id: randomUUID(),
    workflowId,
    workflowName,
    triggerType,
    input,
    priority,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts,
    status: 'QUEUED',
  };
  // Insert by priority (highest first)
  const idx = orchestratorStore.queue.findIndex((j) => j.priority < priority);
  if (idx === -1) {
    orchestratorStore.queue.push(job);
  } else {
    orchestratorStore.queue.splice(idx, 0, job);
  }
  return job;
}

export function dequeue(): QueueJob | undefined {
  const idx = orchestratorStore.queue.findIndex((j) => j.status === 'QUEUED');
  if (idx === -1) return undefined;
  const job = orchestratorStore.queue[idx]!;
  job.status = 'PROCESSING';
  job.attempts += 1;
  return job;
}

export function ack(jobId: string): void {
  const idx = orchestratorStore.queue.findIndex((j) => j.id === jobId);
  if (idx !== -1) orchestratorStore.queue.splice(idx, 1);
}

export function nack(jobId: string, error: string): void {
  const job = orchestratorStore.queue.find((j) => j.id === jobId);
  if (!job) return;

  job.lastError = error;
  if (job.attempts >= job.maxAttempts) {
    moveToDlq(job);
  } else {
    job.status = 'QUEUED';
  }
}

export function moveToDlq(job: QueueJob): void {
  const idx = orchestratorStore.queue.findIndex((j) => j.id === job.id);
  if (idx !== -1) orchestratorStore.queue.splice(idx, 1);
  job.status = 'FAILED';
  orchestratorStore.dlq.push(job);
}

export function retryFromDlq(jobId: string): QueueJob | undefined {
  const idx = orchestratorStore.dlq.findIndex((j) => j.id === jobId);
  if (idx === -1) return undefined;
  const [job] = orchestratorStore.dlq.splice(idx, 1) as [QueueJob];
  job.status = 'QUEUED';
  job.attempts = 0;
  orchestratorStore.queue.push(job);
  return job;
}
