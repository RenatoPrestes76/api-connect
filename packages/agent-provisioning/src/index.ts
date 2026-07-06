// ─── Entity ───────────────────────────────────────────────────────────────────
export {
  ProvisioningToken,
  ProvisioningTokenDomainError,
  hashProvisioningToken,
  extractTokenPrefix,
} from './entity/provisioning-token.js';
export type {
  CreateProvisioningTokenParams,
  ProvisioningTokenSnapshot,
} from './entity/provisioning-token.js';

export {
  AgentAccessToken,
  AgentAccessTokenError,
  hashAgentToken,
  extractAgentTokenPrefix,
} from './entity/agent-access-token.js';
export type { AgentAccessTokenSnapshot } from './entity/agent-access-token.js';

// ─── Repositories ─────────────────────────────────────────────────────────────
export type { ProvisioningTokenRepository }             from './repository/provisioning-token-repository.js';
export { InMemoryProvisioningTokenRepository }          from './repository/in-memory-provisioning-token-repository.js';

export type { AgentAccessTokenRepository }              from './repository/agent-access-token-repository.js';
export { InMemoryAgentAccessTokenRepository }           from './repository/in-memory-agent-access-token-repository.js';

// ─── Infrastructure ───────────────────────────────────────────────────────────
export { PrismaAtlasAgentRepository }                   from './infrastructure/prisma-atlas-agent-repository.js';
export { PrismaProvisioningTokenRepository }            from './infrastructure/prisma-provisioning-token-repository.js';
export { PrismaAgentAccessTokenRepository }             from './infrastructure/prisma-agent-access-token-repository.js';
export type { AgentProvisioningDbClient }               from './infrastructure/prisma-types.js';

// ─── Service ─────────────────────────────────────────────────────────────────
export { ProvisioningService }                          from './service/provisioning-service.js';
export type {
  ProvisionedAgent,
  ProvisioningError,
  ProvisioningResult,
  ValidateTokenResult,
} from './service/provisioning-service.js';

// ─── Use Cases ────────────────────────────────────────────────────────────────
export { CreateProvisioningToken }                      from './use-cases/create-provisioning-token.js';
export type {
  CreateProvisioningTokenResult,
  CreateProvisioningTokenError,
  CreateProvisioningTokenOutput,
} from './use-cases/create-provisioning-token.js';

export { RevokeProvisioningToken }                      from './use-cases/revoke-provisioning-token.js';
export type {
  RevokeProvisioningTokenError,
  RevokeProvisioningTokenOutput,
} from './use-cases/revoke-provisioning-token.js';

export { ProvisionAgent }                               from './use-cases/provision-agent.js';
export type { ProvisionAgentInput, ProvisionAgentOutput } from './use-cases/provision-agent.js';

export { UpdateAgentVersion }                           from './use-cases/update-agent-version.js';
export type {
  UpdateAgentVersionError,
  UpdateAgentVersionOutput,
} from './use-cases/update-agent-version.js';

export { UpdateAgentHostname }                          from './use-cases/update-agent-hostname.js';
export type {
  UpdateAgentHostnameError,
  UpdateAgentHostnameOutput,
} from './use-cases/update-agent-hostname.js';
