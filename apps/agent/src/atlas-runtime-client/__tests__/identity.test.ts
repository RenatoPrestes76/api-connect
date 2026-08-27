import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrCreateIdentity, persistIdentity } from '../identity.js';

const dirs: string[] = [];
function tempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-identity-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
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
    const second = loadOrCreateIdentity(dir);
    expect(second.privateKeyPem).toBe(first.privateKeyPem);
    expect(second.publicKeyPem).toBe(first.publicKeyPem);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it('the persisted file on disk contains the private key in plain PEM (protection is non-transmission, not encryption-at-rest)', () => {
    const dir = tempDataDir();
    const identity = loadOrCreateIdentity(dir);
    const raw = readFileSync(join(dir, 'atlas-runtime-identity.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { privateKeyPem: string };
    expect(parsed.privateKeyPem).toBe(identity.privateKeyPem);
    expect(raw).toContain('BEGIN PRIVATE KEY');
  });
});

describe('persistIdentity', () => {
  it('round-trips a runtimeId assigned after registration', () => {
    const dir = tempDataDir();
    const identity = loadOrCreateIdentity(dir);
    const withRuntimeId = { ...identity, runtimeId: 'rt_abc123' };
    persistIdentity(dir, withRuntimeId);

    const reloaded = loadOrCreateIdentity(dir);
    expect(reloaded.runtimeId).toBe('rt_abc123');
  });
});
