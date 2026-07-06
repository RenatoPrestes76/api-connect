/**
 * ProvisioningService — domain service that orchestrates the agent registration
 * flow via a ProvisioningToken.
 *
 * Responsibilities:
 *  1. Validate the raw token (existence, expiry, revocation).
 *  2. Verify the token belongs to the requesting company.
 *  3. Register the AtlasAgent via the agent repository.
 *  4. Issue an AgentAccessToken (returned raw once, never stored).
 *  5. Mark the provisioning token as used.
 *  6. Return the new agentId, the raw access token, and domain events.
 */
import {
  AtlasAgent,
  RegisterAgentParams,
  AgentDomainEvent,
} from '@seltriva/agent-identity';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';
import { hashProvisioningToken }       from '../entity/provisioning-token.js';
import { AgentAccessToken }            from '../entity/agent-access-token.js';
import type { ProvisioningTokenRepository }   from '../repository/provisioning-token-repository.js';
import type { AgentAccessTokenRepository }    from '../repository/agent-access-token-repository.js';

const ACCESS_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1_000; // 365 days

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ProvisionedAgent {
  readonly agentId:  string;
  readonly rawToken: string;  // Agent Access Token — deliver once, never re-issued
  readonly events:   readonly AgentDomainEvent[];
}

export type ProvisioningError =
  | { code: 'TOKEN_NOT_FOUND' }
  | { code: 'TOKEN_EXPIRED' }
  | { code: 'TOKEN_REVOKED' }
  | { code: 'COMPANY_MISMATCH'; tokenCompanyId: string; requestedCompanyId: string }
  | { code: 'MACHINE_ALREADY_REGISTERED'; machineId: string }
  | { code: 'VALIDATION_ERROR'; message: string };

export type ProvisioningResult =
  | { ok: true;  value: ProvisionedAgent }
  | { ok: false; error: ProvisioningError };

export type ValidateTokenResult =
  | { ok: true;  value: { companyId: string; tokenId: string } }
  | { ok: false; error: ProvisioningError };

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProvisioningService {
  constructor(
    private readonly _tokenRepo:       ProvisioningTokenRepository,
    private readonly _agentRepo:       AtlasAgentRepository,
    private readonly _accessTokenRepo: AgentAccessTokenRepository,
  ) {}

  /** Validate a raw provisioning token (existence, expiry, revocation). */
  async validateToken(rawToken: string): Promise<ValidateTokenResult> {
    const hash  = hashProvisioningToken(rawToken);
    const token = await this._tokenRepo.findByHash(hash);

    if (!token) {
      return { ok: false, error: { code: 'TOKEN_NOT_FOUND' } };
    }
    if (token.isRevoked()) {
      return { ok: false, error: { code: 'TOKEN_REVOKED' } };
    }
    if (token.isExpired()) {
      return { ok: false, error: { code: 'TOKEN_EXPIRED' } };
    }

    return { ok: true, value: { companyId: token.companyId, tokenId: token.id } };
  }

  /**
   * Full provisioning flow:
   *   token → validate → check machine uniqueness → register agent
   *   → issue access token → mark token used
   */
  async registerAgent(
    rawToken: string,
    params:   RegisterAgentParams,
  ): Promise<ProvisioningResult> {
    // 1. Validate provisioning token
    const tokenResult = await this.validateToken(rawToken);
    if (!tokenResult.ok) return tokenResult;

    const { companyId: tokenCompanyId, tokenId } = tokenResult.value;

    // 2. Verify company
    if (params.companyId !== tokenCompanyId) {
      return {
        ok: false,
        error: {
          code:               'COMPANY_MISMATCH',
          tokenCompanyId,
          requestedCompanyId: params.companyId,
        },
      };
    }

    // 3. Check for duplicate machine
    const existing = await this._agentRepo.findByMachineId(params.machineId);
    if (existing) {
      return {
        ok: false,
        error: { code: 'MACHINE_ALREADY_REGISTERED', machineId: params.machineId },
      };
    }

    // 4. Create and persist agent
    let agent: AtlasAgent;
    try {
      agent = AtlasAgent.register(params);
    } catch (err) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: (err as Error).message },
      };
    }

    await this._agentRepo.save(agent);

    // 5. Issue agent access token
    const { token: accessToken, rawToken: rawAccessToken } = AgentAccessToken.generate(
      agent.id.toString(),
      new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    );
    await this._accessTokenRepo.save(accessToken);

    // 6. Mark provisioning token as used
    await this._tokenRepo.updateLastUse(tokenId, new Date());

    const events = agent.pullEvents();
    return { ok: true, value: { agentId: agent.id.toString(), rawToken: rawAccessToken, events } };
  }
}
