/**
 * @seltriva/cloud — application
 * Application layer: commands, queries, use cases, and application services.
 *
 * CQRS pattern: Commands mutate state; Queries read state.
 * All use cases are thin orchestrators — domain logic lives in domain/.
 */

import type {
  OrganizationId,
  WorkspaceId,
  EnvironmentId,
  AgentId,
  UserId,
  PluginId,
  LicenseId,
  Organization,
  Workspace,
  Environment,
  Agent,
  User,
  Plugin,
  License,
  FeatureFlag,
  Configuration,
  MemberRole,
  OrganizationTier,
  EnvironmentKind,
  PaginatedResult,
  OrganizationFilter,
  PluginFilter,
  AuditFilter,
  AuditEntry,
  DomainResult,
  SemVer,
  Email,
  Slug,
} from '../domain/index';

// ─── Command Bus ──────────────────────────────────────────────────────────

export interface ICommandBus {
  dispatch<TResult>(command: Command<TResult>): Promise<DomainResult<TResult>>;
}

export interface Command<TResult = void> {
  readonly __resultType?: TResult;
}

export interface ICommandHandler<TCommand extends Command<TResult>, TResult = void> {
  handle(command: TCommand): Promise<DomainResult<TResult>>;
}

// ─── Query Bus ────────────────────────────────────────────────────────────

export interface IQueryBus {
  query<TResult>(query: Query<TResult>): Promise<TResult>;
}

export interface Query<TResult> {
  readonly __resultType?: TResult;
}

export interface IQueryHandler<TQuery extends Query<TResult>, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// ─── Organization Commands ────────────────────────────────────────────────

export interface CreateOrganizationCommand extends Command<Organization> {
  readonly name: string;
  readonly slug: Slug;
  readonly tier: OrganizationTier;
  readonly ownerUserId: UserId;
}

export interface UpdateOrganizationCommand extends Command<Organization> {
  readonly organizationId: OrganizationId;
  readonly name?: string;
  readonly logoUrl?: string;
  readonly settings?: Record<string, unknown>;
}

export interface SuspendOrganizationCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly reason: string;
  readonly actorId: UserId;
}

export interface ActivateOrganizationCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly actorId: UserId;
}

export interface DeleteOrganizationCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly actorId: UserId;
}

// ─── Workspace Commands ───────────────────────────────────────────────────

export interface CreateWorkspaceCommand extends Command<Workspace> {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: Slug;
  readonly description?: string;
  readonly actorId: UserId;
}

export interface UpdateWorkspaceCommand extends Command<Workspace> {
  readonly workspaceId: WorkspaceId;
  readonly name?: string;
  readonly description?: string;
  readonly actorId: UserId;
}

export interface ArchiveWorkspaceCommand extends Command {
  readonly workspaceId: WorkspaceId;
  readonly actorId: UserId;
}

// ─── Environment Commands ─────────────────────────────────────────────────

export interface CreateEnvironmentCommand extends Command<Environment> {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly slug: Slug;
  readonly kind: EnvironmentKind;
  readonly actorId: UserId;
}

export interface UpdateEnvironmentCommand extends Command<Environment> {
  readonly environmentId: EnvironmentId;
  readonly name?: string;
  readonly actorId: UserId;
}

// ─── Agent Commands ───────────────────────────────────────────────────────

export interface RegisterAgentCommand extends Command<Agent> {
  readonly organizationId: OrganizationId;
  readonly environmentId: EnvironmentId;
  readonly name: string;
  readonly version: SemVer;
  readonly hostname?: string;
  readonly platform?: string;
  readonly arch?: string;
  readonly nodeVersion?: string;
  readonly capabilities: string[];
}

export interface RetireAgentCommand extends Command {
  readonly agentId: AgentId;
  readonly actorId: UserId;
  readonly reason?: string;
}

export interface SendAgentCommandCommand extends Command {
  readonly agentId: AgentId;
  readonly commandType: string;
  readonly payload: Record<string, unknown>;
  readonly expiresAt?: Date;
  readonly actorId: UserId;
}

export interface ProcessAgentHeartbeatCommand extends Command {
  readonly agentId: AgentId;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly latencyMs?: number;
  readonly version?: SemVer;
}

// ─── User/Member Commands ─────────────────────────────────────────────────

export interface InviteMemberCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: Email;
  readonly role: MemberRole;
  readonly actorId: UserId;
}

export interface AcceptInviteCommand extends Command {
  readonly inviteToken: string;
  readonly userId: UserId;
}

export interface UpdateMemberRoleCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly memberId: UserId;
  readonly newRole: MemberRole;
  readonly actorId: UserId;
}

export interface RemoveMemberCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly memberId: UserId;
  readonly actorId: UserId;
}

// ─── Plugin Commands ──────────────────────────────────────────────────────

export interface PublishPluginCommand extends Command<Plugin> {
  readonly slug: Slug;
  readonly name: string;
  readonly description: string;
  readonly version: SemVer;
  readonly category: string;
  readonly manifest: Record<string, unknown>;
  readonly publisherId: UserId;
}

export interface InstallPluginCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly pluginId: PluginId;
  readonly version: SemVer;
  readonly config?: Record<string, unknown>;
  readonly actorId: UserId;
}

export interface UninstallPluginCommand extends Command {
  readonly organizationId: OrganizationId;
  readonly pluginId: PluginId;
  readonly actorId: UserId;
}

