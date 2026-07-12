import { describe, it, expect } from 'vitest';
import {
  envelopeEncrypt,
  envelopeDecrypt,
  serializeEnvelope,
  deserializeEnvelope,
  hmacSign,
  hmacVerify,
  generateKey,
  generateNonce,
  sha256,
  signRequest,
  verifySignedRequest,
} from '../crypto.js';

describe('envelopeEncrypt / envelopeDecrypt', () => {
  it('encrypts and decrypts a plaintext string', () => {
    const plaintext = 'super-secret-password';
    const envelope = envelopeEncrypt(plaintext);
    expect(envelopeDecrypt(envelope)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const env1 = envelopeEncrypt('same');
    const env2 = envelopeEncrypt('same');
    expect(env1.payload.iv).not.toBe(env2.payload.iv);
    expect(env1.payload.data).not.toBe(env2.payload.data);
  });

  it('envelope has version field', () => {
    const env = envelopeEncrypt('test');
    expect(env.version).toBe('aegis-aes256gcm-v1');
  });

  it('throws on tampered payload data', () => {
    const env = envelopeEncrypt('value');
    const tampered = { ...env, payload: { ...env.payload, data: 'AAAA' } };
    expect(() => envelopeDecrypt(tampered)).toThrow();
  });

  it('throws on tampered authTag', () => {
    const env = envelopeEncrypt('value');
    const tampered = { ...env, payload: { ...env.payload, authTag: 'AAAA' } };
    expect(() => envelopeDecrypt(tampered)).toThrow();
  });

  it('round-trips through serialization', () => {
    const plaintext = 'serialize me!';
    const env = envelopeEncrypt(plaintext);
    const json = serializeEnvelope(env);
    const restored = deserializeEnvelope(json);
    expect(envelopeDecrypt(restored)).toBe(plaintext);
  });

  it('encrypts unicode and special characters', () => {
    const secret = 'pão-de-queijo 🧀 & <tags>';
    expect(envelopeDecrypt(envelopeEncrypt(secret))).toBe(secret);
  });
});

describe('hmacSign / hmacVerify', () => {
  it('verifies a freshly signed payload', () => {
    const sig = hmacSign('hello world', 'test-key');
    expect(hmacVerify('hello world', sig, 'test-key')).toBe(true);
  });

  it('rejects tampered payload', () => {
    const sig = hmacSign('original', 'key');
    expect(hmacVerify('tampered', sig, 'key')).toBe(false);
  });

  it('rejects wrong key', () => {
    const sig = hmacSign('data', 'correct-key');
    expect(hmacVerify('data', sig, 'wrong-key')).toBe(false);
  });

  it('rejects garbage signature', () => {
    expect(hmacVerify('data', 'not-hex', 'key')).toBe(false);
  });
});

describe('generateKey / generateNonce / sha256', () => {
  it('generateKey returns 64 hex chars by default (32 bytes)', () => {
    const key = generateKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateKey with custom byte length', () => {
    expect(generateKey(16)).toHaveLength(32);
  });

  it('generateNonce returns 24 hex chars', () => {
    expect(generateNonce()).toMatch(/^[0-9a-f]{24}$/);
  });

  it('sha256 is deterministic', () => {
    expect(sha256('atlas')).toBe(sha256('atlas'));
    expect(sha256('atlas')).toHaveLength(64);
  });
});

describe('signRequest / verifySignedRequest', () => {
  it('verifies a freshly signed request', () => {
    const body = JSON.stringify({ action: 'test' });
    const signed = signRequest(body, 'webhook-secret');
    expect(verifySignedRequest(body, signed, 'webhook-secret')).toBe(true);
  });

  it('rejects tampered body', () => {
    const signed = signRequest('original', 'key');
    expect(verifySignedRequest('tampered', signed, 'key')).toBe(false);
  });

  it('rejects expired timestamp', () => {
    const body = 'payload';
    const signed = signRequest(body, 'key');
    const old = { ...signed, timestamp: String(Date.now() - 600_000) };
    expect(verifySignedRequest(body, old, 'key', 300_000)).toBe(false);
  });
});
