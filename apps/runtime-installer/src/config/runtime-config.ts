import fs from 'node:fs';
import path from 'node:path';
import type { RuntimeCredentials } from '../activation/registration.js';

export interface RuntimeConfig {
  runtimeId: string;
  companyId: string;
  environment: string;
  runtimeToken: string;
  heartbeatUrl: string;
  syncUrl: string;
  apiBaseUrl: string;
  name: string;
  hostname: string;
  machineId: string;
  version: string;
  connectorType: string;
  installedAt: string;
}

const CONFIG_FILE = 'runtime.json';

export function writeRuntimeConfig(
  runtimeRoot: string,
  credentials: RuntimeCredentials,
  meta: {
    apiBaseUrl: string;
    name: string;
    hostname: string;
    machineId: string;
    version: string;
    connectorType: string;
  }
): void {
  const config: RuntimeConfig = {
    ...credentials,
    ...meta,
    installedAt: new Date().toISOString(),
  };

  const configPath = path.join(runtimeRoot, 'config', CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function readRuntimeConfig(runtimeRoot: string): RuntimeConfig | null {
  const configPath = path.join(runtimeRoot, 'config', CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as RuntimeConfig;
  } catch {
    return null;
  }
}

export function runtimeConfigExists(runtimeRoot: string): boolean {
  return fs.existsSync(path.join(runtimeRoot, 'config', CONFIG_FILE));
}
