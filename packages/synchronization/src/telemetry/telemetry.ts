/**
 * Telemetry — structured logging with correlation IDs and trace IDs.
 *
 * Every log line is a JSON-serializable StructuredLog object.
 * Observers can be registered to forward logs to external systems.
 */
import {
  type LogLevel,
  type StructuredLog,
  type SyncJobId,
  type TenantId,
  type CorrelationId,
  type TraceId,
} from '../types/index.js';

export type LogObserver = (log: StructuredLog) => void;

export interface TelemetryContext {
  jobId?: SyncJobId;
  tenantId?: TenantId;
  correlationId?: CorrelationId;
  traceId?: TraceId;
  schema?: string;
  table?: string;
}

export class Telemetry {
  private readonly _observers: LogObserver[] = [];
  private readonly _context: TelemetryContext;
  private _minLevel: LogLevel;

  constructor(context: TelemetryContext = {}, minLevel: LogLevel = 'INFO') {
    this._context = context;
    this._minLevel = minLevel;
  }

  setLevel(level: LogLevel): void {
    this._minLevel = level;
  }

  /** Register a log observer; returns an unsubscribe function. */
  observe(observer: LogObserver): () => void {
    this._observers.push(observer);
    return () => {
      const idx = this._observers.indexOf(observer);
      if (idx !== -1) this._observers.splice(idx, 1);
    };
  }

  /** Create a child telemetry with additional context (e.g., per-table). */
  child(extra: TelemetryContext): Telemetry {
    const t = new Telemetry({ ...this._context, ...extra }, this._minLevel);
    // Forward to same observers
    for (const obs of this._observers) t.observe(obs);
    return t;
  }

  debug(message: string, fields: Record<string, unknown> = {}): void {
    this._emit('DEBUG', message, fields);
  }

  info(message: string, fields: Record<string, unknown> = {}): void {
    this._emit('INFO', message, fields);
  }

  warn(message: string, fields: Record<string, unknown> = {}): void {
    this._emit('WARN', message, fields);
  }

  error(message: string, err?: Error | unknown, fields: Record<string, unknown> = {}): void {
    const e = err instanceof Error ? err : undefined;
    this._emit('ERROR', message, {
      ...fields,
      error: e?.message,
      stack: e?.stack,
    });
  }

  timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    return fn().then(
      (v) => {
        this.debug(`${label} completed`, { durationMs: Date.now() - start });
        return v;
      },
      (err) => {
        this.error(`${label} failed`, err, { durationMs: Date.now() - start });
        throw err;
      }
    );
  }

  private _emit(level: LogLevel, message: string, fields: Record<string, unknown>): void {
    if (!this._shouldEmit(level)) return;

    const log: StructuredLog = {
      level,
      message,
      timestamp: new Date().toISOString(),
      jobId: this._context.jobId,
      tenantId: this._context.tenantId,
      correlationId: this._context.correlationId,
      traceId: this._context.traceId,
      schema: this._context.schema ?? (fields['schema'] as string | undefined),
      table: this._context.table ?? (fields['table'] as string | undefined),
      durationMs: fields['durationMs'] as number | undefined,
      error: fields['error'] as string | undefined,
      stack: fields['stack'] as string | undefined,
      fields: Object.fromEntries(
        Object.entries(fields).filter(
          ([k]) => !['schema', 'table', 'durationMs', 'error', 'stack'].includes(k)
        )
      ),
    };

    for (const obs of this._observers) {
      try {
        obs(log);
      } catch {
        /* observer errors must not stop execution */
      }
    }
  }

  private _shouldEmit(level: LogLevel): boolean {
    const order: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return order.indexOf(level) >= order.indexOf(this._minLevel);
  }
}
