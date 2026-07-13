/**
 * @seltriva/cloud — plugins
 * Plugin registry, publishing, installation, and versioning.
 */

import type {
  Plugin,
  PluginId,
  PluginManifest,
  PluginStatus,
  OrganizationId,
  UserId,
  DomainResult,
  PaginatedResult,
  SemVer,
  Slug,
} from '../domain/index';

export interface IPluginRegistryService {
  publish(input: PublishPluginInput): Promise<DomainResult<Plugin>>;
  deprecate(pluginId: PluginId, actorId: UserId): Promise<DomainResult<void>>;
  archive(pluginId: PluginId, actorId: UserId): Promise<DomainResult<void>>;
  getById(pluginId: PluginId): Promise<Plugin | null>;
  getBySlug(slug: Slug): Promise<Plugin | null>;
  listPublished(filter: PluginSearchFilter): Promise<PaginatedResult<PluginListItem>>;
  listByOrganization(orgId: OrganizationId): Promise<InstalledPluginView[]>;
  install(
    orgId: OrganizationId,
    pluginId: PluginId,
    version: SemVer,
    config: Record<string, unknown> | undefined,
    actorId: UserId
  ): Promise<DomainResult<void>>;
  uninstall(
    orgId: OrganizationId,
    pluginId: PluginId,
    actorId: UserId
  ): Promise<DomainResult<void>>;
  updateConfig(
    orgId: OrganizationId,
    pluginId: PluginId,
    config: Record<string, unknown>,
    actorId: UserId
  ): Promise<DomainResult<void>>;
  validateManifest(manifest: unknown): PluginManifestValidationResult;
}

export interface PublishPluginInput {
  readonly slug: Slug;
  readonly name: string;
  readonly description: string;
  readonly version: SemVer;
  readonly category: PluginCategory;
  readonly tags?: string[];
  readonly manifest: PluginManifest;
  readonly homepage?: string;
  readonly repository?: string;
  readonly iconUrl?: string;
  readonly readme?: string;
  readonly publisherId: UserId;
}

export type PluginCategory =
  | 'connector'
  | 'sync-strategy'
  | 'health-check'
  | 'telemetry'
  | 'notification'
  | 'security'
  | 'analytics'
  | 'utility';

export interface PluginSearchFilter {
  readonly category?: PluginCategory;
  readonly status?: PluginStatus;
  readonly tags?: string[];
  readonly search?: string;
  readonly publisherId?: UserId;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PluginListItem {
  readonly id: PluginId;
  readonly slug: Slug;
  readonly name: string;
  readonly description: string;
  readonly version: SemVer;
  readonly category: PluginCategory;
  readonly tags: string[];
  readonly status: PluginStatus;
  readonly iconUrl?: string;
  readonly installCount: number;
  readonly publishedAt?: Date;
}

export interface InstalledPluginView {
  readonly pluginId: PluginId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: Slug;
  readonly version: SemVer;
  readonly enabled: boolean;
  readonly config?: Record<string, unknown>;
  readonly installedAt: Date;
}

export interface PluginManifestValidationResult {
  readonly valid: boolean;
  readonly errors: Array<{ path: string; message: string }>;
  readonly warnings: string[];
}
