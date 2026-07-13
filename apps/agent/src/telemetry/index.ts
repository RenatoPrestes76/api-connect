/**
 * @seltriva/agent — telemetry
 * Structured logging, metrics, and distributed tracing for the agent.
 *
 * The telemetry module is intentionally narrow:
 *   - It collects observability data within the agent process
 *   - Exporters ship data to external systems
 *   - No business data is ever logged — only structural metadata and metrics
 */

import type { AgentResult, TraceId } from '../configuration/index';

// ─── Agent Telemetry ──────────────────────────────────────────────────────

export interface AgentTelemetry {
  readonly logger: AgentLogger;
  readonly metrics: AgentMetrics;
  readonly tracer: AgentTracer;

  /**
   * Register an exporter for all telemetry data
   */
  addExporter(exporter: TelemetryExporter): void;

  /**
   * Remove an exporter
   */
  removeExporter(exporterId: string): void;

  /**
   * Flush all buffered telemetry (e.g., before shutdown)
   */
  flush(): Promise<AgentResult<void>>;

  /**
   * Enable/disable verbose debug mode
   */
  setDebugMode(enabled: boolean): void;
}

// ─── Agent Logger ─────────────────────────────────────────────────────────

export interface AgentLogger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;

  /**
   * Create a child logger with inherited context bindings
   */
  child(bindings: LogBindings): AgentLogger;

  /**
   * Bind context fields to all future log entries from this logger
   */
  bind(bindings: LogBindings): AgentLogger;
}

export interface LogContext {
  readonly error?: unknown;
  readonly [key: string]: unknown;
}

export interface LogBindings {
  readonly module?: string;
  readonly connectorId?: string;
  readonly jobId?: string;
  readonly traceId?: string;
  readonly [key: string]: string | undefined;
}

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly module?: string;
  readonly traceId?: TraceId;
  readonly context?: LogContext;
  readonly bindings?: LogBindings;
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

// ─── Agent Metrics ────────────────────────────────────────────────────────

export interface AgentMetrics {
  /**
   * Increment a counter
   */
  increment(name: MetricName, value?: number, labels?: MetricLabels): void;

  /**
   * Set an absolute gauge value
   */
  gauge(name: MetricName, value: number, labels?: MetricLabels): void;

  /**
   * Record a timing sample
   */
  timing(name: MetricName, durationMs: number, labels?: MetricLabels): void;

  /**
   * Record a histogram observation
   */
  histogram(name: MetricName, value: number, labels?: MetricLabels): void;

  /**
   * Snapshot all current metric values
   */
  snapshot(): MetricSnapshot;
}

export type MetricName = string;
export type MetricLabels = Record<string, string>;

export interface MetricSnapshot {
  readonly timestamp: Date;
  readonly counters: MetricValue[];
  readonly gauges: MetricValue[];
  readonly histograms: HistogramValue[];
}

export interface MetricValue {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
}

export interface HistogramValue {
  readonly name: string;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly labels: MetricLabels;
}

// ─── Agent Tracer ─────────────────────────────────────────────────────────

export interface AgentTracer {
  /**
   * Start a new root span
   */
  startSpan(name: string, options?: SpanOptions): AgentSpan;

  /**
   * Start a child span within an active span
   */
  startChildSpan(name: string, parent: AgentSpan, options?: SpanOptions): AgentSpan;

  /**
   * Run a function within a span, auto-ending on return
   */
  withSpan<T>(name: string, fn: (span: AgentSpan) => Promise<T>): Promise<T>;

  /**
   * Get the currently active span (if any)
   */
  getActiveSpan(): AgentSpan | null;
}

export interface AgentSpan {
  readonly traceId: TraceId;
  readonly spanId: string;
  readonly name: string;

  setTag(key: string, value: string | number | boolean): this;
  setError(error: unknown): this;
  log(message: string, fields?: Record<string, unknown>): this;
  end(): void;
}

export interface SpanOptions {
  readonly tags?: Record<string, string | number | boolean>;
}

// ─── Telemetry Exporter ───────────────────────────────────────────────────

export interface TelemetryExporter {
  readonly id: string;
  readonly name: string;

  exportLogs(records: LogRecord[]): Promise<AgentResult<void>>;
  exportMetrics(snapshot: MetricSnapshot): Promise<AgentResult<void>>;
  exportSpans(spans: ExportedSpan[]): Promise<AgentResult<void>>;

  flush(): Promise<AgentResult<void>>;
  shutdown(): Promise<AgentResult<void>>;
}

export interface ExportedSpan {
  readonly traceId: TraceId;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly durationMs: number;
  readonly tags: Record<string, string | number | boolean>;
  readonly error?: string;
}

// ─── Agent Metric Names ───────────────────────────────────────────────────

export const AGENT_METRICS = {
  SYNC_RUNS_TOTAL: 'agent.sync.runs.total',
  SYNC_RUNS_FAILED: 'agent.sync.runs.failed',
  SYNC_DURATION_MS: 'agent.sync.duration_ms',
  SYNC_ENTITIES_SYNCED: 'agent.sync.entities_synced',
  SYNC_BYTES_TRANSFERRED: 'agent.sync.bytes_transferred',
  QUEUE_DEPTH: 'agent.queue.depth',
  QUEUE_ENQUEUED_TOTAL: 'agent.queue.enqueued.total',
  QUEUE_DELIVERED_TOTAL: 'agent.queue.delivered.total',
  CONNECTOR_LATENCY_MS: 'agent.connector.latency_ms',
  CONNECTOR_ERRORS: 'agent.connector.errors.total',
  CLOUD_LATENCY_MS: 'agent.cloud.latency_ms',
  CLOUD_ERRORS: 'agent.cloud.errors.total',
  HEALTH_CPU_PERCENT: 'agent.health.cpu.percent',
  HEALTH_MEMORY_PERCENT: 'agent.health.memory.percent',
  HEALTH_DISK_PERCENT: 'agent.health.disk.percent',
  HEARTBEAT_LATENCY_MS: 'agent.heartbeat.latency_ms',
  JOB_DURATION_MS: 'agent.job.duration_ms',
  JOB_FAILURES_TOTAL: 'agent.job.failures.total',
  PLUGIN_ERRORS: 'agent.plugin.errors.total',
} as const;
