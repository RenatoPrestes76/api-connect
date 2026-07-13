/**
 * @seltriva/cloud — telemetry
 * Structured logging, distributed tracing, and OpenTelemetry integration.
 */

import type { OrganizationId, AgentId } from '../domain/index';

// ─── Cloud Logger ─────────────────────────────────────────────────────────

export interface CloudLogger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  child(bindings: LogBindings): CloudLogger;
  bind(bindings: LogBindings): CloudLogger;
}

export interface LogContext {
  readonly error?: unknown;
  readonly requestId?: string;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

export interface LogBindings {
  readonly module?: string;
  readonly organizationId?: string;
  readonly requestId?: string;
  readonly [key: string]: string | undefined;
}

export interface LogRecord {
  readonly level: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly context?: LogContext;
}

// ─── Cloud Tracer ─────────────────────────────────────────────────────────

export interface CloudTracer {
  startSpan(name: string, options?: SpanOptions): CloudSpan;
  startChildSpan(name: string, parent: CloudSpan): CloudSpan;
  withSpan<T>(name: string, fn: (span: CloudSpan) => Promise<T>): Promise<T>;
  getActiveSpan(): CloudSpan | null;
  injectHeaders(span: CloudSpan): Record<string, string>;
  extractFromHeaders(headers: Record<string, string>): SpanContext | null;
}

export interface CloudSpan {
  readonly traceId: string;
  readonly spanId: string;
  setTag(key: string, value: string | number | boolean): this;
  setError(error: unknown): this;
  log(message: string): this;
  end(): void;
}

export interface SpanOptions {
  readonly tags?: Record<string, string | number | boolean>;
  readonly parentContext?: SpanContext;
}

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
}

// ─── Cloud Metrics ────────────────────────────────────────────────────────

export interface CloudMetrics {
  increment(name: string, value?: number, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  timing(name: string, durationMs: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
}

// ─── Agent Telemetry Ingestion ────────────────────────────────────────────

export interface IAgentTelemetryIngestion {
  ingest(agentId: AgentId, orgId: OrganizationId, payload: AgentTelemetryPayload): Promise<void>;
  getMetrics(agentId: AgentId, filter: TelemetryFilter): Promise<AgentMetricPoint[]>;
  getLogs(agentId: AgentId, filter: TelemetryFilter): Promise<AgentLogRecord[]>;
}

export interface AgentTelemetryPayload {
  readonly kind: 'metrics' | 'logs' | 'traces';
  readonly data: unknown;
  readonly timestamp: Date;
}

export interface TelemetryFilter {
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
  readonly metricName?: string;
  readonly level?: string;
}

export interface AgentMetricPoint {
  readonly name: string;
  readonly value: number;
  readonly labels: Record<string, string>;
  readonly recordedAt: Date;
}

export interface AgentLogRecord {
  readonly level: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;
}

// ─── Telemetry Exporter ───────────────────────────────────────────────────

export interface ITelemetryExporter {
  readonly id: string;
  exportLogs(records: LogRecord[]): Promise<void>;
  exportSpans(spans: ExportedSpan[]): Promise<void>;
  flush(): Promise<void>;
}

export interface ExportedSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly tags: Record<string, string | number | boolean>;
  readonly error?: string;
}

// ─── Metric Names ─────────────────────────────────────────────────────────

export const CLOUD_METRICS = {
  API_REQUESTS_TOTAL: 'cloud.api.requests.total',
  API_REQUEST_DURATION_MS: 'cloud.api.request.duration_ms',
  API_ERRORS_TOTAL: 'cloud.api.errors.total',
  ACTIVE_AGENTS: 'cloud.agents.active',
  AGENT_HEARTBEATS_TOTAL: 'cloud.agents.heartbeats.total',
  JOBS_PROCESSED_TOTAL: 'cloud.jobs.processed.total',
  JOBS_FAILED_TOTAL: 'cloud.jobs.failed.total',
  JOB_DURATION_MS: 'cloud.jobs.duration_ms',
  ORGANIZATIONS_ACTIVE: 'cloud.organizations.active',
  NOTIFICATIONS_SENT_TOTAL: 'cloud.notifications.sent.total',
  AUTH_ATTEMPTS_TOTAL: 'cloud.auth.attempts.total',
  RATE_LIMIT_HITS_TOTAL: 'cloud.ratelimit.hits.total',
  CACHE_HITS_TOTAL: 'cloud.cache.hits.total',
  CACHE_MISSES_TOTAL: 'cloud.cache.misses.total',
  DB_QUERY_DURATION_MS: 'cloud.db.query.duration_ms',
} as const;
