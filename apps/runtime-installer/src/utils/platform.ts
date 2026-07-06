import os from 'node:os';

export type Platform = 'windows' | 'linux' | 'macos' | 'unsupported';

export function detectPlatform(): Platform {
  switch (process.platform) {
    case 'win32':  return 'windows';
    case 'linux':  return 'linux';
    case 'darwin': return 'macos';
    default:       return 'unsupported';
  }
}

export function getDefaultHostname(): string {
  return os.hostname();
}

export function getMachineId(): string {
  // Deterministic per-machine ID derived from hostname + platform + arch
  const raw = `${os.hostname()}-${process.platform}-${os.arch()}-${os.cpus()[0]?.model ?? 'unknown'}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return `MACHINE-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
}

export function isRoot(): boolean {
  if (process.platform === 'win32') return false;
  return process.getuid?.() === 0;
}
