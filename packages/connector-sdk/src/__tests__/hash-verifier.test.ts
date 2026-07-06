import { describe, it, expect } from 'vitest';
import { sha256, verifyHash, HashMismatchError } from '../security/hash-verifier.js';

describe('sha256', () => {
  it('produces a 64-character hex digest', () => {
    const hash = sha256(Buffer.from('hello'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a known hash for "hello"', () => {
    // echo -n hello | sha256sum → 2cf24dba...
    expect(sha256(Buffer.from('hello'))).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('is deterministic', () => {
    const buf = Buffer.from('deterministic content');
    expect(sha256(buf)).toBe(sha256(buf));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256(Buffer.from('a'))).not.toBe(sha256(Buffer.from('b')));
  });
});

describe('verifyHash', () => {
  it('does not throw when hash matches', () => {
    const buf  = Buffer.from('test bundle content');
    const hash = sha256(buf);
    expect(() => verifyHash(buf, hash)).not.toThrow();
  });

  it('throws HashMismatchError when hash does not match', () => {
    const buf = Buffer.from('original');
    expect(() => verifyHash(buf, 'a'.repeat(64))).toThrow(HashMismatchError);
  });

  it('is case-insensitive for the expected hash', () => {
    const buf  = Buffer.from('case test');
    const hash = sha256(buf).toUpperCase();
    expect(() => verifyHash(buf, hash)).not.toThrow();
  });

  it('HashMismatchError contains both expected and actual hashes', () => {
    const buf  = Buffer.from('tampered');
    const fake = 'b'.repeat(64);
    try {
      verifyHash(buf, fake);
    } catch (err) {
      expect(err).toBeInstanceOf(HashMismatchError);
      expect((err as HashMismatchError).expected).toBe(fake.toLowerCase());
      expect((err as HashMismatchError).actual).toBe(sha256(buf));
    }
  });
});
