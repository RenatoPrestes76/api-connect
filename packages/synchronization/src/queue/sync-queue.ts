/**
 * SyncQueue — multi-tier async queue.
 *
 * Tiers:
 *  - PriorityQueue: ordered by QueuePriority, then FIFO within same priority
 *  - RetryQueue:    failed items waiting to be re-queued with delay
 *  - DeadLetterQueue: permanently failed items for inspection/alerting
 *
 * All queues are in-memory. Persistence can be added via the QueueStore interface.
 */
import type { QueueItem, QueuePriority } from '../types/index.js';
import { randomUUID } from 'crypto';

// ─── Priority Queue ───────────────────────────────────────────────────────────

export class PriorityQueue<T> {
  private readonly _items: Array<QueueItem<T>> = [];

  enqueue(payload: T, priority: QueuePriority = 3): QueueItem<T> {
    const item: QueueItem<T> = {
      id:          randomUUID(),
      payload,
      priority,
      enqueuedAt:  Date.now(),
      attempts:    0,
    };

    // Insert in sorted position (priority asc, then enqueuedAt asc)
    let i = this._items.length;
    while (i > 0 && this._shouldInsertBefore(item, this._items[i - 1]!)) {
      i--;
    }
    this._items.splice(i, 0, item);

    return item;
  }

  dequeue(): QueueItem<T> | null {
    return this._items.shift() ?? null;
  }

  peek(): QueueItem<T> | null {
    return this._items[0] ?? null;
  }

  remove(id: string): boolean {
    const idx = this._items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this._items.splice(idx, 1);
    return true;
  }

  get size(): number { return this._items.length; }

  isEmpty(): boolean { return this._items.length === 0; }

  drain(): readonly QueueItem<T>[] {
    return this._items.splice(0, this._items.length);
  }

  private _shouldInsertBefore(a: QueueItem<T>, b: QueueItem<T>): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.enqueuedAt < b.enqueuedAt;
  }
}

// ─── Retry Queue ──────────────────────────────────────────────────────────────

interface RetryEntry<T> {
  readonly item:      QueueItem<T>;
  readonly retryAt:   number;
}

export class RetryQueue<T> {
  private readonly _entries: Array<RetryEntry<T>> = [];

  schedule(item: QueueItem<T>, delayMs: number, error: string): void {
    const updated: QueueItem<T> = {
      ...item,
      attempts:  item.attempts + 1,
      lastError: error,
    };
    this._entries.push({ item: updated, retryAt: Date.now() + delayMs });
    // Keep sorted by retryAt asc
    this._entries.sort((a, b) => a.retryAt - b.retryAt);
  }

  /** Pop all items whose retry time has arrived. */
  popDue(): readonly QueueItem<T>[] {
    const now = Date.now();
    const due: QueueItem<T>[] = [];
    while (this._entries.length > 0 && this._entries[0]!.retryAt <= now) {
      due.push(this._entries.shift()!.item);
    }
    return due;
  }

  get size(): number { return this._entries.length; }

  nextRetryMs(): number | null {
    const next = this._entries[0];
    if (!next) return null;
    return Math.max(0, next.retryAt - Date.now());
  }
}

// ─── Dead Letter Queue ────────────────────────────────────────────────────────

export interface DeadLetterEntry<T> {
  readonly item:         QueueItem<T>;
  readonly failedAt:     number;
  readonly finalError:   string;
  readonly totalAttempts: number;
}

export class DeadLetterQueue<T> {
  private readonly _entries: Array<DeadLetterEntry<T>> = [];
  private readonly _maxSize:  number;

  constructor(maxSize = 10_000) {
    this._maxSize = maxSize;
  }

  enqueue(item: QueueItem<T>, finalError: string): void {
    this._entries.push({
      item,
      failedAt:      Date.now(),
      finalError,
      totalAttempts: item.attempts,
    });

    // Drop oldest entries if over limit
    if (this._entries.length > this._maxSize) {
      this._entries.shift();
    }
  }

  entries(): readonly DeadLetterEntry<T>[] {
    return [...this._entries];
  }

  clear(): void { this._entries.length = 0; }

  get size(): number { return this._entries.length; }
}

// ─── Composite Queue Manager ──────────────────────────────────────────────────

export class QueueManager<T> {
  readonly priority = new PriorityQueue<T>();
  readonly retry    = new RetryQueue<T>();
  readonly dlq      = new DeadLetterQueue<T>();

  private readonly _maxAttempts: number;

  constructor(maxAttempts = 3) {
    this._maxAttempts = maxAttempts;
  }

  /** Main enqueue — goes into the priority queue. */
  enqueue(payload: T, priority: QueuePriority = 3): QueueItem<T> {
    return this.priority.enqueue(payload, priority);
  }

  /** Move retry-due items back to the priority queue. */
  drainRetries(): number {
    const due = this.retry.popDue();
    for (const item of due) {
      this.priority.enqueue(item.payload, item.priority);
    }
    return due.length;
  }

  /** Mark an item as failed; schedule retry or move to DLQ. */
  nack(item: QueueItem<T>, error: string, delayMs: number): void {
    if (item.attempts + 1 >= this._maxAttempts) {
      this.dlq.enqueue(item, error);
    } else {
      this.retry.schedule(item, delayMs, error);
    }
  }

  get totalPending(): number {
    return this.priority.size + this.retry.size;
  }
}
