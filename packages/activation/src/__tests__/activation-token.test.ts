import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ActivationToken,
  ActivationTokenError,
  DEFAULT_EXPIRY_MINUTES,
} from '../entity/activation-token.js';

const NOW = new Date('2026-06-30T12:00:00.000Z');

describe('ActivationToken — generation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('generates a token in ATLAS-XXXX-XXXX-XXXX format', () => {
    const t = ActivationToken.generate('comp-1', 'production');
    expect(t.token).toMatch(/^ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('each generated token is unique', () => {
    const tokens = Array.from(
      { length: 100 },
      () => ActivationToken.generate('comp-1', 'production').token
    );
    const unique = new Set(tokens);
    expect(unique.size).toBe(100);
  });

  it('defaults expiry to DEFAULT_EXPIRY_MINUTES', () => {
    const t = ActivationToken.generate('comp-1', 'production');
    const expectedMs = DEFAULT_EXPIRY_MINUTES * 60_000;
    expect(t.expiresAt.getTime()).toBe(NOW.getTime() + expectedMs);
  });

  it('respects custom expiry minutes', () => {
    const t = ActivationToken.generate('comp-1', 'production', 60);
    expect(t.expiresAt.getTime()).toBe(NOW.getTime() + 60 * 60_000);
  });

  it('stores companyId, environment, createdBy', () => {
    const t = ActivationToken.generate('acme', 'staging', 30, 'admin@example.com');
    expect(t.companyId).toBe('acme');
    expect(t.environment).toBe('staging');
    expect(t.createdBy).toBe('admin@example.com');
  });

  it('createdBy defaults to null when omitted', () => {
    const t = ActivationToken.generate('acme', 'production');
    expect(t.createdBy).toBeNull();
  });

  it('throws on empty companyId', () => {
    expect(() => ActivationToken.generate('', 'production')).toThrow(ActivationTokenError);
  });

  it('throws on whitespace-only companyId', () => {
    expect(() => ActivationToken.generate('   ', 'production')).toThrow(ActivationTokenError);
  });

  it('throws on non-positive expiresInMinutes', () => {
    expect(() => ActivationToken.generate('acme', 'production', 0)).toThrow(ActivationTokenError);
    expect(() => ActivationToken.generate('acme', 'production', -5)).toThrow(ActivationTokenError);
  });

  it('throws on invalid environment', () => {
    // @ts-expect-error — testing invalid value
    expect(() => ActivationToken.generate('acme', 'invalid-env')).toThrow(ActivationTokenError);
  });
});

describe('ActivationToken — validity checks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('isValid() true for a fresh token', () => {
    const t = ActivationToken.generate('acme', 'production');
    expect(t.isValid()).toBe(true);
    expect(t.isExpired()).toBe(false);
    expect(t.isUsed()).toBe(false);
  });

  it('isExpired() true after expiresAt passes', () => {
    const t = ActivationToken.generate('acme', 'production', 10);
    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    expect(t.isExpired()).toBe(true);
    expect(t.isValid()).toBe(false);
  });

  it('isUsed() false on fresh token, true after markUsed()', () => {
    const t = ActivationToken.generate('acme', 'production');
    const used = t.markUsed();
    expect(t.isUsed()).toBe(false);
    expect(used.isUsed()).toBe(true);
    expect(used.usedAt).toEqual(NOW);
  });

  it('markUsed() throws on already-used token', () => {
    const t = ActivationToken.generate('acme', 'production');
    const used = t.markUsed();
    expect(() => used.markUsed()).toThrow(ActivationTokenError);
  });

  it('markUsed() throws on expired token', () => {
    const t = ActivationToken.generate('acme', 'production', 5);
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    expect(() => t.markUsed()).toThrow(ActivationTokenError);
  });
});

describe('ActivationToken — snapshot roundtrip', () => {
  it('fromSnapshot → toSnapshot round-trips losslessly', () => {
    const original = ActivationToken.generate('acme', 'development', 15, 'installer');
    const restored = ActivationToken.fromSnapshot(original.toSnapshot());
    expect(restored.id).toBe(original.id);
    expect(restored.token).toBe(original.token);
    expect(restored.companyId).toBe(original.companyId);
    expect(restored.environment).toBe(original.environment);
    expect(restored.expiresAt).toEqual(original.expiresAt);
    expect(restored.createdBy).toBe(original.createdBy);
  });
});
