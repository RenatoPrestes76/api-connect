/**
 * WorkerPool — async concurrency limiter.
 *
 * Runs async tasks with bounded parallelism.
 * Collects results in submission order.
 * Continues past individual failures (errors are collected, not re-thrown).
 */

export interface WorkerResult<T> {
  readonly value: T | null;
  readonly error: Error | null;
  readonly index: number;
}

export class WorkerPool {
  constructor(private readonly _concurrency: number = 4) {}

  async run<TInput, TOutput>(
    items: readonly TInput[],
    processor: (item: TInput, index: number) => Promise<TOutput>
  ): Promise<readonly WorkerResult<TOutput>[]> {
    const results: WorkerResult<TOutput>[] = new Array(items.length);

    let nextIndex = 0;

    async function worker(): Promise<void> {
      while (nextIndex < items.length) {
        const i = nextIndex++;
        const item = items[i]!;
        try {
          const value = await processor(item, i);
          results[i] = { value, error: null, index: i };
        } catch (err) {
          results[i] = {
            value: null,
            error: err instanceof Error ? err : new Error(String(err)),
            index: i,
          };
        }
      }
    }

    const workers = Array.from({ length: Math.min(this._concurrency, items.length) }, () =>
      worker()
    );

    await Promise.all(workers);

    return results;
  }

  /** Like run(), but filters out failed results and returns values only. */
  async runCollect<TInput, TOutput>(
    items: readonly TInput[],
    processor: (item: TInput, index: number) => Promise<TOutput>
  ): Promise<readonly TOutput[]> {
    const results = await this.run(items, processor);
    return results.filter((r) => r.value !== null).map((r) => r.value as TOutput);
  }
}
