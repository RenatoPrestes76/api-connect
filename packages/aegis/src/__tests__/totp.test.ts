import { describe, it, expect } from 'vitest';
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotpToken,
  verifyTotpToken,
  buildOtpUri,
  generateBackupCodes,
} from '../totp.js';

const FIXED_TIME_MS = 1_700_000_000_000; // deterministic timestamp

describe('base32Encode / base32Decode', () => {
  it('round-trips a known buffer', () => {
    const buf = Buffer.from([0x00, 0xff, 0x80, 0x40, 0x20]);
    const encoded = base32Encode(buf);
    expect(base32Decode(encoded)).toEqual(buf);
  });

  it('encoded string uses only base32 alphabet', () => {
    const encoded = base32Encode(Buffer.from('atlas-connect'));
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
  });

  it('ignores invalid characters in decode', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03]);
    const clean = base32Encode(buf);
    const withNoise = clean.split('').join('-');
    expect(base32Decode(withNoise)).toEqual(buf);
  });
});

describe('generateTotpSecret', () => {
  it('returns a non-empty base32 string', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(10);
  });

  it('generates unique secrets', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe('generateTotpToken', () => {
  it('returns a 6-digit zero-padded string', () => {
    const secret = base32Decode(generateTotpSecret());
    const token = generateTotpToken(secret, FIXED_TIME_MS);
    expect(token).toMatch(/^\d{6}$/);
  });

  it('same time → same token (deterministic)', () => {
    const secret = base32Decode(generateTotpSecret());
    expect(generateTotpToken(secret, FIXED_TIME_MS)).toBe(generateTotpToken(secret, FIXED_TIME_MS));
  });

  it('different 30-second windows → different tokens', () => {
    const secret = base32Decode(generateTotpSecret());
    const t1 = generateTotpToken(secret, FIXED_TIME_MS);
    const t2 = generateTotpToken(secret, FIXED_TIME_MS + 30_000);
    // Statistically extremely unlikely to collide
    expect(t1).not.toBe(t2);
  });
});

describe('verifyTotpToken', () => {
  it('verifies a token generated at the same time', () => {
    const secret = base32Decode(generateTotpSecret());
    const token = generateTotpToken(secret, FIXED_TIME_MS);
    expect(verifyTotpToken(secret, token, FIXED_TIME_MS)).toBe(true);
  });

  it('rejects a wrong token', () => {
    const secret = base32Decode(generateTotpSecret());
    expect(verifyTotpToken(secret, '000000', FIXED_TIME_MS)).toBe(false);
  });

  it('accepts a token from the previous window (drift tolerance)', () => {
    const secret = base32Decode(generateTotpSecret());
    const prevToken = generateTotpToken(secret, FIXED_TIME_MS - 30_000);
    expect(verifyTotpToken(secret, prevToken, FIXED_TIME_MS, 1)).toBe(true);
  });

  it('rejects a token from 2 windows ago with window=1', () => {
    const secret = base32Decode(generateTotpSecret());
    const oldToken = generateTotpToken(secret, FIXED_TIME_MS - 60_000);
    expect(verifyTotpToken(secret, oldToken, FIXED_TIME_MS, 1)).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const secret = base32Decode(generateTotpSecret());
    expect(verifyTotpToken(secret, 'abcdef', FIXED_TIME_MS)).toBe(false);
  });
});

describe('buildOtpUri', () => {
  it('builds a valid otpauth URI', () => {
    const uri = buildOtpUri('Atlas Connect', 'user@example.com', 'JBSWY3DPEHPK3PXP');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=Atlas+Connect');
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });
});

describe('generateBackupCodes', () => {
  it('returns the requested number of codes', () => {
    expect(generateBackupCodes(8)).toHaveLength(8);
    expect(generateBackupCodes(3)).toHaveLength(3);
  });

  it('codes match the XXXXX-XXXXX format', () => {
    for (const code of generateBackupCodes()) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });

  it('all codes are unique', () => {
    const codes = generateBackupCodes(8);
    expect(new Set(codes).size).toBe(8);
  });
});
