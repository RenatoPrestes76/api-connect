/**
 * RetryEngine — exponential backoff with jitter.
 *
 * Delay schedule (default config):
 *   Attempt 1 → 5s ± jitter
 *   Attempt 2 → 15s ± jitter
 *   Attempt 3 → 45s ± jitter (capped at maxDelayMs)
 *
 * Non-retryable errors are immediately re-thrown without sleeping.
 * Retryable errors are judged by checking the error code or message
 * against RetryConfig.retryableErrors patterns.
 */
import {
  type RetryConfig,
  type SyncResult,
  DEFAULT_RETRY_CONFIG,
  syncFail,
} from '../types/index.js';

export interface RetryAttempt {
  readonly attempt:   number;
  readonly delayMs:   number;
  readonly error:     Error;
  readonly retryable: boolean;
}

export type RetryObserver = (attempt: RetryAttempt) => void;

export class RetryEngine {
  private readonly _config: RetryConfig;
  private readonly _observers: RetryObserver[] = [];

  constructor(config: Partial<RetryConfig> = {}) {
    this._config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  onAttempt(observer: RetryObserver): () => void {
    this._observers.push(observer);
    return () => {
      const idx = this._observers.indexOf(observer);
      if (idx !== -1) this._observers.splice(idx, 1);
    };
  }

  /**
   * Execute fn with automatic retry on failure.
   * Returns SyncResult<T>; never throws.
   */
  async execute<T>(
    fn:  () => Promise<T>,
    context?: string,
  ): Promise<SyncResult<T>> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= this._config.maxAttempts; attempt++) {
      try {
        const value = await fn();
        return { ok: true, value };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const retryable = this._isRetryable(lastError);
        const isLastAttempt = attempt >= this._config.maxAttempts;

        const delayMs = retryable && !isLastAttempt
          ? this._calculateDelay(attempt)
          : 0;

        this._notify({ attempt, delayMs, error: lastError, retryable });

        if (!retryable || isLastAttempt) break;

        await this._sleep(delayMs);
      }
    }

    return syncFail(
      'RETRY_EXHAUSTED',
      `Operation failed after ${this._config.maxAttempts} attempt(s): ${lastError.message}${context ? ` [${context}]` : ''}`,
      { retryable: false, cause: lastError },
    );
  }

  private _calculateDelay(attempt: number): number {
    const base   = this._config.initialDelayMs * Math.pow(this._config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * this._config.jitterMs;
    return Math.min(base + jitter, this._config.maxDelayMs);
  }

  private _isRetryable(error: Error): boolean {
    const msg = error.message.toUpperCase();
    return this._config.retryableErrors.some((code) => msg.includes(code));
  }

  private _notify(attempt: RetryAttempt): void {
    for (const observer of this._observers) {
      try { observer(attempt); } catch { /* observer errors must not affect retry logic */ }
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get config(): RetryConfig { return this._config; }
}
