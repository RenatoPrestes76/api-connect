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
