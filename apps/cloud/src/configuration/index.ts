/**
 * @seltriva/cloud — configuration
 * Configuration distribution: set, get, version, and push to agents.
 */

import type {
  OrganizationId, WorkspaceId, AgentId, UserId,
  Configuration, ConfigurationId, DomainResult,
} from '../domain/index';

export interface IConfigurationService {
  set(input: SetConfigurationInput): Promise<DomainResult<Configuration>>;
  get(workspaceId: WorkspaceId, key: string): Promise<Configuration | null>;
  getAll(workspaceId: WorkspaceId): Promise<Configuration[]>;
  delete(configId: ConfigurationId, actorId: UserId): Promise<DomainResult<void>>;
  getVersion(workspaceId: WorkspaceId): Promise<ConfigurationVersion>;
  pushToAgents(workspaceId: WorkspaceId): Promise<DomainResult<PushResult>>;
}

export interface IFeatureFlagService {
  evaluate(context: FeatureFlagContext): Promise<FeatureFlagEvaluationResult>;
  getAll(orgId: OrganizationId, envId?: string): Promise<FeatureFlagView[]>;
  set(input: SetFeatureFlagInput): Promise<DomainResult<FeatureFlagView>>;
  delete(flagId: string, actorId: UserId): Promise<DomainResult<void>>;
}

export interface SetConfigurationInput {
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly value: unknown;
  readonly type: ConfigurationType;
  readonly description?: string;
  readonly isSecret?: boolean;
  readonly actorId: UserId;
}

export type ConfigurationType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface ConfigurationVersion {
  readonly workspaceId: WorkspaceId;
  readonly version: number;
  readonly checksum: string;
  readonly generatedAt: Date;
  readonly entries: number;
}

export interface PushResult {
  readonly workspaceId: WorkspaceId;
  readonly agentsTargeted: number;
  readonly agentsAcknowledged: number;
  readonly pushedAt: Date;
}

export interface FeatureFlagContext {
  readonly organizationId: OrganizationId;
  readonly environmentId?: string;
  readonly userId?: UserId;
  readonly key: string;
}

export interface FeatureFlagEvaluationResult {
  readonly key: string;
  readonly enabled: boolean;
  readonly variant?: string;
  readonly reason: 'default' | 'rule' | 'override' | 'rollout';
}

export interface FeatureFlagView {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly environmentId?: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercent: number;
  readonly description?: string;
  readonly variants?: Array<{ key: string; value: unknown; weight: number }>;
  readonly updatedAt: Date;
}

export interface SetFeatureFlagInput {
  readonly organizationId: OrganizationId;
  readonly environmentId?: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly rolloutPercent?: number;
  readonly description?: string;
  readonly actorId: UserId;
}
