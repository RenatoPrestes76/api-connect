// HashiCorp Vault KV v2 adapter (Sprint 47 / ATLAS FORTRESS — "architecture prepared").
//
// This talks Vault's real HTTP API shape (`{addr}/v1/{mount}/data/{path}` with an
// X-Vault-Token header, KV v2 request/response envelope) so it works unmodified
// against a real Vault server. This sandbox has no live Vault instance to connect
// to, so the adapter stays honestly gated behind isConfigured() (VAULT_ADDR +
// VAULT_TOKEN) rather than pretending to succeed — callers must handle
// VaultNotConfiguredError, not assume every secret with provider:'hashicorp_vault'
// is actually synced.

export class VaultNotConfiguredError extends Error {
  constructor() {
    super(
      'HashiCorp Vault adapter is not configured — set VAULT_ADDR and VAULT_TOKEN to enable it'
    );
    this.name = 'VaultNotConfiguredError';
  }
}

export interface VaultWriteResult {
  path: string;
  version: number;
}

export interface VaultReadResult {
  path: string;
  data: Record<string, unknown>;
  version: number;
}

export interface VaultAdapterConfig {
  addr?: string;
  token?: string;
  /** KV v2 secrets engine mount point. Defaults to 'secret'. */
  mount?: string;
}

export class HashiCorpVaultAdapter {
  private readonly addr?: string;
  private readonly token?: string;
  private readonly mount: string;

  constructor(config: VaultAdapterConfig = {}) {
    this.addr = config.addr ?? process.env['VAULT_ADDR'];
    this.token = config.token ?? process.env['VAULT_TOKEN'];
    this.mount = config.mount ?? process.env['VAULT_MOUNT'] ?? 'secret';
  }

  isConfigured(): boolean {
    return Boolean(this.addr && this.token);
  }

  private dataUrl(path: string): string {
    return `${this.addr}/v1/${this.mount}/data/${path}`;
  }

  async write(path: string, data: Record<string, unknown>): Promise<VaultWriteResult> {
    if (!this.isConfigured()) throw new VaultNotConfiguredError();
    const res = await fetch(this.dataUrl(path), {
      method: 'POST',
      headers: { 'X-Vault-Token': this.token!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`Vault write failed: HTTP ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data: { version: number } };
    return { path, version: body.data.version };
  }

  async read(path: string): Promise<VaultReadResult | null> {
    if (!this.isConfigured()) throw new VaultNotConfiguredError();
    const res = await fetch(this.dataUrl(path), { headers: { 'X-Vault-Token': this.token! } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Vault read failed: HTTP ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      data: { data: Record<string, unknown>; metadata: { version: number } };
    };
    return { path, data: body.data.data, version: body.data.metadata.version };
  }
}

/** Default adapter instance, configured from VAULT_ADDR / VAULT_TOKEN / VAULT_MOUNT env vars. */
export const vaultAdapter = new HashiCorpVaultAdapter();
