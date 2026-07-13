/**
 * Agent domain events.
 *
 * Each event is immutable and carries enough information for downstream
 * consumers (event bus, projections, notifications) to act without querying
 * back into the domain.
 *
 * Note: `version` on DomainEvent is the event sequence number;
 *       `agentVersion` is the Atlas Agent software version string.
 */
import type { DomainEvent } from './domain-event.js';

// ─── AgentRegistered ─────────────────────────────────────────────────────────

export interface AgentRegistered extends DomainEvent {
  readonly type: 'AtlasAgent.Registered';
  readonly agentId: string;
  readonly companyId: string;
  readonly name: string;
  readonly machineId: string;
  readonly hostname: string;
  readonly connectorType: string;
  readonly agentVersion: string;
}

// ─── HeartbeatReceived ───────────────────────────────────────────────────────

export interface HeartbeatReceived extends DomainEvent {
  readonly type: 'AtlasAgent.HeartbeatReceived';
  readonly agentId: string;
  readonly heartbeatAt: Date;
}

// ─── SynchronizationCompleted ────────────────────────────────────────────────

export interface SynchronizationCompleted extends DomainEvent {
  readonly type: 'AtlasAgent.SynchronizationCompleted';
  readonly agentId: string;
  readonly synchronizedAt: Date;
}

// ─── AgentDisabled ───────────────────────────────────────────────────────────

export interface AgentDisabled extends DomainEvent {
  readonly type: 'AtlasAgent.Disabled';
  readonly agentId: string;
  readonly disabledAt: Date;
}

// ─── AgentVersionUpdated ─────────────────────────────────────────────────────

export interface AgentVersionUpdated extends DomainEvent {
  readonly type: 'AtlasAgent.VersionUpdated';
  readonly agentId: string;
  readonly oldVersion: string;
  readonly newVersion: string;
}

// ─── AgentHostnameUpdated ─────────────────────────────────────────────────────

export interface AgentHostnameUpdated extends DomainEvent {
  readonly type: 'AtlasAgent.HostnameUpdated';
  readonly agentId: string;
  readonly oldHostname: string;
  readonly newHostname: string;
}

// ─── AgentEnabled ─────────────────────────────────────────────────────────────

export interface AgentEnabled extends DomainEvent {
  readonly type: 'AtlasAgent.Enabled';
  readonly agentId: string;
  readonly enabledAt: Date;
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type AgentDomainEvent =
  | AgentRegistered
  | HeartbeatReceived
  | SynchronizationCompleted
  | AgentDisabled
  | AgentEnabled
  | AgentVersionUpdated
  | AgentHostnameUpdated;
