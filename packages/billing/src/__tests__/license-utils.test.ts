import { describe, it, expect } from 'vitest';
import {
  generateLicenseKey,
  generateSignature,
  validateSignature,
  isValidKeyFormat,
  keyFingerprint,
} from '../license-utils.js';

describe('generateLicenseKey', () => {
  it('produces a string matching ATLAS-{PLAN}-{4x4} format', () => {
    const key = generateLicenseKey('tenant-1', 'professional');
    expect(isValidKeyFormat(key)).toBe(true);
  });

  it('starts with ATLAS-PROF for professional', () => {
    const key = generateLicenseKey('tenant-1', 'professional');
    expect(key.startsWith('ATLAS-PROF-')).toBe(true);
  });

  it('starts with ATLAS-COMM for community', () => {
    const key = generateLicenseKey('tenant-1', 'community');
    expect(key.startsWith('ATLAS-COMM-')).toBe(true);
  });

  it('starts with ATLAS-ENTE for enterprise', () => {
    const key = generateLicenseKey('tenant-1', 'enterprise');
    expect(key.startsWith('ATLAS-ENTE-')).toBe(true);
  });

  it('generates unique keys for same inputs (different timestamp)', async () => {
    const k1 = generateLicenseKey('tenant-1', 'professional');
    await new Promise((r) => setTimeout(r, 2));
    const k2 = generateLicenseKey('tenant-1', 'professional');
    expect(k1).not.toBe(k2);
  });
});

describe('generateSignature / validateSignature', () => {
  it('validates a freshly generated signature', () => {
    const key = generateLicenseKey('tenant-abc', 'enterprise');
    const sig = generateSignature(key, 'tenant-abc', 'enterprise');
    expect(validateSignature(key, 'tenant-abc', 'enterprise', sig)).toBe(true);
  });

  it('rejects a tampered key', () => {
    const key = generateLicenseKey('tenant-abc', 'enterprise');
    const sig = generateSignature(key, 'tenant-abc', 'enterprise');
    expect(validateSignature(key + 'X', 'tenant-abc', 'enterprise', sig)).toBe(false);
  });

  it('rejects a tampered tenantId', () => {
    const key = generateLicenseKey('tenant-abc', 'professional');
    const sig = generateSignature(key, 'tenant-abc', 'professional');
    expect(validateSignature(key, 'tenant-EVIL', 'professional', sig)).toBe(false);
  });

  it('rejects a tampered planSlug', () => {
    const key = generateLicenseKey('tenant-abc', 'community');
    const sig = generateSignature(key, 'tenant-abc', 'community');
    expect(validateSignature(key, 'tenant-abc', 'enterprise', sig)).toBe(false);
  });

  it('rejects a garbage signature', () => {
    const key = generateLicenseKey('t', 'professional');
    expect(validateSignature(key, 't', 'professional', 'not-hex')).toBe(false);
  });
});

describe('isValidKeyFormat', () => {
  it('accepts a well-formed key', () => {
    expect(isValidKeyFormat('ATLAS-PROF-1A2B-3C4D-5E6F-7890')).toBe(true);
  });

  it('rejects lowercase', () => {
    expect(isValidKeyFormat('atlas-prof-1a2b-3c4d-5e6f-7890')).toBe(false);
  });

  it('rejects extra segments', () => {
    expect(isValidKeyFormat('ATLAS-PROF-1A2B-3C4D-5E6F-7890-XXXX')).toBe(false);
  });
});

describe('keyFingerprint', () => {
  it('returns a 12-char uppercase hex string', () => {
    const fp = keyFingerprint('ATLAS-PROF-AAAA-BBBB-CCCC-DDDD');
    expect(fp).toMatch(/^[0-9A-F]{12}$/);
  });

  it('is deterministic', () => {
    const key = 'ATLAS-PROF-AAAA-BBBB-CCCC-DDDD';
    expect(keyFingerprint(key)).toBe(keyFingerprint(key));
  });
});
