export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly connectorId: string;
  readonly level:       LogLevel;
  readonly message:     string;
  readonly context?:    Record<string, unknown>;
  readonly error?:      Error;
  readonly timestamp:   Date;
}

/**
 * Per-connector logger interface.
 * Injected by the Runtime so each connector writes to its own log sink.
 */
export interface ConnectorLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info (message: string, context?: Record<string, unknown>): void;
  warn (message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/** Console-based logger used during development and testing. */
export class ConsoleConnectorLogger implements ConnectorLogger {
  constructor(
    private readonly _connectorId: string,
    private readonly _minLevel: LogLevel = 'info',
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this._log('debug', message, undefined, context);
  }
  info (message: string, context?: Record<string, unknown>): void {
    this._log('info',  message, undefined, context);
  }
  warn (message: string, context?: Record<string, unknown>): void {
    this._log('warn',  message, undefined, context);
  }
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this._log('error', message, error, context);
  }

  private _log(level: LogLevel, message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this._shouldLog(level)) return;
    const ts  = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    const err = error   ? ` — ${error.message}` : '';
    process.stdout.write(`${ts} [${level.toUpperCase()}] [${this._connectorId}] ${message}${err}${ctx}\n`);
  }

  private _shouldLog(level: LogLevel): boolean {
    const ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return ORDER.indexOf(level) >= ORDER.indexOf(this._minLevel);
  }
}

/** Silent logger that collects entries in memory. Useful for testing. */
export class InMemoryConnectorLogger implements ConnectorLogger {
  readonly entries: LogEntry[] = [];

  constructor(private readonly _connectorId: string) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this._push('debug', message, undefined, context);
  }
  info (message: string, context?: Record<string, unknown>): void {
    this._push('info',  message, undefined, context);
  }
  warn (message: string, context?: Record<string, unknown>): void {
    this._push('warn',  message, undefined, context);
  }
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this._push('error', message, error, context);
  }

  private _push(level: LogLevel, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.entries.push({ connectorId: this._connectorId, level, message, error, context, timestamp: new Date() });
  }

  clear(): void { this.entries.length = 0; }
}
