import fs from 'node:fs';
import path from 'node:path';
import type { RuntimeCredentials } from '../activation/registration.js';
import {
  encryptSecret,
  decryptSecret,
  type EncryptedSecret,
} from '../security/credential-encryption.js';

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

/** On-disk shape — `runtimeToken` is only ever persisted encrypted. */
type PersistedRuntimeConfig = Omit<RuntimeConfig, 'runtimeToken'> & {
  encryptedRuntimeToken: EncryptedSecret;
};

const CONFIG_FILE = 'runtime.json';

function configDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, 'config');
}

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
  const { runtimeToken, ...restCredentials } = credentials;
  const dir = configDir(runtimeRoot);
  const persisted: PersistedRuntimeConfig = {
    ...restCredentials,
    ...meta,
    installedAt: new Date().toISOString(),
    encryptedRuntimeToken: encryptSecret(runtimeToken, dir),
  };

  const configPath = path.join(dir, CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(persisted, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function readRuntimeConfig(runtimeRoot: string): RuntimeConfig | null {
  const dir = configDir(runtimeRoot);
  const configPath = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;
  try {
    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8')) as PersistedRuntimeConfig;
    const { encryptedRuntimeToken, ...rest } = persisted;
    return { ...rest, runtimeToken: decryptSecret(encryptedRuntimeToken, dir) };
  } catch {
    return null;
  }
}

export function runtimeConfigExists(runtimeRoot: string): boolean {
  return fs.existsSync(path.join(runtimeRoot, 'config', CONFIG_FILE));
}
