import { describe, it, expect } from 'vitest';
import { ErpValidator } from '../validator.js';
import { makeContext, makeContextWithCredentials, DEFAULT_CONFIG } from './helpers.js';

describe('ErpValidator', () => {
  it('returns valid=true with complete config and credentials', async () => {
    const ctx    = await makeContextWithCredentials();
    const result = await new ErpValidator(ctx).validate();
    expect(result.ok).toBe(true);
    expect(result.data!.valid).toBe(true);
    expect(result.data!.errors).toHaveLength(0);
  });

  it('reports CONFIG_INVALID for missing host', async () => {
    const { host: _h, ...cfg } = DEFAULT_CONFIG;
    const ctx    = await makeContextWithCredentials('test', cfg as Record<string, unknown>);
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.valid).toBe(false);
    const err = result.data!.errors.find((e) => e.field === 'host');
    expect(err).toBeDefined();
    expect(err!.code).toBe('CONFIG_INVALID');
  });

  it('reports CONFIG_INVALID for missing database', async () => {
    const { database: _d, ...cfg } = DEFAULT_CONFIG;
    const ctx    = await makeContextWithCredentials('test', cfg as Record<string, unknown>);
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.errors.some((e) => e.field === 'database')).toBe(true);
  });

  it('reports CREDENTIAL_MISSING when username credential is absent', async () => {
    const ctx = makeContext(); // no credentials set
    const result = await new ErpValidator(ctx).validate();
    const err = result.data!.errors.find(
      (e) => e.code === 'CREDENTIAL_MISSING' && e.field === 'username',
    );
    expect(err).toBeDefined();
  });

  it('reports CREDENTIAL_MISSING when password credential is absent', async () => {
    const ctx = makeContext();
    await ctx.credentials.set('username', 'svc');
    const result = await new ErpValidator(ctx).validate();
    const err = result.data!.errors.find(
      (e) => e.code === 'CREDENTIAL_MISSING' && e.field === 'password',
    );
    expect(err).toBeDefined();
  });

  it('emits TIMEOUT_LOW warning when timeout < 100', async () => {
    const ctx    = await makeContextWithCredentials('test', { ...DEFAULT_CONFIG, timeout: 50 });
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.warnings.some((w) => w.code === 'TIMEOUT_LOW')).toBe(true);
  });

  it('emits TIMEOUT_HIGH warning when timeout > 30000', async () => {
    const ctx    = await makeContextWithCredentials('test', { ...DEFAULT_CONFIG, timeout: 35_000 });
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.warnings.some((w) => w.code === 'TIMEOUT_HIGH')).toBe(true);
  });

  it('can return multiple errors simultaneously', async () => {
    const ctx = makeContext('test', { port: 8080 }); // missing host, database, username, password
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.errors.length).toBeGreaterThan(1);
  });

  it('valid=false when any error is present', async () => {
    const ctx    = makeContext(); // no credentials
    const result = await new ErpValidator(ctx).validate();
    expect(result.data!.valid).toBe(false);
  });
});
