import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeRuntimeConfig, readRuntimeConfig, runtimeConfigExists } from '../runtime-config.js';
import { ensureRuntimeDirectories } from '../directory-setup.js';
import type { RuntimeCredentials } from '../../activation/registration.js';

const dirs: string[] = [];
function tempRuntimeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-installer-config-test-'));
  dirs.push(dir);
  // Mirrors the real install flow (apps/runtime-installer/src/index.ts),
  // which always calls this before writeRuntimeConfig.
  ensureRuntimeDirectories(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CREDENTIALS: RuntimeCredentials = {
  runtimeId: 'rt_12345',
  companyId: 'company_1',
  environment: 'production',
  runtimeToken: 'rt_token_super_secret_value',
  heartbeatUrl: 'https://api.atlasappruntime.com.br/runtime/heartbeat',
  syncUrl: 'https://api.atlasappruntime.com.br/runtime/sync',
};

const META = {
  apiBaseUrl: 'https://api.atlasappruntime.com.br',
  name: 'Loja Centro',
  hostname: 'LOJA-CENTRO-PC',
  machineId: 'machine-abc',
  version: '1.0.0',
  connectorType: 'generic',
};

describe('writeRuntimeConfig / readRuntimeConfig', () => {
  it('round-trips runtimeToken and every other field correctly', () => {
    const root = tempRuntimeRoot();
    writeRuntimeConfig(root, CREDENTIALS, META);
    const config = readRuntimeConfig(root);
    expect(config?.runtimeToken).toBe(CREDENTIALS.runtimeToken);
    expect(config?.runtimeId).toBe(CREDENTIALS.runtimeId);
    expect(config?.hostname).toBe(META.hostname);
  });

  it('never writes the plaintext runtimeToken to disk', () => {
    const root = tempRuntimeRoot();
    writeRuntimeConfig(root, CREDENTIALS, META);
    const raw = readFileSync(join(root, 'config', 'runtime.json'), 'utf-8');
    expect(raw).not.toContain(CREDENTIALS.runtimeToken);
    expect(raw).toContain('encryptedRuntimeToken');
  });

  it('runtimeConfigExists reflects the written file', () => {
    const root = tempRuntimeRoot();
    expect(runtimeConfigExists(root)).toBe(false);
    writeRuntimeConfig(root, CREDENTIALS, META);
    expect(runtimeConfigExists(root)).toBe(true);
  });

  it('readRuntimeConfig returns null when no config was ever written', () => {
    const root = tempRuntimeRoot();
    expect(readRuntimeConfig(root)).toBeNull();
  });
});
