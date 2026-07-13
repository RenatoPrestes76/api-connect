/**
 * @seltriva/marketplace-api
 * Atlas Marketplace API contracts — publisher, consumer, and registry interfaces.
 *
 * @version 0.1.0
 */

import type { PluginType, PluginManifest } from '@seltriva/plugin-sdk';

// ─── Branded Types ────────────────────────────────────────────────────���─────

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type MarketplacePluginId = Branded<string, 'MarketplacePluginId'>;
export type MarketplaceVersionId = Branded<string, 'MarketplaceVersionId'>;
export type PublisherId = Branded<string, 'PublisherId'>;
export type ReviewId = Branded<string, 'ReviewId'>;

// ─── Marketplace Plugin ──────────────────────────────────────────────────────

export interface MarketplacePlugin {
  readonly id: MarketplacePluginId;
  readonly slug: string;
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly longDescription?: string;
  readonly type: PluginType;
  readonly category: PluginCategory;
  readonly tags: string[];
  readonly icon?: string;
  readonly screenshots?: string[];
  readonly homepage?: string;
  readonly repository?: string;
  readonly license: string;
  readonly status: MarketplaceStatus;
  readonly publisher: PublisherProfile;
  readonly versions: PluginVersionSummary[];
  readonly latestVersion: string;
  readonly installCount: number;
  readonly rating: PluginRating;
  readonly verified: boolean;
  readonly featured: boolean;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export type PluginCategory =
  | 'database-connectors'
  | 'erp-integrations'
  | 'ai-providers'
  | 'notification-channels'
  | 'cloud-storage'
  | 'data-transformation'
  | 'data-validation'
  | 'sync-strategies'
  | 'field-mapping'
  | 'security'
  | 'licensing'
  | 'export-formats'
  | 'utilities';

export type MarketplaceStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'suspended';

export interface PluginRating {
  readonly average: number;
  readonly count: number;
  readonly distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

// ─── Publisher ───────────────────────────────────────────────────────────���──

export interface PublisherProfile {
  readonly id: PublisherId;
  readonly name: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly avatarUrl?: string;
  readonly website?: string;
  readonly verified: boolean;
  readonly publishedPlugins: number;
  readonly joinedAt: Date;
}

export interface PublisherRegistration {
  readonly name: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly website?: string;
  readonly signingPublicKey?: string; // Ed25519 public key PEM
}

// ─── Plugin Version ──────────────────────────────────────────────────────────

export interface PluginVersion {
  readonly id: MarketplaceVersionId;
  readonly pluginId: MarketplacePluginId;
  readonly version: string;
  readonly channel: ReleaseChannel;
  readonly manifest: PluginManifest;
  readonly packageUrl: string;
  readonly sha256: string;
  readonly signature?: string;
  readonly sizeBytes: number;
  readonly status: VersionStatus;
  readonly changelog?: string;
  readonly minimumPlatformVersion: string;
  readonly publishedAt: Date;
  readonly deprecatedAt?: Date;
  readonly deprecationMessage?: string;
}

export interface PluginVersionSummary {
  readonly version: string;
  readonly channel: ReleaseChannel;
  readonly publishedAt: Date;
  readonly sizeBytes: number;
  readonly deprecated: boolean;
}

export type ReleaseChannel = 'stable' | 'beta' | 'edge';
export type VersionStatus = 'pending' | 'approved' | 'rejected' | 'deprecated';

// ─── Publish Flow ────────────────────────────────────────────────────────────

export interface PublishRequest {
  readonly manifest: PluginManifest;
  readonly packageBuffer: ArrayBuffer;
  readonly sha256: string;
  readonly signature?: string;
  readonly channel: ReleaseChannel;
  readonly changelog?: string;
}

export interface PublishResult {
  readonly pluginId: MarketplacePluginId;
  readonly versionId: MarketplaceVersionId;
  readonly status: VersionStatus;
  readonly reviewUrl?: string;
  readonly estimatedReviewTime?: string;
}

// ─── Search & Discovery ──────────────────────────────────────────────────────

export interface MarketplaceSearchParams {
  readonly query?: string;
  readonly type?: PluginType;
  readonly category?: PluginCategory;
  readonly channel?: ReleaseChannel;
  readonly verified?: boolean;
  readonly featured?: boolean;
  readonly tags?: string[];
  readonly sortBy?: 'relevance' | 'downloads' | 'rating' | 'published' | 'updated';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface MarketplaceSearchResult {
  readonly plugins: MarketplacePlugin[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly facets: SearchFacets;
}

export interface SearchFacets {
  readonly types: Array<{ type: PluginType; count: number }>;
  readonly categories: Array<{ category: PluginCategory; count: number }>;
  readonly tags: Array<{ tag: string; count: number }>;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface PluginReview {
  readonly id: ReviewId;
  readonly pluginId: MarketplacePluginId;
  readonly authorId: string;
  readonly authorName: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly body: string;
  readonly version: string;
  readonly verified: boolean;
  readonly helpful: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SubmitReviewInput {
  readonly pluginId: MarketplacePluginId;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly body: string;
  readonly version: string;
}

// ─── Install Record ──────────────────────────────────────────────────────────

export interface InstallRecord {
  readonly pluginId: MarketplacePluginId;
  readonly organizationId: string;
  readonly version: string;
  readonly channel: ReleaseChannel;
  readonly installedAt: Date;
  readonly updatedAt: Date;
}

// ─── Marketplace API Interface ───────────────────────────────────────────────

export interface IMarketplaceRegistry {
  search(params: MarketplaceSearchParams): Promise<MarketplaceSearchResult>;
  getPlugin(id: string): Promise<MarketplacePlugin | null>;
  getPluginBySlug(slug: string): Promise<MarketplacePlugin | null>;
  getVersion(pluginId: string, version: string): Promise<PluginVersion | null>;
  listVersions(pluginId: string): Promise<PluginVersionSummary[]>;
  getReviews(pluginId: string): Promise<PluginReview[]>;
  getFeatured(): Promise<MarketplacePlugin[]>;
  getTrending(): Promise<MarketplacePlugin[]>;
}

export interface IMarketplacePublisher {
  register(input: PublisherRegistration): Promise<PublisherProfile>;
  publish(request: PublishRequest): Promise<PublishResult>;
  deprecateVersion(pluginId: string, version: string, message: string): Promise<void>;
  unpublish(pluginId: string, reason: string): Promise<void>;
  getMyPlugins(): Promise<MarketplacePlugin[]>;
  submitReview(input: SubmitReviewInput): Promise<PluginReview>;
}

export interface IMarketplaceConsumer {
  install(orgId: string, pluginId: string, version?: string): Promise<InstallRecord>;
  uninstall(orgId: string, pluginId: string): Promise<void>;
  listInstalled(orgId: string): Promise<InstallRecord[]>;
  checkUpdates(orgId: string): Promise<UpdateAvailable[]>;
}

export interface UpdateAvailable {
  readonly pluginId: MarketplacePluginId;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly channel: ReleaseChannel;
  readonly changelog?: string;
}

// ─── Marketplace API Routes ──────────────────────────────────────────────────

export const MARKETPLACE_API_ROUTES = {
  SEARCH: '/api/marketplace/search',
  GET_PLUGIN: '/api/marketplace/plugins/:id',
  GET_VERSION: '/api/marketplace/plugins/:id/versions/:version',
  LIST_VERSIONS: '/api/marketplace/plugins/:id/versions',
  GET_REVIEWS: '/api/marketplace/plugins/:id/reviews',
  PUBLISH: '/api/marketplace/publish',
  INSTALL: '/api/marketplace/install',
  UNINSTALL: '/api/marketplace/uninstall/:id',
  MY_PLUGINS: '/api/marketplace/me/plugins',
  REGISTER_PUBLISHER: '/api/marketplace/publishers',
} as const;
