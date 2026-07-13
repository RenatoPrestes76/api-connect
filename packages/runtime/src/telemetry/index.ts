/**
 * @seltriva/runtime/telemetry
 * Telemetry — structured logging, distributed tracing, and metrics
 *
 * Three pillars of observability:
 *   Logging   — structured, levelled, context-enriched log records
 *   Tracing   — distributed trace spans with W3C trace context
 *   Metrics   — counters, gauges, histograms with label cardinality control
 *
 * All telemetry is asynchronous and non-blocking.
 * Implementations forward to OpenTelemetry, Datadog, Prometheus, etc.
 * The runtime itself is instrumented through these interfaces.
 */

import type { ModuleId, TraceId, SpanId, LogLevel, TimeRange, Disposable } from '../kernel/index';

// ─── Telemetry Provider ───────────────────────────────────────────────────

export interface TelemetryProvider {
  readonly logger: RuntimeLogger;
  readonly tracer: RuntimeTracer;
  readonly meter: RuntimeMeter;

  /**
   * Create a child telemetry provider scoped to a module
   */
  forModule(moduleId: ModuleId): TelemetryProvider;

  /**
   * Flush all pending telemetry synchronously
   */
  flush(): Promise<void>;

  /**
   * Shut down exporter connections
   */
  shutdown(): Promise<void>;
}

// ─── Structured Logger ────────────────────────────────────────────────────

export interface RuntimeLogger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;

  /**
   * Create a child logger that inherits bindings
   */
  child(bindings: LogBindings): RuntimeLogger;

  /**
   * Add persistent key-value pairs to all future log records
   */
  bind(bindings: LogBindings): RuntimeLogger;

  /**
   * Current minimum level (records below this are discarded)
   */
  level: LogLevel;

  /**
   * Check if a level would be logged
   */
  isLevelEnabled(level: LogLevel): boolean;
}

export type LogContext = Record<string, unknown> & { err?: unknown; span?: SpanContext };
export type LogBindings = Record<string, unknown>;

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
  readonly moduleId?: ModuleId;
  readonly traceId?: TraceId;
  readonly spanId?: SpanId;
  readonly timestamp: Date;
  readonly sequenceNumber: number;
}

// ─── Distributed Tracer ───────────────────────────────────────────────────

export interface RuntimeTracer {
  /**
   * Start a new root span
   */
  startSpan(name: string, options?: SpanOptions): Span;

  /**
   * Start a child span within an active context
   */
  startChildSpan(name: string, parent: SpanContext, options?: SpanOptions): Span;

  /**
   * Execute a function within a new span, automatically ending it
   */
  withSpan<T>(name: string, fn: (span: Span) => T | Promise<T>): Promise<T>;

  /**
   * Get the currently active span
   */
  activeSpan(): Span | null;

  /**
   * Inject trace context into outbound headers (W3C traceparent)
   */
  inject(context: SpanContext): Record<string, string>;

  /**
   * Extract trace context from inbound headers
   */
  extract(headers: Record<string, string>): SpanContext | null;
}

export interface Span {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly name: string;

  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  setStatus(status: SpanStatus): this;
  recordException(error: unknown): this;
  end(endTime?: Date): void;
  context(): SpanContext;
}

export interface SpanContext {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly traceFlags: number;
  readonly traceState?: string;
}

export interface SpanOptions {
  readonly kind?: SpanKind;
  readonly attributes?: Record<string, string | number | boolean>;
  readonly startTime?: Date;
  readonly links?: SpanLink[];
}

export interface SpanLink {
  readonly context: SpanContext;
  readonly attributes?: Record<string, string | number | boolean>;
}

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export interface SpanStatus {
  readonly code: 'unset' | 'ok' | 'error';
  readonly message?: string;
}

// ─── Metrics ─────────────────────────────────────────────────────────────

export interface RuntimeMeter {
  /**
   * Counter — monotonically increasing value
   */
  createCounter(name: string, options?: MetricOptions): Counter;

  /**
   * Gauge — can increase or decrease
   */
  createGauge(name: string, options?: MetricOptions): Gauge;

  /**
   * Histogram — distribution of values (latency, sizes)
   */
  createHistogram(name: string, options?: MetricOptions): Histogram;

  /**
   * Up-down counter (net change gauge)
   */
  createUpDownCounter(name: string, options?: MetricOptions): UpDownCounter;
}

export interface MetricOptions {
  readonly description?: string;
  readonly unit?: string;
  readonly valueType?: 'int' | 'double';
}

export type MetricLabels = Record<string, string | number | boolean>;

export interface Counter {
  add(value: number, labels?: MetricLabels): void;
}

export interface Gauge {
  record(value: number, labels?: MetricLabels): void;
}

export interface Histogram {
  record(value: number, labels?: MetricLabels): void;
}

export interface UpDownCounter {
  add(delta: number, labels?: MetricLabels): void;
}

// ─── Built-in Metric Names ────────────────────────────────────────────────

export const METRIC_NAMES = {
  // Bootstrap
  BOOTSTRAP_DURATION_MS: 'crp.bootstrap.duration_ms',
  // Modules
  MODULE_INIT_DURATION_MS: 'crp.module.init_duration_ms',
  MODULE_START_DURATION_MS: 'crp.module.start_duration_ms',
  MODULE_ERROR_TOTAL: 'crp.module.errors_total',
  // Workers
  WORKER_ACTIVE: 'crp.worker.active',
  WORKER_QUEUE_DEPTH: 'crp.worker.queue_depth',
  WORKER_TASK_DURATION_MS: 'crp.worker.task_duration_ms',
  WORKER_TASK_ERRORS_TOTAL: 'crp.worker.task_errors_total',
  // Scheduler
  JOB_EXECUTIONS_TOTAL: 'crp.job.executions_total',
  JOB_DURATION_MS: 'crp.job.duration_ms',
  JOB_ERRORS_TOTAL: 'crp.job.errors_total',
  // Event bus
  EVENTS_PUBLISHED_TOTAL: 'crp.events.published_total',
  EVENTS_CONSUMED_TOTAL: 'crp.events.consumed_total',
  // Commands
  COMMANDS_DISPATCHED_TOTAL: 'crp.commands.dispatched_total',
  COMMAND_DURATION_MS: 'crp.commands.duration_ms',
  // Resilience
  CIRCUIT_BREAKER_STATE: 'crp.resilience.circuit_breaker_state',
  RETRY_ATTEMPTS_TOTAL: 'crp.resilience.retry_attempts_total',
  // Health
  HEALTH_CHECK_DURATION_MS: 'crp.health.check_duration_ms',
} as const;

// ─── Telemetry Exporter (plugin interface) ────────────────────────────────

export interface TelemetryExporter {
  readonly id: string;
  readonly name: string;

  exportLogs(records: LogRecord[]): Promise<void>;
  exportSpans(spans: ExportedSpan[]): Promise<void>;
  exportMetrics(dataPoints: MetricDataPoint[]): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ExportedSpan {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly status: SpanStatus;
  readonly attributes: Record<string, string | number | boolean>;
  readonly events: Array<{ name: string; timestamp: Date }>;
}

export interface MetricDataPoint {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
  readonly type: 'counter' | 'gauge' | 'histogram';
  readonly timestamp: Date;
}
