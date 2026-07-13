/**
 * @seltriva/cloud — domain
 * Core domain model: entities, value objects, aggregates, domain events.
 *
 * This module has zero dependencies on infrastructure.
 * It is the innermost ring of the hexagonal architecture.
 */

// ─── Branded IDs (Value Objects) ─────────────────────────────────────────

export type OrganizationId = string & { readonly __brand: 'OrganizationId' };
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };
export type EnvironmentId = string & { readonly __brand: 'EnvironmentId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type PluginId = string & { readonly __brand: 'PluginId' };
export type LicenseId = string & { readonly __brand: 'LicenseId' };
export type ApiKeyId = string & { readonly __brand: 'ApiKeyId' };
export type JobId = string & { readonly __brand: 'JobId' };
export type NotificationId = string & { readonly __brand: 'NotificationId' };
export type AuditEntryId = string & { readonly __brand: 'AuditEntryId' };
export type ConfigurationId = string & { readonly __brand: 'ConfigurationId' };
export type FeatureFlagId = string & { readonly __brand: 'FeatureFlagId' };
export type MetricSnapshotId = string & { readonly __brand: 'MetricSnapshotId' };

// ─── Value Objects ────────────────────────────────────────────────────────

export type Slug = string & { readonly __brand: 'Slug' };
export type Email = string & { readonly __brand: 'Email' };
export type SemVer = string & { readonly __brand: 'SemVer' };
export type KeyHash = string & { readonly __brand: 'KeyHash' };
export type KeyPrefix = string & { readonly __brand: 'KeyPrefix' };

// ─── Enumerations ─────────────────────────────────────────────────────────

export type OrganizationTier = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';
export type WorkspaceStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
export type EnvironmentKind = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNRESPONSIVE' | 'RETIRED';
export type MemberRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'TRIAL' | 'PENDING';
export type PluginStatus = 'PUBLISHED' | 'DRAFT' | 'DEPRECATED' | 'ARCHIVED';
export type FeatureFlagKind = 'BOOLEAN' | 'PERCENTAGE' | 'VARIANT';
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

// ─── Domain Entities ──────────────────────────────────────────────────────

export interface Organization {
  readonly id: OrganizationId;
  readonly slug: Slug;
  readonly name: string;
  readonly tier: OrganizationTier;
  readonly status: OrganizationStatus;
  readonly logoUrl?: string;
  readonly metadata?: Record<string, unknown>;
  readonly settings?: OrganizationSettings;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface OrganizationSettings {
  readonly allowPublicSignup: boolean;
  readonly enforceSSO: boolean;
  readonly defaultEnvironment: EnvironmentKind;
  readonly maxAgentsPerEnvironment?: number;
  readonly notificationPreferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  readonly agentOffline: boolean;
  readonly jobFailed: boolean;
  readonly licenseExpiring: boolean;
  readonly securityAlert: boolean;
}

export interface Workspace {
  readonly id: WorkspaceId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: Slug;
  readonly description?: string;
  readonly status: WorkspaceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface Environment {
  readonly id: EnvironmentId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly slug: Slug;
  readonly kind: EnvironmentKind;
  readonly status: EnvironmentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface Agent {
  readonly id: AgentId;
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly name: string;
  readonly version: SemVer;
  readonly status: AgentStatus;
  readonly lastSeenAt?: Date;
  readonly registeredAt: Date;
  readonly hostname?: string;
  readonly platform?: string;
  readonly arch?: string;
  readonly nodeVersion?: string;
  readonly capabilities: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly retiredAt?: Date;
}

export interface AgentHeartbeat {
  readonly agentId: AgentId;
  readonly status: AgentStatus;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly latencyMs?: number;
  readonly version?: SemVer;
  readonly receivedAt: Date;
}

export interface User {
  readonly id: UserId;
  readonly supabaseId: string;
  readonly email: Email;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface OrganizationMember {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly role: MemberRole;
  readonly invitedAt: Date;
  readonly joinedAt?: Date;
}

export interface Plugin {
  readonly id: PluginId;
  readonly slug: Slug;
  readonly name: string;
  readonly description: string;
  readonly version: SemVer;
  readonly publisherId: UserId;
  readonly status: PluginStatus;
  readonly category: string;
  readonly tags: string[];
  readonly manifest: PluginManifest;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly agentVersionRange: string;
  readonly capabilities: string[];
  readonly configSchema?: Record<string, unknown>;
}

export interface License {
  readonly id: LicenseId;
  readonly organizationId: OrganizationId;
  readonly key: string;
  readonly tier: OrganizationTier;
  readonly status: LicenseStatus;
  readonly maxAgents: number;
  readonly maxWorkspaces: number;
  readonly maxUsers: number;
  readonly features: string[];
  readonly activatedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FeatureFlag {
  readonly id: FeatureFlagId;
  readonly organizationId?: OrganizationId;
  readonly environmentId?: EnvironmentId;
  readonly key: string;
  readonly kind: FeatureFlagKind;
  readonly enabled: boolean;
  readonly rolloutPercent?: number;
  readonly variants?: FeatureFlagVariant[];
  readonly description?: string;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FeatureFlagVariant {
  readonly key: string;
  readonly value: unknown;
  readonly weight: number;
}

export interface Configuration {
  readonly id: ConfigurationId;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly value: string;
  readonly encrypted: boolean;
  readonly description?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ApiKey {
  readonly id: ApiKeyId;
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly name: string;
  readonly keyPrefix: KeyPrefix;
  readonly keyHash: KeyHash;
  readonly status: ApiKeyStatus;
  readonly scopes: string[];
  readonly lastUsedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revokedAt?: Date;
}

// ─── Domain Events ────────────────────────────────────────────────────────

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly correlationId?: string;
}

export interface OrganizationCreatedEvent extends DomainEvent {
  readonly eventType: 'organization.created';
  readonly organizationId: OrganizationId;
  readonly tier: OrganizationTier;
}

export interface OrganizationSuspendedEvent extends DomainEvent {
  readonly eventType: 'organization.suspended';
  readonly organizationId: OrganizationId;
  readonly reason: string;
}

export interface AgentRegisteredEvent extends DomainEvent {
  readonly eventType: 'agent.registered';
  readonly agentId: AgentId;
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly version: SemVer;
}

export interface AgentStatusChangedEvent extends DomainEvent {
  readonly eventType: 'agent.status_changed';
  readonly agentId: AgentId;
  readonly previousStatus: AgentStatus;
  readonly currentStatus: AgentStatus;
}

export interface AgentHeartbeatReceivedEvent extends DomainEvent {
  readonly eventType: 'agent.heartbeat_received';
  readonly agentId: AgentId;
  readonly heartbeat: AgentHeartbeat;
}

export interface PluginInstalledEvent extends DomainEvent {
  readonly eventType: 'plugin.installed';
  readonly pluginId: PluginId;
  readonly organizationId: OrganizationId;
  readonly version: SemVer;
}

export interface LicenseActivatedEvent extends DomainEvent {
  readonly eventType: 'license.activated';
  readonly licenseId: LicenseId;
  readonly organizationId: OrganizationId;
  readonly tier: OrganizationTier;
}

export interface LicenseExpiringEvent extends DomainEvent {
  readonly eventType: 'license.expiring';
  readonly licenseId: LicenseId;
  readonly organizationId: OrganizationId;
  readonly daysRemaining: number;
}

export interface UserInvitedEvent extends DomainEvent {
  readonly eventType: 'user.invited';
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: Email;
  readonly role: MemberRole;
}

export type CloudDomainEvent =
  | OrganizationCreatedEvent
  | OrganizationSuspendedEvent
  | AgentRegisteredEvent
  | AgentStatusChangedEvent
  | AgentHeartbeatReceivedEvent
  | PluginInstalledEvent
  | LicenseActivatedEvent
  | LicenseExpiringEvent
  | UserInvitedEvent;

// ─── Repository Interfaces ────────────────────────────────────────────────

export interface IRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

export interface IOrganizationRepository extends IRepository<Organization, OrganizationId> {
  findBySlug(slug: Slug): Promise<Organization | null>;
  findByMember(userId: UserId): Promise<Organization[]>;
  list(filter: OrganizationFilter): Promise<PaginatedResult<Organization>>;
  updateStatus(id: OrganizationId, status: OrganizationStatus): Promise<void>;
}

export interface IWorkspaceRepository extends IRepository<Workspace, WorkspaceId> {
  findByOrganization(orgId: OrganizationId): Promise<Workspace[]>;
  findBySlug(orgId: OrganizationId, slug: Slug): Promise<Workspace | null>;
}

export interface IEnvironmentRepository extends IRepository<Environment, EnvironmentId> {
  findByWorkspace(workspaceId: WorkspaceId): Promise<Environment[]>;
}

export interface IAgentRepository extends IRepository<Agent, AgentId> {
  findByOrganization(orgId: OrganizationId): Promise<Agent[]>;
  findByEnvironment(envId: EnvironmentId): Promise<Agent[]>;
  findOnlineAgents(): Promise<Agent[]>;
  countByOrganization(orgId: OrganizationId): Promise<number>;
  updateStatus(id: AgentId, status: AgentStatus, lastSeenAt: Date): Promise<void>;
  recordHeartbeat(heartbeat: AgentHeartbeat): Promise<void>;
}

export interface IUserRepository extends IRepository<User, UserId> {
  findByEmail(email: Email): Promise<User | null>;
  findBySupabaseId(supabaseId: string): Promise<User | null>;
}

export interface IPluginRepository extends IRepository<Plugin, PluginId> {
  findBySlug(slug: Slug): Promise<Plugin | null>;
  findPublished(filter: PluginFilter): Promise<PaginatedResult<Plugin>>;
  findByOrganization(orgId: OrganizationId): Promise<Plugin[]>;
}

export interface ILicenseRepository extends IRepository<License, LicenseId> {
  findByOrganization(orgId: OrganizationId): Promise<License[]>;
  findActiveByOrganization(orgId: OrganizationId): Promise<License | null>;
  findExpiring(daysAhead: number): Promise<License[]>;
}

export interface IConfigurationRepository extends IRepository<Configuration, ConfigurationId> {
  findByWorkspace(workspaceId: WorkspaceId): Promise<Configuration[]>;
  findByKey(workspaceId: WorkspaceId, key: string): Promise<Configuration | null>;
  upsert(workspaceId: WorkspaceId, key: string, value: string): Promise<Configuration>;
}

export interface IAuditRepository {
  append(entry: Omit<AuditEntry, 'id' | 'occurredAt'>): Promise<void>;
  query(filter: AuditFilter): Promise<PaginatedResult<AuditEntry>>;
}

// ─── Domain Services ──────────────────────────────────────────────────────

export interface LicenseValidator {
  validate(license: License): LicenseValidationResult;
  canAddAgent(orgId: OrganizationId, license: License, currentCount: number): boolean;
  canAddUser(orgId: OrganizationId, license: License, currentCount: number): boolean;
  canAddWorkspace(orgId: OrganizationId, license: License, currentCount: number): boolean;
  hasFeature(license: License, feature: string): boolean;
}

export interface LicenseValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly daysRemaining?: number;
}

export interface AgentHealthEvaluator {
  evaluate(heartbeat: AgentHeartbeat): AgentStatus;
  isStale(lastSeenAt: Date, thresholdMs: number): boolean;
}

// ─── Shared Types ─────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface OrganizationFilter extends PaginationParams {
  readonly status?: OrganizationStatus;
  readonly tier?: OrganizationTier;
  readonly search?: string;
}

export interface PluginFilter extends PaginationParams {
  readonly category?: string;
  readonly status?: PluginStatus;
  readonly tags?: string[];
  readonly search?: string;
}

export interface AuditFilter extends PaginationParams {
  readonly organizationId?: OrganizationId;
  readonly actorId?: UserId;
  readonly action?: string;
  readonly resource?: string;
  readonly since?: Date;
  readonly until?: Date;
}

export interface AuditEntry {
  readonly id: AuditEntryId;
  readonly organizationId?: OrganizationId;
  readonly actorId?: UserId;
  readonly action: string;
  readonly outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  readonly resource: string;
  readonly resourceId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: Date;
}

// ─── Domain Result ────────────────────────────────────────────────────────

export interface DomainResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: DomainError;
}

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'LICENSE_LIMIT_REACHED'
  | 'LICENSE_EXPIRED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'AGENT_NOT_FOUND'
  | 'ORGANIZATION_SUSPENDED'
  | 'INVARIANT_VIOLATION'
  | 'INTERNAL_ERROR';

// ─── Event Publisher ──────────────────────────────────────────────────────

export interface IDomainEventPublisher {
  publish(event: CloudDomainEvent): Promise<void>;
  publishAll(events: CloudDomainEvent[]): Promise<void>;
}
