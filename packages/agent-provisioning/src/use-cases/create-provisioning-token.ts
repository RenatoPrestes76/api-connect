import {
  ProvisioningToken,
  CreateProvisioningTokenParams,
  ProvisioningTokenDomainError,
} from '../entity/provisioning-token.js';
import type { ProvisioningTokenRepository } from '../repository/provisioning-token-repository.js';

export interface CreateProvisioningTokenResult {
  readonly tokenId: string;
  readonly rawToken: string;
  readonly expiresAt: Date;
}

export type CreateProvisioningTokenError = { code: 'VALIDATION_ERROR'; message: string };

export type CreateProvisioningTokenOutput =
  | { ok: true; value: CreateProvisioningTokenResult }
  | { ok: false; error: CreateProvisioningTokenError };

export class CreateProvisioningToken {
  constructor(private readonly _repo: ProvisioningTokenRepository) {}

  async execute(params: CreateProvisioningTokenParams): Promise<CreateProvisioningTokenOutput> {
    let token: ProvisioningToken;
    let rawToken: string;

    try {
      ({ token, rawToken } = ProvisioningToken.create(params));
    } catch (err) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: (err as Error).message },
      };
    }

    await this._repo.create(token);

    return {
      ok: true,
      value: {
        tokenId: token.id,
        rawToken,
        expiresAt: token.expiresAt,
      },
    };
  }
}
