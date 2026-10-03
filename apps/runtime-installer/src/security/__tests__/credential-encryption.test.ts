import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptSecret, decryptSecret, _internal } from '../credential-encryption.js';

const dirs: string[] = [];
function tempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-installer-credential-encryption-test-'));
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
    const ciphertext = _internal.aesEncrypt(Buffer.from('runtime-token-value', 'utf-8'), key);
    const plaintext = _internal.aesDecrypt(ciphertext, key);
    expect(plaintext.toString('utf-8')).toBe('runtime-token-value');
  });

  it('fails to decrypt with a different key', () => {
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
      const ciphertext = _internal.dpapiProtect(Buffer.from('runtime-cloud-token', 'utf-8'));
      expect(ciphertext.toString('base64')).not.toContain('runtime-cloud-token');
      const plaintext = _internal.dpapiUnprotect(ciphertext);
      expect(plaintext.toString('utf-8')).toBe('runtime-cloud-token');
    }
  );
});

describe('encryptSecret / decryptSecret (platform-dispatching public API)', () => {
  it('round-trips a secret end to end for the current platform', () => {
    const dir = tempDataDir();
    const secret = encryptSecret('rt_super_secret_token', dir);
    expect(secret.ciphertext).not.toContain('rt_super_secret_token');
    expect(decryptSecret(secret, dir)).toBe('rt_super_secret_token');
  });

  it('picks the scheme matching the current platform', () => {
    const dir = tempDataDir();
    const secret = encryptSecret('value', dir);
    expect(secret.scheme).toBe(process.platform === 'win32' ? 'dpapi' : 'aes-256-gcm-local');
  });

  it('the local key file (non-Windows fallback), if created, never contains the secret value', () => {
    const dir = tempDataDir();
    if (process.platform === 'win32') return; // DPAPI path doesn't create a local key file.
    encryptSecret('rt_super_secret_token', dir);
    const keyRaw = readFileSync(join(dir, '.local-encryption-key'), 'utf-8');
    expect(keyRaw).not.toContain('rt_super_secret_token');
  });
});
