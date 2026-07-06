/**
 * @seltriva/logger
 * Structured logging utility for Seltriva Connect
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private context: LogContext = {};

  constructor(name: string) {
    this.context = { logger: name };
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const data = {
      timestamp,
      level,
      message,
      ...this.context,
      ...context,
    };
    return JSON.stringify(data);
  }

  debug(message: string, context?: LogContext): void {
    console.log(this.formatLog('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatLog('error', message, context));
  }
}

export function createLogger(name: string): Logger {
  return new Logger(name);
}

export { Logger };
