import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This suite is about queue persistence/idempotency, not ACL enforcement
// (which has its own real, non-mocked proof in security/__tests__/
// credential-encryption.test.ts). Several tests here open the same file
// twice in one process (e.g. "close + reopen"); in production that's
// always the same account (the daemon, LocalSystem by default), which
// restrictToSystemAndAdministrators's real icacls call always grants —
// under vitest's unprivileged/UAC-filtered test account it wouldn't, with
// no way to reset ACLs between two opens inside the same constructor
// call. See run.test.ts's identical mock for the same reasoning.
vi.mock('../../security/credential-encryption.js', async () => {
  const actual = await vi.importActual<typeof import('../../security/credential-encryption.js')>(
    '../../security/credential-encryption.js'
  );
  return { ...actual, restrictToSystemAndAdministrators: () => {} };
});

import { OfflineQueue } from '../offline-queue.js';
import type { SubmitResultInput } from '../client.js';

const dirs: string[] = [];
function tempQueuePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-offline-queue-test-'));
  dirs.push(dir);
  return join(dir, 'queue.sqlite');
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function job(requestId: string, overrides: Partial<SubmitResultInput> = {}): SubmitResultInput {
  return {
    requestId,
    runtimeId: 'rt_123',
    success: true,
    schema: { tables: [] },
    ...overrides,
  };
}

describe('OfflineQueue', () => {
  it('starts empty', () => {
    const queue = new OfflineQueue(tempQueuePath());
    expect(queue.size()).toBe(0);
    expect(queue.listPending()).toEqual([]);
    queue.close();
  });

  it('enqueues and lists a pending entry', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_1'));
    expect(queue.size()).toBe(1);
    const pending = queue.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.requestId).toBe('req_1');
    expect(pending[0]!.payload).toEqual(job('req_1'));
    expect(pending[0]!.attempts).toBe(0);
    queue.close();
  });

  it('enqueuing the same requestId twice replaces the row instead of duplicating it', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_1', { success: true }));
    queue.enqueue(job('req_1', { success: false, error: 'retried with a different outcome' }));
    expect(queue.size()).toBe(1);
    const pending = queue.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.success).toBe(false);
    expect(pending[0]!.payload.error).toBe('retried with a different outcome');
    queue.close();
  });

  it('markDelivered removes the entry', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_1'));
    queue.markDelivered('req_1');
    expect(queue.size()).toBe(0);
    queue.close();
  });

  it('markDelivered on an unknown requestId is a harmless no-op', () => {
    const queue = new OfflineQueue(tempQueuePath());
    expect(() => queue.markDelivered('does-not-exist')).not.toThrow();
    queue.close();
  });

  it('recordFailure increments attempts and stores the error, keeping the entry queued', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_1'));
    queue.recordFailure('req_1', 'network timeout');
    queue.recordFailure('req_1', 'network timeout again');
    const pending = queue.listPending();
    expect(pending[0]!.attempts).toBe(2);
    expect(pending[0]!.lastError).toBe('network timeout again');
    expect(queue.size()).toBe(1);
    queue.close();
  });

  it('lists multiple pending entries in enqueue order', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_1'));
    queue.enqueue(job('req_2'));
    queue.enqueue(job('req_3'));
    const pending = queue.listPending();
    expect(pending.map((p) => p.requestId)).toEqual(['req_1', 'req_2', 'req_3']);
    queue.close();
  });

  it('pruneOlderThan removes only entries older than the cutoff', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_old'));
    // maxAgeMs of -1 means "older than right now minus 1ms" — the entry
    // just inserted (timestamped "now") is already older than that cutoff.
    const removed = queue.pruneOlderThan(-1);
    expect(removed).toBe(1);
    expect(queue.size()).toBe(0);
    queue.close();
  });

  it('pruneOlderThan with a generous window keeps recent entries', () => {
    const queue = new OfflineQueue(tempQueuePath());
    queue.enqueue(job('req_recent'));
    const removed = queue.pruneOlderThan(24 * 60 * 60_000);
    expect(removed).toBe(0);
    expect(queue.size()).toBe(1);
    queue.close();
  });

  it('survives close + reopen on the same file (real persistence, not in-memory)', () => {
    const path = tempQueuePath();
    const first = new OfflineQueue(path);
    first.enqueue(job('req_1'));
    first.close();

    const second = new OfflineQueue(path);
    expect(second.size()).toBe(1);
    expect(second.listPending()[0]!.requestId).toBe('req_1');
    second.close();
  });
});
