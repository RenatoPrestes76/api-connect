/**
 * @seltriva/agent — logs
 * Log management: rotation, retention, filtering, and streaming.
 *
 * Log files:
 *   agent.log          — combined all levels
 *   agent-error.log    — errors only
 *   agent-sync.log     — sync operations only
 *   agent-audit.log    — security audit trail
 *
 * Rotation:
 *   - Daily rotation (date-based filename)
 *   - Size-based rotation when max_file_size_mb is reached
 *   - Old files are compressed (.gz)
 *   - Files older than retention_days are deleted
 */

import type { AgentResult } from '../configuration/index';
import type { LogRecord, LogLevel } from '../telemetry/index';

// ─── Log Manager ──────────────────────────────────────────────────────────

export interface LogManager {
  /**
   * Initialize log file writers
   */
  init(options: LogManagerOptions): AgentResult<void>;

  /**
   * Get a stream of log entries (for CLI `logs --follow`)
   */
  stream(filter: LogStreamFilter): LogStream;

  /**
   * Read historical log entries
   */
  read(filter: LogReadFilter): Promise<AgentResult<LogRecord[]>>;

  /**
   * Force rotation of current log files
   */
  rotate(): Promise<AgentResult<void>>;

  /**
   * Delete log files older than retention policy
   */
  prune(): Promise<AgentResult<number>>;

  /**
   * Get log file inventory
   */
  listFiles(): LogFileInfo[];

  /**
   * Get total disk usage of all log files
   */
  getDiskUsage(): number;
}

export interface LogManagerOptions {
  readonly directory: string;
  readonly maxFileSizeMb: number;
  readonly maxFiles: number;
  readonly compressOldFiles: boolean;
  readonly retentionDays: number;
  readonly minLevel: LogLevel;
}

// ─── Log Stream ───────────────────────────────────────────────────────────

export interface LogStream {
  /**
   * Subscribe to incoming log records
   */
  subscribe(handler: LogRecordHandler): LogStreamSubscription;

  /**
   * Close the stream
   */
  close(): void;
}

export interface LogStreamSubscription {
  unsubscribe(): void;
}

export type LogRecordHandler = (record: FormattedLogRecord) => void;

// ─── Log Filters ──────────────────────────────────────────────────────────

export interface LogStreamFilter {
  readonly level?: LogLevel;
  readonly module?: string;
  readonly connectorId?: string;
  readonly jobId?: string;
  readonly grep?: string;
}

export interface LogReadFilter extends LogStreamFilter {
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
  readonly logFile?: string;
}

// ─── Log Record Types ─────────────────────────────────────────────────────

export interface FormattedLogRecord extends LogRecord {
  readonly formatted: string;
  readonly rawLine: string;
}

// ─── Log File Inventory ───────────────────────────────────────────────────

export interface LogFileInfo {
  readonly name: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
  readonly isCompressed: boolean;
  readonly kind: LogFileKind;
}

export type LogFileKind = 'combined' | 'error' | 'sync' | 'audit' | 'archived';

// ─── Log Formatter ────────────────────────────────────────────────────────

export interface LogFormatter {
  formatLine(record: LogRecord): string;
  formatJSON(record: LogRecord): string;
  formatColor(record: LogRecord): string;
}
