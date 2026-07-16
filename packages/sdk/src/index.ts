/**
 * @seltriva/sdk
 * Official Seltriva Connect SDK — Atlas Cloud client library.
 *
 * @version 0.1.0
 */

// ─── Branded Types ─────────────────────────────────────────────────────────

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type SdkOrganizationId = Branded<string, 'OrganizationId'>;
export type SdkWorkspaceId = Branded<string, 'WorkspaceId'>;
export type SdkEnvironmentId = Branded<string, 'EnvironmentId'>;
export type SdkAgentId = Branded<string, 'AgentId'>;
export type SdkPluginId = Branded<string, 'PluginId'>;
export type SdkUserId = Branded<string, 'UserId'>;

// ─── SDK Configuration ──────────────────────────────────────────────────────

export interface AtlasClientConfig {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly accessToken?: string;
  readonly organizationId?: SdkOrganizationId;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly userAgent?: string;
}

// ─── SDK Result ─────────────────────────────────────────────────────────────

export type SdkResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: SdkError };

export interface SdkError {
  readonly code: SdkErrorCode;
  readonly message: string;
  readonly status?: number;
  readonly requestId?: string;
}

export type SdkErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface SdkPaginatedResult<T> {
  readonly data: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
}

export interface SdkPaginationOptions {
  readonly page?: number;
  readonly pageSize?: number;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

export interface IAtlasHttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<SdkResult<T>>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<SdkResult<T>>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<SdkResult<T>>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<SdkResult<T>>;
  delete<T>(path: string, options?: RequestOptions): Promise<SdkResult<T>>;
}

export interface RequestOptions {
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

// ─── Authentication ──────────────────────────────────────────────────────────

export interface IAtlasAuth {
  signIn(credentials: SignInCredentials): Promise<SdkResult<AuthSession>>;
  signOut(): Promise<void>;
  refreshSession(): Promise<SdkResult<AuthSession>>;
  getSession(): AuthSession | null;
  onSessionChange(handler: (session: AuthSession | null) => void): Unsubscribe;
}

export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly user: SdkUser;
}

