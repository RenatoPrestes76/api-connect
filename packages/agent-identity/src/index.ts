// Value Objects
export { AgentId, InvalidAgentIdError } from './value-objects/agent-id.js';
export { MachineId, InvalidMachineIdError } from './value-objects/machine-id.js';
export { Hostname, InvalidHostnameError } from './value-objects/hostname.js';
export { AgentVersion, InvalidAgentVersionError } from './value-objects/agent-version.js';
export {
  AgentStatus,
  AgentStatusKind,
  InvalidStatusTransitionError,
} from './value-objects/agent-status.js';

// Domain Events
export type { DomainEvent } from './events/domain-event.js';
export { createDomainEvent } from './events/domain-event.js';
export type {
  AgentDomainEvent,
  AgentRegistered,
  HeartbeatReceived,
  SynchronizationCompleted,
  AgentDisabled,
  AgentEnabled,
  AgentVersionUpdated,
  AgentHostnameUpdated,
} from './events/agent-events.js';

// Entity
export { AtlasAgent, AgentDomainError } from './entity/atlas-agent.js';
export type { RegisterAgentParams, AtlasAgentSnapshot } from './entity/atlas-agent.js';

// Repository
export type { AtlasAgentRepository } from './repository/atlas-agent-repository.js';
export {
  InMemoryAtlasAgentRepository,
  RepositoryError,
} from './repository/in-memory-atlas-agent-repository.js';

// Use Cases
export { RegisterAgent } from './use-cases/register-agent.js';
export type {
  RegisterAgentResult,
  RegisterAgentError,
  RegisterAgentOutput,
} from './use-cases/register-agent.js';

export { UpdateHeartbeat } from './use-cases/update-heartbeat.js';
export type {
  UpdateHeartbeatResult,
  UpdateHeartbeatError,
  UpdateHeartbeatOutput,
} from './use-cases/update-heartbeat.js';

export { UpdateSynchronization } from './use-cases/update-synchronization.js';
export type {
  UpdateSynchronizationResult,
  UpdateSynchronizationError,
  UpdateSynchronizationOutput,
} from './use-cases/update-synchronization.js';

export { DisableAgent } from './use-cases/disable-agent.js';
export type {
  DisableAgentResult,
  DisableAgentError,
  DisableAgentOutput,
} from './use-cases/disable-agent.js';

export { FindAgent } from './use-cases/find-agent.js';
export type { FindAgentOutput, FindAgentsByCompanyOutput } from './use-cases/find-agent.js';