// ─── License Commands ─────────────────────────────────────────────────────

export interface ActivateLicenseCommand extends Command<License> {
  readonly organizationId: OrganizationId;
  readonly licenseKey: string;
  readonly actorId: UserId;
}

export interface RevokeLicenseCommand extends Command {
  readonly licenseId: LicenseId;
  readonly reason: string;
  readonly actorId: UserId;
}

// ─── API Key Commands ─────────────────────────────────────────────────────

export interface CreateApiKeyCommand extends Command<ApiKeyCreatedResult> {
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly name: string;
  readonly scopes: string[];
  readonly expiresAt?: Date;
  readonly actorId: UserId;
}

export interface RevokeApiKeyCommand extends Command {
  readonly apiKeyId: string;
  readonly actorId: UserId;
}

export interface ApiKeyCreatedResult {
  readonly apiKeyId: string;
  readonly rawKey: string;
  readonly prefix: string;
  readonly expiresAt?: Date;
}

// ─── Configuration Commands ───────────────────────────────────────────────

export interface SetConfigurationCommand extends Command<Configuration> {
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly value: string;
  readonly encrypted?: boolean;
  readonly description?: string;
  readonly actorId: UserId;
}

export interface DeleteConfigurationCommand extends Command {
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly actorId: UserId;
}

// ─── Organization Queries ─────────────────────────────────────────────────

export interface GetOrganizationQuery extends Query<Organization | null> {
  readonly organizationId: OrganizationId;
}

export interface GetOrganizationBySlugQuery extends Query<Organization | null> {
  readonly slug: Slug;
}

export interface ListOrganizationsQuery extends Query<PaginatedResult<Organization>> {
  readonly filter?: OrganizationFilter;
}

export interface GetOrganizationMembersQuery extends Query<OrganizationMemberView[]> {
  readonly organizationId: OrganizationId;
}

// ─── Workspace / Environment Queries ─────────────────────────────────────

export interface ListWorkspacesQuery extends Query<Workspace[]> {
  readonly organizationId: OrganizationId;
}

export interface ListEnvironmentsQuery extends Query<Environment[]> {
  readonly workspaceId: WorkspaceId;
}

// ─── Agent Queries ────────────────────────────────────────────────────────

export interface GetAgentQuery extends Query<Agent | null> {
  readonly agentId: AgentId;
}

export interface ListAgentsQuery extends Query<Agent[]> {
  readonly organizationId: OrganizationId;
  readonly environmentId?: EnvironmentId;
}

export interface GetAgentHeartbeatHistoryQuery extends Query<AgentHeartbeatView[]> {
  readonly agentId: AgentId;
  readonly limit?: number;
  readonly since?: Date;
}

// ─── Plugin Queries ───────────────────────────────────────────────────────

export interface ListPluginsQuery extends Query<PaginatedResult<Plugin>> {
  readonly filter?: PluginFilter;
}

export interface GetPluginQuery extends Query<Plugin | null> {
  readonly pluginId?: PluginId;
  readonly slug?: Slug;
}

// ─── Audit Queries ────────────────────────────────────────────────────────

export interface GetAuditLogQuery extends Query<PaginatedResult<AuditEntry>> {
  readonly filter: AuditFilter;
}

// ─── Configuration Queries ────────────────────────────────────────────────

export interface GetWorkspaceConfigQuery extends Query<Configuration[]> {
  readonly workspaceId: WorkspaceId;
}

// ─── Read Models (View Objects) ───────────────────────────────────────────

export interface OrganizationMemberView {
  readonly userId: UserId;
  readonly email: Email;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly role: MemberRole;
  readonly joinedAt?: Date;
}

export interface AgentHeartbeatView {
  readonly agentId: AgentId;
  readonly status: string;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly diskPct?: number;
  readonly latencyMs?: number;
  readonly receivedAt: Date;
}

export interface OrganizationSummary {
  readonly organization: Organization;
  readonly workspaceCount: number;
  readonly agentCount: number;
  readonly memberCount: number;
  readonly activeLicense?: License;
}

// ─── Application Service Interfaces ──────────────────────────────────────

export interface IOrganizationApplicationService {
  create(command: CreateOrganizationCommand): Promise<DomainResult<Organization>>;
  update(command: UpdateOrganizationCommand): Promise<DomainResult<Organization>>;
  suspend(command: SuspendOrganizationCommand): Promise<DomainResult<void>>;
  activate(command: ActivateOrganizationCommand): Promise<DomainResult<void>>;
  getSummary(id: OrganizationId): Promise<OrganizationSummary | null>;
}

export interface IAgentApplicationService {
  register(command: RegisterAgentCommand): Promise<DomainResult<Agent>>;
  processHeartbeat(command: ProcessAgentHeartbeatCommand): Promise<DomainResult<void>>;
  retire(command: RetireAgentCommand): Promise<DomainResult<void>>;
  sendCommand(command: SendAgentCommandCommand): Promise<DomainResult<void>>;
  listByOrganization(orgId: OrganizationId): Promise<Agent[]>;
}

export interface ILicenseApplicationService {
  activate(command: ActivateLicenseCommand): Promise<DomainResult<License>>;
  revoke(command: RevokeLicenseCommand): Promise<DomainResult<void>>;
  getActiveForOrganization(orgId: OrganizationId): Promise<License | null>;
  checkExpiring(daysAhead: number): Promise<License[]>;
}
