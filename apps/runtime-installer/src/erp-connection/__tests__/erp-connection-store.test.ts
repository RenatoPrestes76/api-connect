import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeErpConnection, type StoredErpConnection } from '../erp-connection-store.js';
import { decryptSecret } from '../../security/credential-encryption.js';
import type { ErpConnectionTarget } from '../connection-test.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-erp-conn-test-'));
  dirs.push(dir);
  return dir;
}

function aclSids(path: string): string[] {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Acl '${path}').Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }`,
    ],
    { encoding: 'utf-8' }
  );
  return output.trim().split(/\r?\n/).filter(Boolean);
}

/**
 * writeErpConnection's real icacls restriction (see the dedicated ACL
 * test below) locks the file to SYSTEM + Administrators immediately —
 * including against this (unprivileged) test process itself. The two
 * tests above care about file CONTENT, not ACL enforcement, so reset
 * it back to normal inherited access right after writing, the same way
 * apps/agent's windows-acl-test-cleanup.ts does for identity.json.
 */
function allowCurrentProcessToReadAgain(filePath: string): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('icacls.exe', [filePath, '/reset'], { stdio: 'ignore' });
  } catch {
    /* best-effort */
  }
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) {
      if (process.platform === 'win32') {
        try {
          execFileSync('icacls.exe', [dir, '/reset', '/t', '/c', '/q'], { stdio: 'ignore' });
        } catch {
          /* best-effort */
        }
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

const TARGET: ErpConnectionTarget = {
  dbType: 'postgres',
  host: '10.0.2.2',
  port: 5434,
  database: 'supermais_erp_test',
  username: 'atlas_readonly',
  password: 'super-secret-erp-password',
};

describe('writeErpConnection', () => {
  it('writes host/port/database/username in the clear but the password only as an EncryptedSecret', () => {
    const dir = tempDir();
    const filePath = join(dir, 'erp-connection.json');
    writeErpConnection(filePath, TARGET);
    allowCurrentProcessToReadAgain(filePath);

    const raw = readFileSync(filePath, 'utf-8');
    const stored = JSON.parse(raw) as StoredErpConnection;
    expect(stored.host).toBe(TARGET.host);
    expect(stored.port).toBe(TARGET.port);
    expect(stored.database).toBe(TARGET.database);
    expect(stored.username).toBe(TARGET.username);
    expect(raw).not.toContain(TARGET.password);
    expect(stored.encryptedPassword.scheme).toBe(
      process.platform === 'win32' ? 'dpapi' : 'aes-256-gcm-local'
    );
  });

  it('round-trips the password back to the exact original value', () => {
    const dir = tempDir();
    const filePath = join(dir, 'erp-connection.json');
    writeErpConnection(filePath, TARGET);
    allowCurrentProcessToReadAgain(filePath);

    const stored = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredErpConnection;
    const decrypted = decryptSecret(stored.encryptedPassword, dir);
    expect(decrypted).toBe(TARGET.password);
  });

  it.skipIf(process.platform !== 'win32')(
    'restricts the file to SYSTEM + Administrators (real icacls)',
    () => {
      const dir = tempDir();
      const filePath = join(dir, 'erp-connection.json');
      writeErpConnection(filePath, TARGET);

      expect(existsSync(filePath)).toBe(true);
      const sids = aclSids(filePath);
      expect(sids).toContain('S-1-5-18');
      expect(sids).toContain('S-1-5-32-544');
      expect(sids).toHaveLength(2);
    }
  );
});
