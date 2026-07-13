import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActivationTokenService } from '../service/activation-token-service.js';
import { InMemoryActivationTokenRepository } from '../repository/in-memory-activation-token-repository.js';
import { ActivationTokenError } from '../entity/activation-token.js';

const NOW = new Date('2026-06-30T12:00:00.000Z');

function makeService() {
  const repo = new InMemoryActivationTokenRepository();
  const service = new ActivationTokenService(repo);
  return { repo, service };
}

describe('ActivationTokenService.create', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('creates and persists a valid token', async () => {
    const { repo, service } = makeService();
    const token = await service.create({ companyId: 'acme', environment: 'production' });

    expect(token.token).toMatch(/^ATLAS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(token.companyId).toBe('acme');
    expect(token.environment).toBe('production');
    expect(token.isValid()).toBe(true);
    expect(repo.size).toBe(1);
  });

  it('stores createdBy when provided', async () => {
    const { service } = makeService();
    const token = await service.create({
      companyId: 'acme',
      environment: 'staging',
      createdBy: 'admin',
    });
    expect(token.createdBy).toBe('admin');
  });
});

describe('ActivationTokenService.validate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('resolves with the token when valid', async () => {
    const { service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    const resolved = await service.validate(created.token);
    expect(resolved.id).toBe(created.id);
  });

  it('throws NOT_FOUND for unknown token', async () => {
    const { service } = makeService();
    await expect(service.validate('ATLAS-0000-0000-0000')).rejects.toThrow(ActivationTokenError);
  });

  it('throws EXPIRED when token is past its expiresAt', async () => {
    const { service } = makeService();
    const created = await service.create({
      companyId: 'acme',
      environment: 'production',
      expiresInMinutes: 5,
    });
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
    await expect(service.validate(created.token)).rejects.toThrow(ActivationTokenError);
  });

  it('throws USED when token has been consumed', async () => {
    const { service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    await service.consume(created.token);
    await expect(service.validate(created.token)).rejects.toThrow(ActivationTokenError);
  });
});

describe('ActivationTokenService.consume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('marks token as used and persists', async () => {
    const { repo, service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    const consumed = await service.consume(created.token);

    expect(consumed.isUsed()).toBe(true);
    expect(consumed.usedAt).toEqual(NOW);

    // persisted state must reflect used
    const persisted = await repo.findById(consumed.id);
    expect(persisted?.isUsed()).toBe(true);
  });

  it('returns the used token (immutable original stays clean)', async () => {
    const { service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    const consumed = await service.consume(created.token);
    expect(consumed.usedAt).not.toBeNull();
  });

  it('rejects double-consumption', async () => {
    const { service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    await service.consume(created.token);
    await expect(service.consume(created.token)).rejects.toThrow(ActivationTokenError);
  });
});

describe('ActivationTokenService.listByCompany', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('returns only tokens for the given companyId', async () => {
    const { service } = makeService();
    await service.create({ companyId: 'acme', environment: 'production' });
    await service.create({ companyId: 'acme', environment: 'staging' });
    await service.create({ companyId: 'other', environment: 'production' });

    const list = await service.listByCompany('acme');
    expect(list).toHaveLength(2);
    expect(list.every((t) => t.companyId === 'acme')).toBe(true);
  });

  it('includes isValid flag in each view', async () => {
    const { service } = makeService();
    await service.create({ companyId: 'acme', environment: 'production', expiresInMinutes: 5 });
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));

    const list = await service.listByCompany('acme');
    expect(list[0].isValid).toBe(false);
  });

  it('returns empty array when no tokens exist', async () => {
    const { service } = makeService();
    const list = await service.listByCompany('nobody');
    expect(list).toHaveLength(0);
  });
});

describe('ActivationTokenService.revoke', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('hard-deletes the token', async () => {
    const { repo, service } = makeService();
    const created = await service.create({ companyId: 'acme', environment: 'production' });
    await service.revoke(created.id);
    expect(repo.size).toBe(0);
  });

  it('throws when token id does not exist', async () => {
    const { service } = makeService();
    await expect(service.revoke('non-existent-id')).rejects.toThrow(ActivationTokenError);
  });
});
