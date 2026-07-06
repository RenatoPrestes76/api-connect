import type { DatabaseAdapter } from '../adapters/database-adapter.js';
import { ConnectionFailedError, TimeoutError } from '../errors/database-errors.js';
import { computeDelay } from './retry-policy.js';
import type { RetryPolicy } from './retry-policy.js';

export interface ConnectionManagerOptions {
  readonly retryPolicy?:  RetryPolicy;
  readonly timeoutMs?:    number;
  // Legacy options (supported for backward compat, prefer retryPolicy)
  readonly maxRetries?:   number;
  readonly retryDelayMs?: number;
}

export class ConnectionManager {
  private _isConnected = false;
  private _retryCount  = 0;
  private readonly _policy:    RetryPolicy;
  private readonly _timeoutMs: number;

  constructor(
    private readonly _adapter: DatabaseAdapter,
    options: ConnectionManagerOptions = {},
  ) {
    this._timeoutMs = options.timeoutMs ?? 10_000;
    this._policy = options.retryPolicy ?? {
      attempts:     (options.maxRetries ?? 3) + 1,
      backoff:      'fixed',
      initialDelay: options.retryDelayMs ?? 1_000,
    };
  }

  async connect(): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this._policy.attempts; attempt++) {
      try {
        await this._withTimeout(this._adapter.connect(), this._timeoutMs);
        this._isConnected = true;
        this._retryCount  = attempt;
        return;
      } catch (err) {
        if (err instanceof TimeoutError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this._policy.attempts - 1) {
          await this._delay(computeDelay(this._policy, attempt));
        }
      }
    }

    this._retryCount = this._policy.attempts - 1;
    throw new ConnectionFailedError(
      `Connection failed after ${this._policy.attempts} attempt(s): ${lastError?.message ?? 'unknown error'}`,
      lastError,
    );
  }

  async disconnect(): Promise<void> {
    if (!this._isConnected) return;
    await this._adapter.disconnect();
    this._isConnected = false;
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  get isConnected(): boolean { return this._isConnected; }
  get retryCount():  number  { return this._retryCount; }

  private _withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new TimeoutError(`Operation timed out after ${ms}ms`)),
        ms,
      );
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