export interface SdkUser {
  readonly id: SdkUserId;
  readonly email: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

export type Unsubscribe = () => void;

// ─── Organizations ──────────────────────────────────────────────────────────

export interface IOrganizationsClient {
  list(options?: SdkPaginationOptions): Promise<SdkResult<SdkPaginatedResult<SdkOrganization>>>;
  get(id: SdkOrganizationId): Promise<SdkResult<SdkOrganization>>;
  create(input: CreateOrganizationInput): Promise<SdkResult<SdkOrganization>>;
  update(
    id: SdkOrganizationId,
    input: UpdateOrganizationInput
  ): Promise<SdkResult<SdkOrganization>>;
  delete(id: SdkOrganizationId): Promise<SdkResult<void>>;
  getMembers(id: SdkOrganizationId): Promise<SdkResult<SdkMember[]>>;
  inviteMember(id: SdkOrganizationId, input: InviteMemberInput): Promise<SdkResult<void>>;
  removeMember(orgId: SdkOrganizationId, userId: SdkUserId): Promise<SdkResult<void>>;
}

export interface SdkOrganization {
  readonly id: SdkOrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly tier: string;
  readonly status: string;
  readonly createdAt: Date;
}

export interface CreateOrganizationInput {
  readonly name: string;
  readonly slug: string;
}

export interface UpdateOrganizationInput {
  readonly name?: string;
  readonly logoUrl?: string;
}

export interface InviteMemberInput {
  readonly email: string;
  readonly role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
}

export interface SdkMember {
  readonly userId: SdkUserId;
  readonly email: string;
  readonly displayName?: string;
  readonly role: string;
  readonly joinedAt?: Date;
  readonly isPending: boolean;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface IAgentsClient {
  list(
    orgId: SdkOrganizationId,
    options?: SdkPaginationOptions
  ): Promise<SdkResult<SdkPaginatedResult<SdkAgent>>>;
  get(agentId: SdkAgentId): Promise<SdkResult<SdkAgent>>;
  sendCommand(agentId: SdkAgentId, command: SdkAgentCommand): Promise<SdkResult<void>>;
  getHeartbeatHistory(agentId: SdkAgentId, limit?: number): Promise<SdkResult<SdkHeartbeat[]>>;
}

export interface SdkAgent {
  readonly id: SdkAgentId;
  readonly organizationId: SdkOrganizationId;
  readonly name: string;
  readonly status: string;
  readonly version: string;
  readonly hostname?: string;
  readonly lastSeenAt?: Date;
  readonly createdAt: Date;
}

export interface SdkAgentCommand {
  readonly type: string;
  readonly payload?: Record<string, unknown>;
}

export interface SdkHeartbeat {
  readonly agentId: SdkAgentId;
  readonly status: string;
  readonly cpuPct?: number;
  readonly memPct?: number;
  readonly timestamp: Date;
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

export interface IPluginsClient {
  list(options?: PluginListOptions): Promise<SdkResult<SdkPaginatedResult<SdkPluginListing>>>;
  get(pluginId: SdkPluginId): Promise<SdkResult<SdkPluginListing>>;
  install(
    orgId: SdkOrganizationId,
    pluginId: SdkPluginId,
    version: string
  ): Promise<SdkResult<void>>;
  uninstall(orgId: SdkOrganizationId, pluginId: SdkPluginId): Promise<SdkResult<void>>;
  publish(manifest: unknown, packageBuffer: ArrayBuffer): Promise<SdkResult<SdkPluginListing>>;
}

export interface PluginListOptions extends SdkPaginationOptions {
  readonly category?: string;
  readonly search?: string;
}

export interface SdkPluginListing {
  readonly id: SdkPluginId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly status: string;
  readonly installCount: number;
  readonly publishedAt?: Date;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface IConfigurationClient {
  getAll(workspaceId: SdkWorkspaceId): Promise<SdkResult<SdkConfigEntry[]>>;
  get(workspaceId: SdkWorkspaceId, key: string): Promise<SdkResult<SdkConfigEntry | null>>;
  set(workspaceId: SdkWorkspaceId, key: string, value: unknown): Promise<SdkResult<SdkConfigEntry>>;
  delete(workspaceId: SdkWorkspaceId, key: string): Promise<SdkResult<void>>;
}

export interface SdkConfigEntry {
  readonly key: string;
  readonly value: unknown;
  readonly type: string;
  readonly updatedAt: Date;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface IMetricsClient {
  query(orgId: SdkOrganizationId, filter: SdkMetricFilter): Promise<SdkResult<SdkMetricResult>>;
  getAgentSummary(agentId: SdkAgentId, window: string): Promise<SdkResult<SdkAgentMetricSummary>>;
}

export interface SdkMetricFilter {
  readonly name: string;
  readonly since: Date;
  readonly until?: Date;
  readonly aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface SdkMetricResult {
  readonly name: string;
  readonly points: Array<{ timestamp: Date; value: number }>;
}

export interface SdkAgentMetricSummary {
  readonly agentId: SdkAgentId;
  readonly avgCpuPercent: number;
  readonly avgMemPercent: number;
  readonly uptimePercent: number;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export interface IWebhooksClient {
  register(orgId: SdkOrganizationId, config: SdkWebhookConfig): Promise<SdkResult<SdkWebhook>>;
  list(orgId: SdkOrganizationId): Promise<SdkResult<SdkWebhook[]>>;
  delete(orgId: SdkOrganizationId, webhookId: string): Promise<SdkResult<void>>;
  verifySignature(payload: string, signature: string, secret: string): boolean;
}

export interface SdkWebhookConfig {
  readonly url: string;
  readonly secret: string;
  readonly events: string[];
}

export interface SdkWebhook {
  readonly id: string;
  readonly organizationId: SdkOrganizationId;
  readonly url: string;
  readonly events: string[];
  readonly active: boolean;
  readonly createdAt: Date;
}

// ─── Atlas Client (entry point) ───────────────────────────────────────────────

export interface IAtlasClient {
  readonly auth: IAtlasAuth;
  readonly organizations: IOrganizationsClient;
  readonly agents: IAgentsClient;
  readonly plugins: IPluginsClient;
  readonly configuration: IConfigurationClient;
  readonly metrics: IMetricsClient;
  readonly webhooks: IWebhooksClient;
}

export function createAtlasClient(_config: AtlasClientConfig): IAtlasClient {
  throw new Error(
    'createAtlasClient is an interface contract. Import the concrete implementation from @seltriva/sdk/client.'
  );
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export interface IAtlasRealtime {
  subscribeToOrganization(orgId: SdkOrganizationId, handler: RealtimeEventHandler): Unsubscribe;
  subscribeToAgent(agentId: SdkAgentId, handler: RealtimeEventHandler): Unsubscribe;
  disconnect(): void;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

export interface RealtimeEvent {
  readonly topic: string;
  readonly payload: unknown;
  readonly timestamp: Date;
}

// ─── SDK Events ───────────────────────────────────────────────────────────────

export const SDK_EVENTS = {
  AGENT_STATUS_CHANGED: 'agent.status.changed',
  AGENT_HEARTBEAT: 'agent.heartbeat',
  PLUGIN_INSTALLED: 'plugin.installed',
  CONFIGURATION_UPDATED: 'configuration.updated',
  MEMBER_INVITED: 'member.invited',
} as const;

export const SDK_VERSION = '0.1.0';
