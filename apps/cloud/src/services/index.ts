/**
 * @seltriva/cloud — services
 * Application service wiring: root service registry and cross-service contracts.
 */

import type { IOrganizationService, IMemberService } from '../organizations/index';
import type { IAgentService } from '../agents/index';
import type { IUserService } from '../users/index';
import type { ILicenseService } from '../licenses/index';
import type { IPluginRegistryService } from '../plugins/index';
import type { INotificationService } from '../notifications/index';
import type { IMonitoringService } from '../monitoring/index';
import type { IMetricsService } from '../metrics/index';
import type { IJobEngine } from '../jobs/index';
import type { ICloudScheduler } from '../scheduler/index';
import type { IAuditService } from '../audit/index';
import type { IStorageService } from '../storage/index';
import type { IConfigurationService, IFeatureFlagService } from '../configuration/index';
import type { IAuthenticationService, IAuthorizationService, IApiKeyService, IRateLimitService } from '../security/index';
import type { IHealthMonitor } from '../health/index';
import type { IAgentTelemetryIngestion } from '../telemetry/index';

// ─── Cloud Service Container ──────────────────────────────────────────────

export interface CloudServiceContainer {
  // Core platform
  readonly health:            IHealthMonitor;
  readonly runtime:           CloudRuntimeContext;

  // Business domain
  readonly organizations:     IOrganizationService;
  readonly members:           IMemberService;
  readonly agents:            IAgentService;
  readonly users:             IUserService;
  readonly licenses:          ILicenseService;
  readonly plugins:           IPluginRegistryService;
  readonly configuration:     IConfigurationService;
  readonly featureFlags:      IFeatureFlagService;

  // Platform services
  readonly notifications:     INotificationService;
  readonly monitoring:        IMonitoringService;
  readonly metrics:           IMetricsService;
  readonly jobs:              IJobEngine;
  readonly scheduler:         ICloudScheduler;
  readonly audit:             IAuditService;
  readonly storage:           IStorageService;
  readonly agentTelemetry:    IAgentTelemetryIngestion;

  // Security
  readonly auth:              IAuthenticationService;
  readonly authorization:     IAuthorizationService;
  readonly apiKeys:           IApiKeyService;
  readonly rateLimiter:       IRateLimitService;
}

// ─── Runtime Context ──────────────────────────────────────────────────────

export interface CloudRuntimeContext {
  readonly version: string;
  readonly environment: 'development' | 'staging' | 'production';
  readonly startedAt: Date;
  readonly region?: string;
  readonly instanceId?: string;
}

// ─── Service Lifecycle ────────────────────────────────────────────────────

export interface IStartable {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IStartableRegistry {
  register(id: string, service: IStartable, priority?: number): void;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
}

// ─── Event Bus ───────────────────────────────────────────────────────────

export interface ICloudEventBus {
  publish<T = unknown>(event: CloudEvent<T>): Promise<void>;
  subscribe<T = unknown>(topic: string, handler: CloudEventHandler<T>): Unsubscribe;
}

export interface CloudEvent<T = unknown> {
  readonly id: string;
  readonly topic: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly traceId?: string;
}

export type CloudEventHandler<T = unknown> = (event: CloudEvent<T>) => Promise<void>;
export type Unsubscribe = () => void;

export const CLOUD_EVENT_TOPICS = {
  ORGANIZATION_CREATED:   'organization.created',
  ORGANIZATION_SUSPENDED: 'organization.suspended',
  AGENT_REGISTERED:       'agent.registered',
  AGENT_STATUS_CHANGED:   'agent.status.changed',
  AGENT_HEARTBEAT:        'agent.heartbeat.received',
  LICENSE_ACTIVATED:      'license.activated',
  LICENSE_EXPIRING:       'license.expiring',
  PLUGIN_INSTALLED:       'plugin.installed',
  USER_INVITED:           'user.invited',
  JOB_COMPLETED:          'job.completed',
  JOB_FAILED:             'job.failed',
  ALERT_CREATED:          'alert.created',
} as const;
