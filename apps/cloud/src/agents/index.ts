/**
 * @seltriva/cloud — agents
 * Agent management, command dispatch, telemetry ingestion, and health tracking.
 */

import type {
  Agent,
  AgentId,
  AgentStatus,
  AgentHeartbeat,
  OrganizationId,
  EnvironmentId,
  DomainResult,
  SemVer,
} from '../domain/index';

export interface IAgentService {
  register(input: RegisterAgentInput): Promise<DomainResult<AgentRegistrationResult>>;
  retire(agentId: AgentId, actorId: string, reason?: string): Promise<DomainResult<void>>;
  processHeartbeat(agentId: AgentId, heartbeat: AgentHeartbeatInput): Promise<DomainResult<void>>;
  sendCommand(agentId: AgentId, command: AgentCommandInput): Promise<DomainResult<void>>;
  getById(agentId: AgentId): Promise<Agent | null>;
  listByOrganization(orgId: OrganizationId, envId?: EnvironmentId): Promise<Agent[]>;
  getHeartbeatHistory(agentId: AgentId, limit?: number): Promise<AgentHeartbeat[]>;
  getLastHeartbeat(agentId: AgentId): Promise<AgentHeartbeat | null>;
  countByOrganization(orgId: OrganizationId): Promise<number>;
  listOffline(staleThresholdMs: number): Promise<Agent[]>;
}

export interface RegisterAgentInput {
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly name: string;
  readonly version: SemVer;
  readonly hostname?: string;
  readonly platform?: string;
  readonly arch?: string;
  readonly nodeVersion?: string;
  readonly capabilities?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgentRegistrationResult {
  readonly agent: Agent;
  readonly cloudEndpoint: string;
  readonly heartbeatIntervalMs: number;
  readonly commandChannel: string;
}

export interface AgentHeartbeatInput {
  readonly status?: AgentStatus;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly latencyMs?: number;
  readonly version?: SemVer;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentCommandInput {
  readonly commandType: AgentCommandType;
  readonly payload: Record<string, unknown>;
  readonly expiresAt?: Date;
  readonly actorId: string;
}

export type AgentCommandType =
  | 'trigger-sync'
  | 'reload-schema'
  | 'install-update'
  | 'run-diagnostic'
  | 'restart-connector'
  | 'rotate-token'
  | 'update-config'
  | 'revoke-token';

export interface AgentStatusSummary {
  readonly total: number;
  readonly online: number;
  readonly offline: number;
  readonly degraded: number;
  readonly unresponsive: number;
  readonly retired: number;
}

export interface AgentHealthThresholds {
  readonly staleThresholdMs: number;
  readonly unresponsiveThresholdMs: number;
  readonly cpuWarnPercent: number;
  readonly memWarnPercent: number;
  readonly diskWarnPercent: number;
}

export const DEFAULT_AGENT_HEALTH_THRESHOLDS: AgentHealthThresholds = {
  staleThresholdMs: 120_000,
  unresponsiveThresholdMs: 300_000,
  cpuWarnPercent: 85,
  memWarnPercent: 90,
  diskWarnPercent: 95,
} as const;
