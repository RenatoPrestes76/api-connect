/**
 * @seltriva/cloud — monitoring
 * Platform-wide monitoring: agent fleet status, alerts, and dashboards.
 */

import type { OrganizationId, AgentId, AgentStatus, DomainResult } from '../domain/index';

export interface IMonitoringService {
  getFleetStatus(orgId: OrganizationId): Promise<AgentFleetStatus>;
  getAgentTimeline(agentId: AgentId, hours?: number): Promise<AgentStatusPoint[]>;
  getPlatformOverview(): Promise<PlatformOverview>;
  createAlert(input: CreateAlertInput): Promise<DomainResult<MonitoringAlert>>;
  getAlerts(orgId: OrganizationId): Promise<MonitoringAlert[]>;
  acknowledgeAlert(alertId: string, userId: string): Promise<DomainResult<void>>;
  resolveAlert(alertId: string, userId: string): Promise<DomainResult<void>>;
}

export interface AgentFleetStatus {
  readonly organizationId: OrganizationId;
  readonly updatedAt: Date;
  readonly summary: {
    readonly total: number;
    readonly online: number;
    readonly offline: number;
    readonly degraded: number;
    readonly unresponsive: number;
  };
  readonly agents: AgentStatusSummaryItem[];
}

export interface AgentStatusSummaryItem {
  readonly agentId: AgentId;
  readonly name: string;
  readonly status: AgentStatus;
  readonly lastSeenAt?: Date;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly version?: string;
}

export interface AgentStatusPoint {
  readonly agentId: AgentId;
  readonly status: AgentStatus;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly timestamp: Date;
}

export interface PlatformOverview {
  readonly timestamp: Date;
  readonly activeOrganizations: number;
  readonly onlineAgents: number;
  readonly totalAgents: number;
  readonly jobsProcessedToday: number;
  readonly notificationsSentToday: number;
  readonly apiRequestsPerMinute: number;
  readonly errorRatePercent: number;
}

export interface MonitoringAlert {
  readonly id: string;
  readonly organizationId?: OrganizationId;
  readonly agentId?: AgentId;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly description: string;
  readonly status: AlertStatus;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly acknowledgedAt?: Date;
  readonly resolvedAt?: Date;
}

export interface CreateAlertInput {
  readonly organizationId?: OrganizationId;
  readonly agentId?: AgentId;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly description: string;
  readonly metadata?: Record<string, unknown>;
}

export type AlertKind =
  | 'agent-offline'
  | 'agent-unresponsive'
  | 'agent-degraded'
  | 'license-expiring'
  | 'license-limit-reached'
  | 'high-cpu'
  | 'high-memory'
  | 'high-disk'
  | 'job-failed'
  | 'security-event'
  | 'sync-failed'
  | 'custom';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
