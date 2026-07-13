import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_FILES = ['installer.log', 'runtime.log', 'heartbeat.log', 'sync.log'] as const;
export type LogFile = (typeof LOG_FILES)[number];

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB per file before rotation

export class Logger {
  private readonly _logDir: string;
  private readonly _handles = new Map<LogFile, fs.WriteStream>();

  constructor(logDir: string) {
    this._logDir = logDir;
    fs.mkdirSync(logDir, { recursive: true });
  }

  log(file: LogFile, level: LogLevel, message: string): void {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${this._sanitize(message)}\n`;
    this._write(file, line);
  }

  info(file: LogFile, message: string): void {
    this.log(file, 'info', message);
  }
  warn(file: LogFile, message: string): void {
    this.log(file, 'warn', message);
  }
  error(file: LogFile, message: string): void {
    this.log(file, 'error', message);
  }
  debug(file: LogFile, message: string): void {
    this.log(file, 'debug', message);
  }

  close(): void {
    for (const stream of this._handles.values()) stream.end();
    this._handles.clear();
  }

  private _write(file: LogFile, line: string): void {
    const filePath = path.join(this._logDir, file);
    this._maybeRotate(filePath);
    let stream = this._handles.get(file);
    if (!stream) {
      stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
      this._handles.set(file, stream);
    }
    stream.write(line);
  }

  private _maybeRotate(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) return;
      const { size } = fs.statSync(filePath);
      if (size < MAX_LOG_BYTES) return;

      const rotated = `${filePath}.${Date.now()}.bak`;
      fs.renameSync(filePath, rotated);

      // Keep only the 3 most-recent backups
      const dir = path.dirname(filePath);
      const base = path.basename(filePath);
      const backups = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(base + '.') && f.endsWith('.bak'))
        .sort()
        .reverse();
      for (const old of backups.slice(3)) {
        fs.unlinkSync(path.join(dir, old));
      }
    } catch {
      /* non-fatal */
    }
  }

  /** Strip runtimeToken and other secret-looking values from log lines. */
  private _sanitize(message: string): string {
    return message
      .replace(/"runtimeToken"\s*:\s*"[^"]+"/g, '"runtimeToken":"[REDACTED]"')
      .replace(/"x-agent-token"\s*:\s*"[^"]+"/gi, '"x-agent-token":"[REDACTED]"')
      .replace(/ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'ATLAS-[REDACTED]');
  }
}
