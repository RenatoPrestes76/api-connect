import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  encryptSecret,
  decryptSecret,
  restrictToSystemAndAdministrators,
  _internal,
} from '../credential-encryption.js';

const dirs: string[] = [];
function tempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-credential-encryption-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('AES-256-GCM local fallback (platform-independent)', () => {
  it('round-trips a secret through encrypt/decrypt', () => {
    const dir = tempDataDir();
    const key = _internal.loadOrCreateLocalKey(dir);
    const ciphertext = _internal.aesEncrypt(Buffer.from('super-secret-value', 'utf-8'), key);
    const plaintext = _internal.aesDecrypt(ciphertext, key);
    expect(plaintext.toString('utf-8')).toBe('super-secret-value');
  });

  it('produces ciphertext that does not contain the plaintext', () => {
    const dir = tempDataDir();
    const key = _internal.loadOrCreateLocalKey(dir);
    const ciphertext = _internal.aesEncrypt(Buffer.from('BEGIN PRIVATE KEY', 'utf-8'), key);
    expect(ciphertext.toString('utf-8')).not.toContain('BEGIN PRIVATE KEY');
    expect(ciphertext.toString('base64')).not.toContain('BEGIN PRIVATE KEY');
  });

  it('persists the key once and reuses it on a second call (same dataDir)', () => {
    const dir = tempDataDir();
    const first = _internal.loadOrCreateLocalKey(dir);
    const second = _internal.loadOrCreateLocalKey(dir);
    expect(second).toEqual(first);
  });

  it('fails to decrypt with a different key (wrong key must not silently succeed)', () => {
    const dir = tempDataDir();
    const key = _internal.loadOrCreateLocalKey(dir);
    const ciphertext = _internal.aesEncrypt(Buffer.from('secret', 'utf-8'), key);
    const otherDir = tempDataDir();
    const otherKey = _internal.loadOrCreateLocalKey(otherDir);
    expect(() => _internal.aesDecrypt(ciphertext, otherKey)).toThrow();
  });
});

describe('DPAPI (Windows only)', () => {
  it.skipIf(process.platform !== 'win32')(
    'round-trips a secret through real Windows DPAPI (LocalMachine scope)',
    () => {
      const ciphertext = _internal.dpapiProtect(Buffer.from('atlas-runtime-private-key', 'utf-8'));
      expect(ciphertext.toString('base64')).not.toContain('atlas-runtime-private-key');
      const plaintext = _internal.dpapiUnprotect(ciphertext);
      expect(plaintext.toString('utf-8')).toBe('atlas-runtime-private-key');
    }
  );
});

describe('encryptSecret / decryptSecret (platform-dispatching public API)', () => {
  it('round-trips a secret end to end for the current platform', () => {
    const dir = tempDataDir();
    const secret = encryptSecret('BEGIN PRIVATE KEY...fake-pem...END PRIVATE KEY', dir);
    expect(secret.ciphertext).not.toContain('BEGIN PRIVATE KEY');
    expect(decryptSecret(secret, dir)).toBe('BEGIN PRIVATE KEY...fake-pem...END PRIVATE KEY');
  });

  it('picks the scheme matching the current platform', () => {
    const dir = tempDataDir();
    const secret = encryptSecret('value', dir);
    expect(secret.scheme).toBe(process.platform === 'win32' ? 'dpapi' : 'aes-256-gcm-local');
  });

  it('the local key file (non-Windows fallback), if created, is never plaintext-adjacent to a readable secret value', () => {
    const dir = tempDataDir();
    if (process.platform === 'win32') return; // DPAPI path doesn't create a local key file.
    encryptSecret('value', dir);
    const keyRaw = readFileSync(join(dir, '.local-encryption-key'), 'utf-8');
    expect(keyRaw).not.toContain('value');
  });

  it('a corrupted/tampered ciphertext fails to decrypt rather than silently returning garbage as if valid', () => {
    const dir = tempDataDir();
    const secret = encryptSecret('value', dir);
    const tampered = {
      ...secret,
      ciphertext: Buffer.from('not-the-real-ciphertext').toString('base64'),
    };
    expect(() => decryptSecret(tampered, dir)).toThrow();
  });
});

/** Lists each ACE's identity as a SID string (locale/display-name independent). */
function aclSids(filePath: string): string[] {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Acl '${filePath}').Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }`,
    ],
    { encoding: 'utf-8' }
  );
  return output.trim().split(/\r?\n/).filter(Boolean);
}

describe('restrictToSystemAndAdministrators (Windows only)', () => {
  it.skipIf(process.platform !== 'win32')(
    "removes the current user's own ACE and leaves only SYSTEM + Administrators, via real icacls",
    () => {
      const dir = tempDataDir();
      const filePath = join(dir, 'identity-acl-test.json');
      writeFileSync(filePath, '{}', 'utf-8');

      // Before: NTFS inheritance grants the current Windows user's own
      // account SID direct access — this is the exact exposure the fix
      // closes (a standard user on this same machine could otherwise
      // just open the file). Identified by SID, not by username string
      // matching, since the temp path itself also contains the username.
      const currentUserSid = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value',
        ],
        { encoding: 'utf-8' }
      ).trim();
      expect(aclSids(filePath)).toContain(currentUserSid);

      restrictToSystemAndAdministrators(filePath);

      try {
        const afterSids = aclSids(filePath);
        // The current user's own account SID is no longer a grantee...
        expect(afterSids).not.toContain(currentUserSid);
        // ...and SYSTEM (S-1-5-18) + Administrators (S-1-5-32-544) are —
        // by well-known SID, not a locale-specific display name.
        expect(afterSids).toContain('S-1-5-18');
        expect(afterSids).toContain('S-1-5-32-544');
        expect(afterSids).toHaveLength(2);
      } finally {
        // Restore access so afterEach's rmSync can clean up this temp
        // dir — this dev account's own process is unelevated even
        // though it's an Administrators member, so without this the
        // ACL this test just proved matches real-world standard-user
        // lockout would also lock this same cleanup out.
        execFileSync('icacls.exe', [filePath, '/grant', `*${currentUserSid}:F`], {
          stdio: 'ignore',
        });
      }
    }
  );

  it('is a no-op on non-Windows (never throws, never blocks identity persistence)', () => {
    if (process.platform === 'win32') return;
    const dir = tempDataDir();
    const filePath = join(dir, 'identity-acl-test.json');
    writeFileSync(filePath, '{}', 'utf-8');
    expect(() => restrictToSystemAndAdministrators(filePath)).not.toThrow();
  });
});
