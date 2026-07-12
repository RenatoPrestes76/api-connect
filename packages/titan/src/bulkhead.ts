import type { BulkheadOptions, BulkheadMetrics } from './types.js';

export class BulkheadRejectedError extends Error {
  constructor(public readonly bulkheadName: string) {
    super(`Bulkhead '${bulkheadName}' is saturated — request rejected`);
    this.name = 'BulkheadRejectedError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(public readonly bulkheadName: string) {
    super(`Bulkhead '${bulkheadName}' queue wait timed out`);
    this.name = 'BulkheadTimeoutError';
  }
}

interface QueueEntry {
  run: () => void;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Limits concurrent executions of a resource so one overloaded dependency
 * can't starve the whole process (bulkhead isolation). Excess calls queue up
 * to `maxQueue`; beyond that they're rejected immediately. Queued calls that
 * wait longer than `queueTimeoutMs` time out.
 */
export class Bulkhead {
  readonly name: string;
  private readonly maxConcurrentCalls: number;
  private readonly maxQueueSize: number;
  private readonly queueTimeoutMs: number;
  private readonly clock: () => number;

  private active = 0;
  private queue: QueueEntry[] = [];
  private totalAccepted = 0;
  private totalRejected = 0;
  private totalTimedOut = 0;
  private totalCompleted = 0;

  constructor(name: string, options: BulkheadOptions = {}) {
    this.name = name;
    this.maxConcurrentCalls = options.maxConcurrent ?? 10;
    this.maxQueueSize = options.maxQueue ?? 0;
    this.queueTimeoutMs = options.queueTimeoutMs ?? 5_000;
    this.clock = options.clock ?? (() => Date.now());
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    this.totalAccepted++;
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrentCalls) {
      this.active++;
      return Promise.resolve();
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.totalRejected++;
      throw new BulkheadRejectedError(this.name);
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = {
        run: () => {
          if (entry.timer) clearTimeout(entry.timer);
          this.active++;
          resolve();
        },
        timer: null,
      };
      if (this.queueTimeoutMs > 0) {
        entry.timer = setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            this.totalTimedOut++;
            reject(new BulkheadTimeoutError(this.name));
          }
        }, this.queueTimeoutMs);
      }
      this.queue.push(entry);
    });
  }

  private release(): void {
    this.active--;
    this.totalCompleted++;
    const next = this.queue.shift();
    if (next) next.run();
  }

  getMetrics(): BulkheadMetrics {
    return {
      name: this.name,
      maxConcurrent: this.maxConcurrentCalls,
      maxQueue: this.maxQueueSize,
      active: this.active,
      queued: this.queue.length,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      totalTimedOut: this.totalTimedOut,
      totalCompleted: this.totalCompleted,
    };
  }

  reset(): void {
    this.active = 0;
    this.queue = [];
    this.totalAccepted = 0;
    this.totalRejected = 0;
    this.totalTimedOut = 0;
    this.totalCompleted = 0;
  }
}

export class BulkheadRegistry {
  private registry = new Map<string, Bulkhead>();

  register(name: string, options?: BulkheadOptions): Bulkhead {
    if (!this.registry.has(name)) {
      this.registry.set(name, new Bulkhead(name, options));
    }
    return this.registry.get(name)!;
  }

  get(name: string): Bulkhead | undefined {
    return this.registry.get(name);
  }

  list(): BulkheadMetrics[] {
    return [...this.registry.values()].map((b) => b.getMetrics());
  }

  reset(name: string): boolean {
    const b = this.registry.get(name);
    if (!b) return false;
    b.reset();
    return true;
  }
}

export const bulkheadRegistry = new BulkheadRegistry();
