import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { CredentialStore } from './credential-store.js';
import { CredentialNotFoundError } from './credential-store.js';

/**
 * In-memory credential store that encrypts values with AES-256-GCM.
 * Suitable for testing and development. In production, use the OS keychain
 * or an HSM-backed implementation.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly _key:   Buffer;
  private readonly _store: Map<string, Buffer>;

  constructor() {
    this._key   = randomBytes(32); // AES-256 key, unique per instance
    this._store = new Map();
  }

  async set(key: string, secret: string): Promise<void> {
    const iv         = randomBytes(12);
    const cipher     = createCipheriv('aes-256-gcm', this._key, iv);
    const encrypted  = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag    = cipher.getAuthTag();
    // Layout: [iv(12)] [authTag(16)] [ciphertext]
    const packed     = Buffer.concat([iv, authTag, encrypted]);
    this._store.set(key, packed);
  }

  async get(key: string): Promise<string | null> {
    const packed = this._store.get(key);
    if (!packed) return null;

    const iv         = packed.subarray(0, 12);
    const authTag    = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher   = createDecipheriv('aes-256-gcm', this._key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }

  async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) throw new CredentialNotFoundError(key);
    return value;
  }

  async delete(key: string): Promise<void> {
    this._store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this._store.has(key);
  }

  get size(): number { return this._store.size; }
  clear(): void      { this._store.clear(); }
}
