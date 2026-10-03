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
