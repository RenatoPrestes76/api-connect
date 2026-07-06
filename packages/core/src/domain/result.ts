/**
 * Result<T, E> — railway-oriented programming primitive.
 * Replaces throw/catch for expected failure paths.
 *
 * Usage:
 *   const r = Result.ok(42);
 *   const e = Result.fail<number>('not found');
 *   if (r.isOk()) console.log(r.value);
 */
export type Result<T, E = string> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
  },

  fail<E = string>(error: E): Result<never, E> {
    return { ok: false, error };
  },

  /**
   * Combine multiple results — fails on first error.
   */
  combine<T>(results: Result<T>[]): Result<T[]> {
    const values: T[] = [];
    for (const r of results) {
      if (!r.ok) return Result.fail(r.error);
      values.push(r.value);
    }
    return Result.ok(values);
  },

  /**
   * Wrap an async operation that may throw.
   */
  async try<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return Result.ok(await fn());
    } catch (err) {
      return Result.fail(err instanceof Error ? err : new Error(String(err)));
    }
  },

  /**
   * Map over a successful result.
   */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (!result.ok) return result;
    return Result.ok(fn(result.value));
  },

  /**
   * FlatMap (chain) — compose results.
   */
  flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    if (!result.ok) return result;
    return fn(result.value);
  },
} as const;

// ─── Guard ──────────────────────────────────────────────────────────────────

/** Throws if result is an error. Returns value if ok. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    const msg = typeof result.error === 'string'
      ? result.error
      : (result.error instanceof Error ? result.error.message : JSON.stringify(result.error));
    throw new Error(`Result.unwrap failed: ${msg}`);
  }
  return result.value;
}

/** Returns value or undefined. */
export function getOrUndefined<T>(result: Result<T>): T | undefined {
  return result.ok ? result.value : undefined;
}

/** Returns value or default. */
export function getOrDefault<T>(result: Result<T>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}
