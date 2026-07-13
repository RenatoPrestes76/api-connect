import type { ActivationTokenRepository } from './activation-token-repository.js';
import { ActivationToken, type ActivationTokenSnapshot } from '../entity/activation-token.js';

export class InMemoryActivationTokenRepository implements ActivationTokenRepository {
  private readonly _store = new Map<string, ActivationTokenSnapshot>();

  async save(token: ActivationToken): Promise<void> {
    this._store.set(token.id, token.toSnapshot());
  }

  async findByToken(rawToken: string): Promise<ActivationToken | null> {
    for (const s of this._store.values()) {
      if (s.token === rawToken) return ActivationToken.fromSnapshot(s);
    }
    return null;
  }

  async findById(id: string): Promise<ActivationToken | null> {
    const s = this._store.get(id);
    return s ? ActivationToken.fromSnapshot(s) : null;
  }

  async findByCompanyId(companyId: string): Promise<ActivationToken[]> {
    return Array.from(this._store.values())
      .filter((s) => s.companyId === companyId)
      .map(ActivationToken.fromSnapshot.bind(ActivationToken));
  }

  async delete(id: string): Promise<void> {
    this._store.delete(id);
  }

  // Test helpers
  get size(): number {
    return this._store.size;
  }
  clear(): void {
    this._store.clear();
  }
}
