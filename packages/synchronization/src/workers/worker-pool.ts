/**
 * WorkerPool — bounded concurrency for table sync tasks.
 *
 * Dynamic sizing:
 *  - Default: configurable parallelism (SyncConfig.workers)
 *  - Auto-scale: not implemented in this version (CPU/memory monitoring
 *    would require native bindings; left as extension point)
 *
 * Cancellation: each worker checks a shared AbortSignal between tasks.
 */

export interface WorkItem<TInput, TOutput> {
  input: TInput;
  resolve: (value: TOutput) => void;
  reject: (reason: unknown) => void;
}

export interface WorkerPoolStats {
  readonly active: number;
  readonly queued: number;
  readonly completed: number;
  readonly failed: number;
}

export class WorkerPool<TInput, TOutput> {
  private readonly _queue: Array<WorkItem<TInput, TOutput>> = [];
  private _active = 0;
  private _completed = 0;
  private _failed = 0;
  private _aborted = false;

  constructor(
    private readonly _concurrency: number,
    private readonly _processor: (input: TInput, signal: AbortSignal) => Promise<TOutput>,
    private readonly _signal?: AbortSignal
  ) {
    if (_signal) {
      _signal.addEventListener('abort', () => {
        this._aborted = true;
      });
    }
  }

  submit(input: TInput): Promise<TOutput> {
    if (this._aborted) {
      return Promise.reject(new Error('WorkerPool: aborted'));
    }

    return new Promise((resolve, reject) => {
      this._queue.push({ input, resolve, reject });
      this._drain();
    });
  }

  /** Submit all items and collect results (in submission order). */
  async runAll(items: readonly TInput[]): Promise<readonly TOutput[]> {
    return Promise.all(items.map((item) => this.submit(item)));
  }

  /** Like runAll but tolerates failures; errors become null in the result array. */
  async runAllSettled(items: readonly TInput[]): Promise<ReadonlyArray<TOutput | null>> {
    return Promise.all(items.map((item) => this.submit(item).catch(() => null as TOutput | null)));
  }

  stats(): WorkerPoolStats {
    return {
      active: this._active,
      queued: this._queue.length,
      completed: this._completed,
      failed: this._failed,
    };
  }

  get isIdle(): boolean {
    return this._active === 0 && this._queue.length === 0;
  }

  private _drain(): void {
    while (this._active < this._concurrency && this._queue.length > 0) {
      const item = this._queue.shift()!;
      this._run(item);
    }
  }

  private _run(item: WorkItem<TInput, TOutput>): void {
    if (this._aborted) {
      item.reject(new Error('WorkerPool: aborted'));
      return;
    }

    this._active++;

    const signal = this._signal ?? new AbortController().signal;

    this._processor(item.input, signal).then(
      (result) => {
        this._active--;
        this._completed++;
        item.resolve(result);
        this._drain();
      },
      (err) => {
        this._active--;
        this._failed++;
        item.reject(err);
        this._drain();
      }
    );
  }
}

// ─── Simple concurrent map ────────────────────────────────────────────────────

export async function pMap<TInput, TOutput>(
  items: readonly TInput[],
  fn: (item: TInput, index: number) => Promise<TOutput>,
  concurrency: number
): Promise<readonly TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker());

  await Promise.all(workers);
  return results;
}
