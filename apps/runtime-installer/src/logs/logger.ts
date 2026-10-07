import fs from 'node:fs';
import path from 'node:path';
import { restrictDirectoryToSystemAndAdministrators } from '../security/credential-encryption.js';

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
    // Installer/service logs can carry connection errors, hostnames, and
    // (via _sanitize below) whatever slipped past redaction — restricted
    // the same as every other sensitive file (SYSTEM + Administrators
    // only), with inheritance so files rotated/created later stay
    // restricted without a per-file call.
    restrictDirectoryToSystemAndAdministrators(logDir);
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

  /**
   * `stream.end()` is asynchronous — the underlying file write isn't
   * guaranteed complete when this returns. Previously callers couldn't
   * await that at all (`close(): void`), which is a real durability gap
   * (a log line could be lost if the process exits right after calling
   * this) as well as what made this hard to test deterministically.
   * Returning a Promise lets a caller that cares (tests; index.ts before
   * process.exit) await actual completion — fire-and-forget callers are
   * unaffected.
   */
  close(): Promise<void> {
    const streams = [...this._handles.values()];
    this._handles.clear();
    return Promise.all(
      streams.map(
        (stream) =>
          new Promise<void>((resolve) => {
            stream.end(() => resolve());
          })
      )
    ).then(() => undefined);
  }

  private _write(file: LogFile, line: string): void {
    const filePath = path.join(this._logDir, file);
    this._maybeRotate(filePath);
    let stream = this._handles.get(file);
    if (!stream) {
      stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
      // An unhandled 'error' event on a stream crashes the process — a
      // real risk now that the log directory's ACL (see constructor)
      // could make this fail for an account other than the one that
      // created it. Logging must never be able to take the installer
      // down; best-effort fallback to stderr instead.
      stream.on('error', (err) => {
        process.stderr.write(`[logger] failed to write ${file}: ${err.message}\n`);
      });
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

  /**
   * Strips tokens, passwords, and connection-string-shaped credentials
   * from log lines — a defense-in-depth net, not the primary guarantee.
   * The primary guarantee is that nothing in this codebase constructs a
   * log line from a raw ERP credential or row value in the first place
   * (see docs/ATLAS-RUNTIME-CLIENT.md's "What the logs never contain").
   */
  private _sanitize(message: string): string {
    return (
      message
        .replace(/"runtimeToken"\s*:\s*"[^"]+"/g, '"runtimeToken":"[REDACTED]"')
        .replace(/"x-agent-token"\s*:\s*"[^"]+"/gi, '"x-agent-token":"[REDACTED]"')
        .replace(/ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'ATLAS-[REDACTED]')
        .replace(
          /"(password|atlasActivationKey|activationKey)"\s*:\s*"[^"]*"/gi,
          '"$1":"[REDACTED]"'
        )
        // scheme://user:pass@host (any DB connection-string shape)
        .replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, '://***:***@')
    );
  }
}
