import { describe, it, expect } from 'vitest';
import { PriorityQueue, RetryQueue, DeadLetterQueue, QueueManager } from '../queue/sync-queue.js';

describe('PriorityQueue', () => {
  it('dequeues in priority order', () => {
    const q = new PriorityQueue<string>();
    q.enqueue('low',    3);
    q.enqueue('high',   1);
    q.enqueue('medium', 2);

    expect(q.dequeue()?.payload).toBe('high');
    expect(q.dequeue()?.payload).toBe('medium');
    expect(q.dequeue()?.payload).toBe('low');
  });

  it('FIFO within same priority', () => {
    const q = new PriorityQueue<number>();
    q.enqueue(1, 2);
    q.enqueue(2, 2);
    q.enqueue(3, 2);
    expect(q.dequeue()?.payload).toBe(1);
    expect(q.dequeue()?.payload).toBe(2);
  });

  it('returns null when empty', () => {
    const q = new PriorityQueue<string>();
    expect(q.dequeue()).toBeNull();
    expect(q.peek()).toBeNull();
  });

  it('tracks size correctly', () => {
    const q = new PriorityQueue<number>();
    q.enqueue(1);
    q.enqueue(2);
    expect(q.size).toBe(2);
    q.dequeue();
    expect(q.size).toBe(1);
  });

  it('removes by id', () => {
    const q = new PriorityQueue<string>();
    const item = q.enqueue('test');
    expect(q.size).toBe(1);
    expect(q.remove(item.id)).toBe(true);
    expect(q.size).toBe(0);
  });

  it('drains all items', () => {
    const q = new PriorityQueue<number>();
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    const drained = q.drain();
    expect(drained).toHaveLength(3);
    expect(q.size).toBe(0);
  });
});

describe('RetryQueue', () => {
  it('does not pop items before delay', async () => {
    const q = new RetryQueue<string>();
    q.schedule({ id: '1', payload: 'test', priority: 3, enqueuedAt: Date.now(), attempts: 1 }, 1000, 'err');
    expect(q.popDue()).toHaveLength(0);
  });

  it('pops items after delay', async () => {
    const q = new RetryQueue<string>();
    q.schedule({ id: '1', payload: 'test', priority: 3, enqueuedAt: Date.now(), attempts: 1 }, 10, 'err');
    await new Promise((r) => setTimeout(r, 20));
    expect(q.popDue()).toHaveLength(1);
  });

  it('sorts by retry time', async () => {
    const q = new RetryQueue<string>();
    q.schedule({ id: '2', payload: 'second', priority: 3, enqueuedAt: Date.now(), attempts: 1 }, 50, '');
    q.schedule({ id: '1', payload: 'first',  priority: 3, enqueuedAt: Date.now(), attempts: 1 }, 5, '');
    await new Promise((r) => setTimeout(r, 10));
    const due = q.popDue();
    expect(due[0]?.payload).toBe('first');
  });
});

describe('DeadLetterQueue', () => {
  it('enqueues failed items', () => {
    const dlq = new DeadLetterQueue<string>();
    dlq.enqueue({ id: '1', payload: 'failed', priority: 3, enqueuedAt: Date.now(), attempts: 3 }, 'final error');
    expect(dlq.size).toBe(1);
    expect(dlq.entries()[0]?.finalError).toBe('final error');
  });

  it('enforces max size by dropping oldest', () => {
    const dlq = new DeadLetterQueue<number>(3);
    for (let i = 0; i < 5; i++) {
      dlq.enqueue({ id: String(i), payload: i, priority: 1, enqueuedAt: Date.now(), attempts: 1 }, 'err');
    }
    expect(dlq.size).toBe(3);
    expect(dlq.entries()[0]?.item.payload).toBe(2);
  });

  it('clears all entries', () => {
    const dlq = new DeadLetterQueue<string>();
    dlq.enqueue({ id: '1', payload: 'x', priority: 1, enqueuedAt: Date.now(), attempts: 1 }, 'err');
    dlq.clear();
    expect(dlq.size).toBe(0);
  });
});

describe('QueueManager', () => {
  it('enqueues and dequeues via priority queue', () => {
    const qm = new QueueManager<string>(3);
    qm.enqueue('test', 2);
    expect(qm.priority.size).toBe(1);
    qm.priority.dequeue();
    expect(qm.priority.size).toBe(0);
  });

  it('moves to DLQ after max attempts', () => {
    const qm = new QueueManager<string>(2);
    const item = qm.enqueue('payload', 1);
    // Simulate 1st failure (attempts becomes 1)
    qm.nack(item, 'err1', 10);
    // Pop from retry immediately (force)
    const retrieved = qm.retry['_entries'].map((e: { item: typeof item }) => e.item);
    if (retrieved[0]) {
      qm.nack(retrieved[0], 'err2', 10);
    }
    expect(qm.dlq.size).toBe(1);
  });

  it('drainRetries moves due items to priority queue', async () => {
    const qm = new QueueManager<string>(3);
    qm.enqueue('x', 1);
    // Simulate consumer dequeuing the item before it fails
    const item = qm.priority.dequeue()!;
    qm.nack(item, 'err', 10);
    await new Promise((r) => setTimeout(r, 20));
    const moved = qm.drainRetries();
    expect(moved).toBe(1);
    expect(qm.priority.size).toBe(1);
  });
});
