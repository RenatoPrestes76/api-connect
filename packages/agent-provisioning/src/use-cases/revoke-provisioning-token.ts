import type { ProvisioningTokenRepository } from '../repository/provisioning-token-repository.js';

export type RevokeProvisioningTokenError =
  | { code: 'TOKEN_NOT_FOUND'; tokenId: string };

export type RevokeProvisioningTokenOutput =
  | { ok: true;  value: { tokenId: string; revokedAt: Date } }
  | { ok: false; error: RevokeProvisioningTokenError };

export class RevokeProvisioningToken {
  constructor(private readonly _repo: ProvisioningTokenRepository) {}

  async execute(tokenId: string): Promise<RevokeProvisioningTokenOutput> {
    // findByHash won't work here; we need findById — delegating to revoke() which
    // throws on not-found (caught and translated).
    try {
      const revokedAt = new Date();
      await this._repo.revoke(tokenId);
      return { ok: true, value: { tokenId, revokedAt } };
    } catch {
      return { ok: false, error: { code: 'TOKEN_NOT_FOUND', tokenId } };
    }
  }
}
