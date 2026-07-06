import { describe, it, expect } from 'vitest';
import { InMemoryCredentialStore } from '../credentials/in-memory-credential-store.js';
import { CredentialNotFoundError } from '../credentials/credential-store.js';

describe('InMemoryCredentialStore', () => {
  it('stores and retrieves a secret', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('db.password', 'super-secret-123');
    expect(await store.get('db.password')).toBe('super-secret-123');
  });

  it('returns null for an unknown key', async () => {
    const store = new InMemoryCredentialStore();
    expect(await store.get('unknown')).toBeNull();
  });

  it('getRequired throws CredentialNotFoundError for missing key', async () => {
    const store = new InMemoryCredentialStore();
    await expect(store.getRequired('missing')).rejects.toBeInstanceOf(CredentialNotFoundError);
  });

  it('has() returns true after set, false after delete', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('token', 'abc');
    expect(await store.has('token')).toBe(true);

    await store.delete('token');
    expect(await store.has('token')).toBe(false);
  });

  it('overwrites a secret with a new value', async () => {
    const store = new InMemoryCredentialStore();
    await store.set('key', 'v1');
    await store.set('key', 'v2');
    expect(await store.get('key')).toBe('v2');
  });

  it('each instance has an independent key (encryption is per-instance)', async () => {
    const store1 = new InMemoryCredentialStore();
    const store2 = new InMemoryCredentialStore();
    await store1.set('x', 'secret');
    expect(await store2.get('x')).toBeNull();
  });

  it('stores unicode secrets correctly', async () => {
    const store = new InMemoryCredentialStore();
    const secret = '日本語パスワード🔑';
    await store.set('unicode', secret);
    expect(await store.get('unicode')).toBe(secret);
  });
});
