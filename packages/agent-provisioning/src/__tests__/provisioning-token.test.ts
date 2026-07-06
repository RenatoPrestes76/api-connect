import { describe, it, expect, vi } from 'vitest';
import {
  ProvisioningToken,
  ProvisioningTokenDomainError,
  hashProvisioningToken,
  extractTokenPrefix,
} from '../entity/provisioning-token.js';

const FUTURE = new Date(Date.now() + 86_400_000); // +1 day
const PAST   = new Date(Date.now() - 1_000);       // 1 second ago

const BASE = {
  companyId:   'company-abc',
  description: 'CI pipeline token',
  expiresAt:   FUTURE,
};

describe('hashProvisioningToken()', () => {
  it('produces a 64-char hex SHA-256 hash', () => {
    const hash = hashProvisioningToken('slp_abc');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(hashProvisioningToken('slp_abc')).toBe(hashProvisioningToken('slp_abc'));
  });

  it('differs for different inputs', () => {
    expect(hashProvisioningToken('slp_aaa')).not.toBe(hashProvisioningToken('slp_bbb'));
  });
});

describe('extractTokenPrefix()', () => {
  it('returns the first 12 characters', () => {
    expect(extractTokenPrefix('slp_abcdefghijk')).toBe('slp_abcdefgh');
  });
});

describe('ProvisioningToken.create()', () => {
  it('returns a token entity and a raw token string', () => {
    const { token, rawToken } = ProvisioningToken.create(BASE);
    expect(token).toBeInstanceOf(ProvisioningToken);
    expect(typeof rawToken).toBe('string');
    expect(rawToken.startsWith('slp_')).toBe(true);
  });

  it('raw token is never stored in the entity', () => {
    const { token, rawToken } = ProvisioningToken.create(BASE);
    const snap = token.toSnapshot();
    expect(JSON.stringify(snap)).not.toContain(rawToken);
  });

  it('tokenHash is the SHA-256 of the raw token', () => {
    const { token, rawToken } = ProvisioningToken.create(BASE);
    expect(token.tokenHash).toBe(hashProvisioningToken(rawToken));
  });

  it('tokenPrefix is the first 12 chars of raw token', () => {
    const { token, rawToken } = ProvisioningToken.create(BASE);
    expect(token.tokenPrefix).toBe(rawToken.slice(0, 12));
  });

  it('sets companyId, description, expiresAt', () => {
    const { token } = ProvisioningToken.create(BASE);
    expect(token.companyId).toBe('company-abc');
    expect(token.description).toBe('CI pipeline token');
    expect(token.expiresAt).toEqual(FUTURE);
  });

  it('revokedAt and lastUsedAt are null initially', () => {
    const { token } = ProvisioningToken.create(BASE);
    expect(token.revokedAt).toBeNull();
    expect(token.lastUsedAt).toBeNull();
  });

  it('uses a custom id generator when provided', () => {
    const { token } = ProvisioningToken.create(BASE, () => 'fixed-id');
    expect(token.id).toBe('fixed-id');
  });

  it('throws when companyId is empty', () => {
    expect(() => ProvisioningToken.create({ ...BASE, companyId: '' }))
      .toThrowError(ProvisioningTokenDomainError);
  });

  it('throws when description is blank', () => {
    expect(() => ProvisioningToken.create({ ...BASE, description: '   ' }))
      .toThrowError(ProvisioningTokenDomainError);
  });

  it('throws when expiresAt is in the past', () => {
    expect(() => ProvisioningToken.create({ ...BASE, expiresAt: PAST }))
      .toThrowError(ProvisioningTokenDomainError);
  });

  it('each call generates a different raw token', () => {
    const { rawToken: a } = ProvisioningToken.create(BASE);
    const { rawToken: b } = ProvisioningToken.create(BASE);
    expect(a).not.toBe(b);
  });
});

describe('ProvisioningToken — isValid / isExpired / isRevoked', () => {
  it('isValid() is true for a fresh token', () => {
    const { token } = ProvisioningToken.create(BASE);
    expect(token.isValid()).toBe(true);
    expect(token.isExpired()).toBe(false);
    expect(token.isRevoked()).toBe(false);
  });

  it('isExpired() is true when expiresAt is in the past', () => {
    const snap = ProvisioningToken.create(BASE).token.toSnapshot();
    const expired = ProvisioningToken.fromSnapshot({ ...snap, expiresAt: PAST });
    expect(expired.isExpired()).toBe(true);
    expect(expired.isValid()).toBe(false);
  });

  it('isRevoked() is true when revokedAt is set', () => {
    const snap    = ProvisioningToken.create(BASE).token.toSnapshot();
    const revoked = ProvisioningToken.fromSnapshot({ ...snap, revokedAt: new Date() });
    expect(revoked.isRevoked()).toBe(true);
    expect(revoked.isValid()).toBe(false);
  });
});

describe('ProvisioningToken.revoke()', () => {
  it('sets revokedAt and makes isRevoked() true', () => {
    const { token } = ProvisioningToken.create(BASE);
    token.revoke();
    expect(token.isRevoked()).toBe(true);
    expect(token.revokedAt).toBeInstanceOf(Date);
  });

  it('is idempotent', () => {
    const { token } = ProvisioningToken.create(BASE);
    token.revoke();
    const firstRevoke = token.revokedAt!;
    token.revoke();
    expect(token.revokedAt).toEqual(firstRevoke); // not changed
  });

  it('updates updatedAt', () => {
    const { token } = ProvisioningToken.create(BASE);
    const before = token.updatedAt;
    token.revoke();
    expect(token.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('ProvisioningToken.markUsed()', () => {
  it('sets lastUsedAt on a valid token', () => {
    const { token } = ProvisioningToken.create(BASE);
    token.markUsed();
    expect(token.lastUsedAt).toBeInstanceOf(Date);
  });

  it('throws when token is revoked', () => {
    const { token } = ProvisioningToken.create(BASE);
    token.revoke();
    expect(() => token.markUsed()).toThrowError(ProvisioningTokenDomainError);
  });

  it('throws when token is expired', () => {
    const snap    = ProvisioningToken.create(BASE).token.toSnapshot();
    const expired = ProvisioningToken.fromSnapshot({ ...snap, expiresAt: PAST });
    expect(() => expired.markUsed()).toThrowError(ProvisioningTokenDomainError);
  });
});

describe('ProvisioningToken.fromSnapshot() / toSnapshot()', () => {
  it('round-trips correctly', () => {
    const { token } = ProvisioningToken.create(BASE);
    token.revoke();
    const snap      = token.toSnapshot();
    const restored  = ProvisioningToken.fromSnapshot(snap);
    expect(restored.id).toBe(token.id);
    expect(restored.companyId).toBe(token.companyId);
    expect(restored.tokenHash).toBe(token.tokenHash);
    expect(restored.isRevoked()).toBe(true);
  });
});

describe('ProvisioningTokenDomainError', () => {
  it('has code PROVISIONING_TOKEN_ERROR', () => {
    const err = new ProvisioningTokenDomainError('test');
    expect(err.code).toBe('PROVISIONING_TOKEN_ERROR');
    expect(err.name).toBe('ProvisioningTokenDomainError');
  });
});
