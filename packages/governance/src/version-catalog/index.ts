/**
 * @seltriva/governance — version-catalog
 *
 * Version catalog: tracks all software components in the platform
 * and their compatibility matrix.
 *
 * Components tracked:
 *   Platform: Cloud, Agent, Runtime
 *   SDK: SDK, Plugin SDK
 *   Tooling: CLI, Generator
 *   Extensions: Plugins, Connectors, ERP Profiles
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ComponentVersionId = Branded<string, 'ComponentVersionId'>;

// ─── Component Types ─────────────────────────────────────────────────────────

export type PlatformComponent =
  | 'atlas-cloud'
  | 'atlas-agent'
  | 'atlas-runtime'
  | 'atlas-sdk'
  | 'atlas-plugin-sdk'
  | 'atlas-cli'
  | 'atlas-generator'
  | 'atlas-governance';

export type ExtensionComponent = 'plugin' | 'connector' | 'erp-profile';
export type AnyComponent = PlatformComponent | ExtensionComponent;

export type VersionStatus = 'alpha' | 'beta' | 'rc' | 'stable' | 'lts' | 'deprecated' | 'eol';
export type BreakingChangeLevel = 'none' | 'minor' | 'major';

// ─── Component Version ───────────────────────────────────────────────────────

export interface ComponentVersion {
  readonly id: ComponentVersionId;
  readonly component: AnyComponent;
  readonly componentId?: string; // for plugins/connectors: their package ID
  readonly version: string; // semver
  readonly status: VersionStatus;
  readonly releaseNotes?: string;
  readonly compatibility: CompatibilityMatrix;
  readonly breaking: BreakingChangeLevel;
  readonly breakingChanges?: string[];
  readonly minimumDependencies: Record<PlatformComponent, string>; // semver range
  readonly publishedAt: Date;
  readonly eolAt?: Date;
  readonly ltsUntil?: Date;
}

export interface CompatibilityMatrix {
  readonly cloudVersionRange: string; // semver range: e.g. ">=0.1.0 <2.0.0"
  readonly agentVersionRange: string;
  readonly runtimeVersionRange: string;
  readonly sdkVersionRange?: string;
  readonly pluginSdkVersionRange?: string;
  readonly cliVersionRange?: string;
}

// ─── Version Catalog ────────────────────────────────────────────────────────

export interface VersionCatalogEntry {
  readonly component: AnyComponent;
  readonly componentId?: string;
  readonly latestStable?: string;
  readonly latestBeta?: string;
  readonly latestLTS?: string;
  readonly versions: ComponentVersion[];
  readonly eolVersions: string[];
  readonly updatedAt: Date;
}

// ─── Compatibility Check ────────────────────────────────────────────────────

export interface CompatibilityCheckRequest {
  readonly components: Record<AnyComponent, string>; // component → version
}

export interface CompatibilityCheckResult {
  readonly compatible: boolean;
  readonly issues: CompatibilityIssue[];
  readonly recommendations: string[];
  readonly checkedAt: Date;
}

export interface CompatibilityIssue {
  readonly component: AnyComponent;
  readonly version: string;
  readonly severity: 'warning' | 'error';
  readonly description: string;
  readonly resolution?: string;
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IVersionCatalogService {
  publishVersion(input: PublishVersionInput): Promise<GovernanceResult<ComponentVersion>>;
  getVersion(
    component: AnyComponent,
    version: string,
    componentId?: string
  ): Promise<ComponentVersion | null>;
  getLatest(component: AnyComponent, status?: VersionStatus): Promise<ComponentVersion | null>;
  listVersions(component: AnyComponent, componentId?: string): Promise<ComponentVersion[]>;
  getCatalog(): Promise<VersionCatalogEntry[]>;
  checkCompatibility(request: CompatibilityCheckRequest): Promise<CompatibilityCheckResult>;
  deprecate(
    component: AnyComponent,
    version: string,
    eolAt?: Date,
    by?: string
  ): Promise<GovernanceResult<void>>;
  getInstalledComponents(organizationId: string): Promise<InstalledComponentReport>;
  getUpdateAvailable(orgId: string): Promise<UpdateAvailableReport>;
}

export interface PublishVersionInput {
  readonly component: AnyComponent;
  readonly componentId?: string;
  readonly version: string;
  readonly status: VersionStatus;
  readonly releaseNotes?: string;
  readonly compatibility: CompatibilityMatrix;
  readonly breaking?: BreakingChangeLevel;
  readonly breakingChanges?: string[];
  readonly minimumDependencies?: Record<PlatformComponent, string>;
  readonly ltsUntil?: Date;
  readonly publishedBy: string;
}

export interface InstalledComponentReport {
  readonly organizationId: string;
  readonly components: Array<{
    component: AnyComponent;
    componentId?: string;
    installedVersion: string;
    latestVersion?: string;
    status: VersionStatus;
    updateAvailable: boolean;
    eolAt?: Date;
  }>;
  readonly generatedAt: Date;
}

export interface UpdateAvailableReport {
  readonly organizationId: string;
  readonly urgentUpdates: number; // EOL or security
  readonly availableUpdates: number;
  readonly items: Array<{
    component: AnyComponent;
    componentId?: string;
    current: string;
    latest: string;
    breaking: BreakingChangeLevel;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }>;
  readonly generatedAt: Date;
}
