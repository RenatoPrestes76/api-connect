import fs from 'node:fs';
import path from 'node:path';

export const RUNTIME_DIRS = [
  'config',
  'logs',
  'cache',
  'plugins',
  'connectors',
  'updates',
  'temp',
  // Where the daemon (apps/agent/src/cli/bin.ts) persists its own state —
  // the Ed25519 identity file and the offline-queue SQLite database.
  // Deliberately separate from this installer's own 'config'/'cache'.
  'agent-data',
  // The pinned, checksum-verified node.exe this installer ships with —
  // see scripts/download-node-runtime.mjs and agent-bundle.ts's
  // installNodeRuntime(). Makes the service self-sufficient: it never
  // depends on whatever (if anything) is on the target machine's PATH.
  'runtime',
] as const;

export type RuntimeDir = (typeof RUNTIME_DIRS)[number];

export function ensureRuntimeDirectories(runtimeRoot: string): void {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  for (const dir of RUNTIME_DIRS) {
    fs.mkdirSync(path.join(runtimeRoot, dir), { recursive: true });
  }
}

export function getDefaultRuntimeRoot(): string {
  if (process.platform === 'win32') {
    return path.join(process.env['ProgramData'] ?? 'C:\\ProgramData', 'Seltriva', 'Atlas');
  }
  return '/opt/seltriva/atlas';
}

export function runtimeDir(runtimeRoot: string, dir: RuntimeDir): string {
  return path.join(runtimeRoot, dir);
}

/** Where the deployed apps/agent bundle lives under the runtime root — see agent-bundle.ts. */
export function agentBundleDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, 'agent');
}

/** The real daemon entrypoint the Windows service / systemd unit execs — see apps/agent/src/cli/bin.ts. */
export function agentEntrypointPath(runtimeRoot: string): string {
  return path.join(agentBundleDir(runtimeRoot), 'dist', 'cli', 'bin.js');
}

/** Where the bundled node.exe lives under the runtime root — see agent-bundle.ts's installNodeRuntime(). */
export function runtimeNodeDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, 'runtime');
}

/** The pinned node.exe the Windows service runs via `execPath` — self-sufficient, no system Node required. */
export function runtimeNodeExecPath(runtimeRoot: string): string {
  return path.join(runtimeNodeDir(runtimeRoot), 'node.exe');
}

/** Where the encrypted ERP connection (erp-connection/erp-connection-store.ts) is written — the daemon reads this via ATLAS_ERP_CONNECTION_FILE, never ATLAS_SCAN_DB_* env vars. */
export function erpConnectionFilePath(runtimeRoot: string): string {
  return path.join(runtimeDir(runtimeRoot, 'config'), 'erp-connection.json');
}
