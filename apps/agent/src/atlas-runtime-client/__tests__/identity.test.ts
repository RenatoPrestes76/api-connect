import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrCreateIdentity, persistIdentity } from '../identity.js';
import { restoreAclForCleanup } from '../../__tests__/windows-acl-test-cleanup.js';

const dirs: string[] = [];
function tempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-identity-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) {
      restoreAclForCleanup(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('loadOrCreateIdentity', () => {
  it('generates a fresh Ed25519 keypair and fingerprint on first call', () => {
    const dir = tempDataDir();
    const identity = loadOrCreateIdentity(dir);
    expect(identity.runtimeId).toBeNull();
    expect(identity.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(identity.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(identity.fingerprint).toBeTruthy();
  });

  it('persists the identity so a second call returns the exact same keypair, not a new one', () => {
    const dir = tempDataDir();
    const first = loadOrCreateIdentity(dir);
    // Real production reads/writes of this file all happen under the one
    // account running the Windows service (LocalSystem by default), which
    // `restrictToSystemAndAdministrators` always grants — so this never
    // comes up there. This test, run by an unprivileged dev/CI account,
    // would otherwise EPERM on its own second call: see
    // windows-acl-test-cleanup.ts's doc comment.
    restoreAclForCleanup(dir);
    const second = loadOrCreateIdentity(dir);
    expect(second.privateKeyPem).toBe(first.privateKeyPem);
    expect(second.publicKeyPem).toBe(first.publicKeyPem);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it('the persisted file on disk never contains the private key in plain PEM — it is encrypted at rest', () => {
    const dir = tempDataDir();
    loadOrCreateIdentity(dir);
    restoreAclForCleanup(dir);
    const raw = readFileSync(join(dir, 'atlas-runtime-identity.json'), 'utf-8');
    const parsed = JSON.parse(raw) as {
      encryptedPrivateKey: { scheme: string; ciphertext: string };
    };
    expect(raw).not.toContain('BEGIN PRIVATE KEY');
    expect(parsed.encryptedPrivateKey.ciphertext).not.toContain('BEGIN PRIVATE KEY');
    expect(parsed.encryptedPrivateKey.scheme).toBe(
      process.platform === 'win32' ? 'dpapi' : 'aes-256-gcm-local'
    );
  });

  it('decrypts back to the exact same private key on a fresh load from disk', () => {
    const dir = tempDataDir();
    const original = loadOrCreateIdentity(dir);
    restoreAclForCleanup(dir);
    const reloaded = loadOrCreateIdentity(dir);
    expect(reloaded.privateKeyPem).toBe(original.privateKeyPem);
    expect(reloaded.privateKeyPem).toContain('BEGIN PRIVATE KEY');
  });
});

describe('persistIdentity', () => {
  it('round-trips a runtimeId assigned after registration', () => {
    const dir = tempDataDir();
    const identity = loadOrCreateIdentity(dir);
    restoreAclForCleanup(dir);
    const withRuntimeId = { ...identity, runtimeId: 'rt_abc123' };
    persistIdentity(dir, withRuntimeId);
    restoreAclForCleanup(dir);

    const reloaded = loadOrCreateIdentity(dir);
    expect(reloaded.runtimeId).toBe('rt_abc123');
  });
});
