import { describe, it, expect } from 'vitest';
import { Encryptor } from '../encryption/encryptor.js';
import { randomBytes } from 'crypto';

const KEY     = randomBytes(32);
const PAYLOAD = Buffer.from('{"id":1,"nome":"Produto Secreto"}');

describe('Encryptor — AES-256-GCM', () => {
  const enc = new Encryptor({ enabled: true, algorithm: 'aes-256-gcm', keyId: 'test-key-v1' });

  it('encrypts and returns ciphertext + iv + authTag', async () => {
    const result = await enc.encrypt(PAYLOAD, KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ciphertext).toBeDefined();
      expect(result.value.iv).toBeDefined();
      expect(result.value.authTag).toBeDefined();
      expect(result.value.keyId).toBe('test-key-v1');
      expect(result.value.ciphertext).not.toEqual(PAYLOAD);
    }
  });

  it('decrypts back to original plaintext', async () => {
    const encrypted = await enc.encrypt(PAYLOAD, KEY);
    expect(encrypted.ok).toBe(true);
    if (encrypted.ok) {
      const { ciphertext, iv, authTag } = encrypted.value;
      const decrypted = await enc.decrypt(ciphertext, iv, authTag, KEY);
      expect(decrypted.ok).toBe(true);
      if (decrypted.ok) {
        expect(decrypted.value.toString('utf-8')).toBe(PAYLOAD.toString('utf-8'));
      }
    }
  });

  it('produces different ciphertexts for same input (random IV)', async () => {
    const r1 = await enc.encrypt(PAYLOAD, KEY);
    const r2 = await enc.encrypt(PAYLOAD, KEY);
    if (r1.ok && r2.ok) {
      expect(r1.value.ciphertext.toString('hex')).not.toBe(r2.value.ciphertext.toString('hex'));
    }
  });

  it('fails decryption with wrong key', async () => {
    const encrypted = await enc.encrypt(PAYLOAD, KEY);
    if (encrypted.ok) {
      const { ciphertext, iv, authTag } = encrypted.value;
      const wrongKey = randomBytes(32);
      const result = await enc.decrypt(ciphertext, iv, authTag, wrongKey);
      expect(result.ok).toBe(false);
    }
  });

  it('fails decryption with tampered authTag', async () => {
    const encrypted = await enc.encrypt(PAYLOAD, KEY);
    if (encrypted.ok) {
      const { ciphertext, iv } = encrypted.value;
      const tampered = 'ff'.repeat(16);
      const result = await enc.decrypt(ciphertext, iv, tampered, KEY);
      expect(result.ok).toBe(false);
    }
  });

  it('returns INVALID_KEY error for wrong-length key', async () => {
    const shortKey = randomBytes(16);
    const result = await enc.encrypt(PAYLOAD, shortKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_KEY');
  });
});

describe('Encryptor — disabled', () => {
  it('returns plaintext unchanged with empty iv/authTag', async () => {
    const enc = new Encryptor({ enabled: false, algorithm: 'aes-256-gcm', keyId: 'none' });
    const result = await enc.encrypt(PAYLOAD, KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ciphertext).toEqual(PAYLOAD);
      expect(result.value.iv).toBe('');
      expect(result.value.authTag).toBe('');
    }
  });

  it('decrypt with disabled encryptor returns ciphertext as-is', async () => {
    const enc = new Encryptor({ enabled: false, algorithm: 'aes-256-gcm', keyId: 'none' });
    const result = await enc.decrypt(PAYLOAD, '', '', KEY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(PAYLOAD);
  });
});
