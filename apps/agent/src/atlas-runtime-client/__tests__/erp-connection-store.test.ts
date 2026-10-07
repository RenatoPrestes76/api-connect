import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadErpScanTarget } from '../erp-connection-store.js';
import { encryptSecret } from '../../security/credential-encryption.js';

/**
 * `apps/runtime-installer` writes this file independently (its own
 * duplicated credential-encryption.ts — see that module's header
 * comment for why it's deliberately not shared). Both copies use the
 * exact same DPAPI LocalMachine scope/algorithm, so a file this test
 * encrypts with apps/agent's own copy is exactly what the installer
 * would have produced — a real cross-module compatibility proof, not
 * an assumption.
 */

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-erp-conn-read-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function writeStoredConnection(
  dir: string,
  overrides: Partial<{
    dbType: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }> = {}
): string {
  const filePath = join(dir, 'erp-connection.json');
  const target = {
    dbType: 'postgres',
    host: '10.0.2.2',
    port: 5434,
    database: 'supermais_erp_test',
    username: 'atlas_readonly',
    password: 'super-secret-erp-password',
    ...overrides,
  };
  writeFileSync(
    filePath,
    JSON.stringify({
      dbType: target.dbType,
      host: target.host,
      port: target.port,
      database: target.database,
      username: target.username,
      encryptedPassword: encryptSecret(target.password, dir),
    }),
    'utf-8'
  );
  return filePath;
}

describe('loadErpScanTarget', () => {
  it('reads and decrypts a connection the installer (or an identical encryption) wrote', () => {
    const dir = tempDir();
    const filePath = writeStoredConnection(dir);

    const target = loadErpScanTarget(filePath);
    expect(target).toEqual({
      host: '10.0.2.2',
      port: 5434,
      database: 'supermais_erp_test',
      username: 'atlas_readonly',
      password: 'super-secret-erp-password',
    });
  });

  it('returns undefined when the file does not exist (no scan target configured)', () => {
    const dir = tempDir();
    const target = loadErpScanTarget(join(dir, 'does-not-exist.json'));
    expect(target).toBeUndefined();
  });

  it('returns undefined for a non-postgres dbType rather than silently misreading it as postgres', () => {
    const dir = tempDir();
    const filePath = writeStoredConnection(dir, { dbType: 'mysql' });
    const target = loadErpScanTarget(filePath);
    expect(target).toBeUndefined();
  });
});
