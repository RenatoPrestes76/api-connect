import { describe, it, expect, vi, afterEach } from 'vitest';
import { HashiCorpVaultAdapter, VaultNotConfiguredError } from '../vault-adapter.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HashiCorpVaultAdapter — not configured', () => {
  it('isConfigured() is false without addr/token', () => {
    const adapter = new HashiCorpVaultAdapter({});
    expect(adapter.isConfigured()).toBe(false);
  });

  it('write() and read() reject with VaultNotConfiguredError when unconfigured', async () => {
    const adapter = new HashiCorpVaultAdapter({});
    await expect(adapter.write('foo', { value: 'bar' })).rejects.toThrow(VaultNotConfiguredError);
    await expect(adapter.read('foo')).rejects.toThrow(VaultNotConfiguredError);
  });
});

describe('HashiCorpVaultAdapter — configured, real KV v2 request shape', () => {
  it('write() POSTs to {addr}/v1/{mount}/data/{path} with X-Vault-Token and a {data:...} envelope', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ data: { version: 3 } }), { status: 200 });
      })
    );

    const adapter = new HashiCorpVaultAdapter({
      addr: 'http://127.0.0.1:8200',
      token: 'root-token',
      mount: 'secret',
    });
    const result = await adapter.write('connectors/postgres', { password: 'hunter2' });

    expect(result).toEqual({ path: 'connectors/postgres', version: 3 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('http://127.0.0.1:8200/v1/secret/data/connectors/postgres');
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)['X-Vault-Token']).toBe('root-token');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ data: { password: 'hunter2' } });
  });

  it('read() returns the unwrapped KV v2 data and version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: { data: { password: 'hunter2' }, metadata: { version: 3 } } }),
            {
              status: 200,
            }
          )
      )
    );

    const adapter = new HashiCorpVaultAdapter({
      addr: 'http://127.0.0.1:8200',
      token: 'root-token',
    });
    const result = await adapter.read('connectors/postgres');
    expect(result).toEqual({
      path: 'connectors/postgres',
      data: { password: 'hunter2' },
      version: 3,
    });
  });

  it('read() returns null on a 404 (secret not found)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 }))
    );
    const adapter = new HashiCorpVaultAdapter({
      addr: 'http://127.0.0.1:8200',
      token: 'root-token',
    });
    expect(await adapter.read('does/not/exist')).toBeNull();
  });

  it('write() throws on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('permission denied', { status: 403 }))
    );
    const adapter = new HashiCorpVaultAdapter({
      addr: 'http://127.0.0.1:8200',
      token: 'bad-token',
    });
    await expect(adapter.write('foo', { a: 1 })).rejects.toThrow(/403/);
  });
});
