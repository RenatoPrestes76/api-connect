import type { ActivationToken } from '../entity/activation-token.js';

export interface ActivationTokenRepository {
  save(token: ActivationToken): Promise<void>;
  findByToken(token: string): Promise<ActivationToken | null>;
  findById(id: string): Promise<ActivationToken | null>;
  findByCompanyId(companyId: string): Promise<ActivationToken[]>;
  delete(id: string): Promise<void>;
}
