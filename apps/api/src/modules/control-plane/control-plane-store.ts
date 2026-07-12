import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type {
  Tenant,
  Organization,
  Workspace,
  Environment,
  Runtime,
  RuntimeAccessToken,
  Connector,
  ConnectorVersion,
  OrganizationConnector,
  Deployment,
  FeatureFlag,
  DeploymentStatus,
} from './types.js';

let _instance: ControlPlaneStore | null = null;

/** Full serializable state captured by a Disaster Recovery backup — see exportSnapshot()/importSnapshot(). */
export interface ControlPlaneSnapshot {
  tenants: Tenant[];
  organizations: Organization[];
  workspaces: Workspace[];
  environments: Environment[];
  runtimes: Runtime[];
  runtimeTokens: RuntimeAccessToken[];
  connectors: Connector[];
  connectorVersions: ConnectorVersion[];
  organizationConnectors: OrganizationConnector[];
  deployments: Deployment[];
  featureFlags: FeatureFlag[];
}

export class ControlPlaneStore {
  private tenants: Tenant[] = [];
  private organizations: Organization[] = [];
  private workspaces: Workspace[] = [];
  private environments: Environment[] = [];
  private runtimes: Runtime[] = [];
  private runtimeTokens: RuntimeAccessToken[] = [];
  private connectors: Connector[] = [];
  private connectorVersions: ConnectorVersion[] = [];
  private organizationConnectors: OrganizationConnector[] = [];
  private deployments: Deployment[] = [];
  private featureFlags: FeatureFlag[] = [];

  private constructor() {
    this.seed();
  }

  static getInstance(): ControlPlaneStore {
    if (!_instance) _instance = new ControlPlaneStore();
    return _instance;
  }

  // ─── Tenants ────────────────────────────────────────────────────────────

  listTenants(filters: { status?: string } = {}): Tenant[] {
    let list = this.tenants.filter((t) => !t.deletedAt);
    if (filters.status) list = list.filter((t) => t.status === filters.status);
    return list;
  }

  getTenant(id: string): Tenant | undefined {
    return this.tenants.find((t) => t.id === id && !t.deletedAt);
  }

  createTenant(input: { name: string; slug: string; primaryContactEmail?: string }): Tenant {
    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      status: 'ACTIVE',
      primaryContactEmail: input.primaryContactEmail,
      createdAt: now,
      updatedAt: now,
    };
    this.tenants.push(tenant);
    return tenant;
  }

  updateTenant(
    id: string,
    patch: Partial<Pick<Tenant, 'name' | 'status' | 'primaryContactEmail'>>
  ): Tenant | null {
    const tenant = this.getTenant(id);
    if (!tenant) return null;
    Object.assign(tenant, patch, { updatedAt: new Date().toISOString() });
    return tenant;
  }

  deleteTenant(id: string): boolean {
    const tenant = this.getTenant(id);
    if (!tenant) return false;
    tenant.deletedAt = new Date().toISOString();
    return true;
  }

  // ─── Organizations ──────────────────────────────────────────────────────

  listOrganizations(
    filters: { tenantId?: string; status?: string; tier?: string } = {}
  ): Organization[] {
    let list = this.organizations.filter((o) => !o.deletedAt);
    if (filters.tenantId) list = list.filter((o) => o.tenantId === filters.tenantId);
    if (filters.status) list = list.filter((o) => o.status === filters.status);
    if (filters.tier) list = list.filter((o) => o.tier === filters.tier);
    return list;
  }

  getOrganization(id: string): Organization | undefined {
    return this.organizations.find((o) => o.id === id && !o.deletedAt);
  }

  createOrganization(input: {
    name: string;
    slug: string;
    tenantId?: string;
    tier?: Organization['tier'];
  }): Organization {
    const now = new Date().toISOString();
    const org: Organization = {
      id: randomUUID(),
      tenantId: input.tenantId,
      slug: input.slug,
      name: input.name,
      tier: input.tier ?? 'FREE',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.push(org);

    // Every organization gets one default (hidden) workspace + the three standard environments.
    const workspace: Workspace = {
      id: randomUUID(),
      organizationId: org.id,
      name: 'Default',
      slug: 'default',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.workspaces.push(workspace);

    (['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const).forEach((kind) => {
      this.environments.push({
        id: randomUUID(),
        workspaceId: workspace.id,
        organizationId: org.id,
        name: kind.charAt(0) + kind.slice(1).toLowerCase(),
        slug: kind.toLowerCase(),
        kind,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    });

    return org;
  }

  updateOrganization(
    id: string,
    patch: Partial<Pick<Organization, 'name' | 'tier' | 'status' | 'tenantId'>>
  ): Organization | null {
    const org = this.getOrganization(id);
    if (!org) return null;
    Object.assign(org, patch, { updatedAt: new Date().toISOString() });
    return org;
  }

  deleteOrganization(id: string): boolean {
    const org = this.getOrganization(id);
    if (!org) return false;
    org.deletedAt = new Date().toISOString();
    return true;
  }

  // ─── Environments ───────────────────────────────────────────────────────

  listEnvironments(
    filters: { organizationId?: string; kind?: string; status?: string } = {}
  ): Environment[] {
    let list = this.environments.filter((e) => !e.deletedAt);
    if (filters.organizationId)
      list = list.filter((e) => e.organizationId === filters.organizationId);
    if (filters.kind) list = list.filter((e) => e.kind === filters.kind);
    if (filters.status) list = list.filter((e) => e.status === filters.status);
    return list;
  }

  getEnvironment(id: string): Environment | undefined {
    return this.environments.find((e) => e.id === id && !e.deletedAt);
  }

  createEnvironment(input: {
    organizationId: string;
    name: string;
    slug: string;
    kind: Environment['kind'];
  }): Environment | 'ORGANIZATION_NOT_FOUND' {
    const org = this.getOrganization(input.organizationId);
    if (!org) return 'ORGANIZATION_NOT_FOUND';
    const workspace = this.workspaces.find((w) => w.organizationId === org.id);
    const now = new Date().toISOString();
    const env: Environment = {
      id: randomUUID(),
      workspaceId: workspace?.id ?? randomUUID(),
      organizationId: org.id,
      name: input.name,
      slug: input.slug,
      kind: input.kind,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.environments.push(env);
    return env;
  }

  deleteEnvironment(id: string): boolean {
    const env = this.getEnvironment(id);
    if (!env) return false;
    env.deletedAt = new Date().toISOString();
    return true;
  }

  // ─── Runtimes (Agents) ──────────────────────────────────────────────────

  listRuntimes(
    filters: { organizationId?: string; environmentId?: string; status?: string } = {}
  ): Runtime[] {
    let list = [...this.runtimes];
    if (filters.organizationId)
      list = list.filter((r) => r.organizationId === filters.organizationId);
    if (filters.environmentId) list = list.filter((r) => r.environmentId === filters.environmentId);
    if (filters.status) list = list.filter((r) => r.status === filters.status);
    return list;
  }

  getRuntime(id: string): Runtime | undefined {
    return this.runtimes.find((r) => r.id === id);
  }

  restartRuntime(id: string): Runtime | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    runtime.status = 'ONLINE';
    runtime.lastSeenAt = new Date().toISOString();
    runtime.updatedAt = runtime.lastSeenAt;
    return runtime;
  }

  updateRuntimeVersion(id: string, version: string): Runtime | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    runtime.version = version;
    runtime.updatedAt = new Date().toISOString();
    return runtime;
  }

  retireRuntime(id: string): Runtime | null {
    const runtime = this.getRuntime(id);
    if (!runtime) return null;
    runtime.status = 'RETIRED';
    runtime.retiredAt = new Date().toISOString();
    runtime.updatedAt = runtime.retiredAt;
    return runtime;
  }

  /** Provisions a new ONLINE runtime instance — used by the horizontal autoscaler (Sprint 47). */
  provisionRuntime(input: {
    organizationId: string;
    environmentId: string;
    namePrefix?: string;
    version?: string;
  }): Runtime {
    const now = new Date().toISOString();
    const suffix = randomUUID().slice(0, 8);
    const runtime: Runtime = {
      id: randomUUID(),
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      name: `${input.namePrefix ?? 'autoscaled-worker'}-${suffix}`,
      version: input.version ?? '1.0.0',
      status: 'ONLINE',
      lastSeenAt: now,
      registeredAt: now,
      hostname: `${input.namePrefix ?? 'autoscaled-worker'}-${suffix}.internal`,
      capabilities: [],
      createdAt: now,
      updatedAt: now,
    };
    this.runtimes.push(runtime);
    return runtime;
  }

  /** Issues a fresh access token for a runtime, revoking any previous one. Returns the RAW token once. */
  issueRuntimeToken(runtimeId: string): { raw: string; record: RuntimeAccessToken } | null {
    const runtime = this.getRuntime(runtimeId);
    if (!runtime) return null;
    for (const t of this.runtimeTokens) {
      if (t.runtimeId === runtimeId && !t.revokedAt) t.revokedAt = new Date().toISOString();
    }
    const raw = `rat_${randomBytes(24).toString('hex')}`;
    const now = new Date().toISOString();
    const record: RuntimeAccessToken = {
      id: randomUUID(),
      runtimeId,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      tokenPrefix: raw.slice(0, 12),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };
    this.runtimeTokens.push(record);
    return { raw, record };
  }

  // ─── Connectors (Plugins) ───────────────────────────────────────────────

  listConnectors(filters: { status?: string; category?: string } = {}): Connector[] {
    let list = this.connectors.filter((c) => !c.deletedAt);
    if (filters.status) list = list.filter((c) => c.status === filters.status);
    if (filters.category) list = list.filter((c) => c.category === filters.category);
    return list;
  }

  getConnector(id: string): Connector | undefined {
    return this.connectors.find((c) => c.id === id && !c.deletedAt);
  }

  getConnectorVersions(connectorId: string): ConnectorVersion[] {
    return this.connectorVersions
      .filter((v) => v.pluginId === connectorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createConnectorVersion(
    connectorId: string,
    input: { version: string; changelog?: string }
  ): ConnectorVersion | 'CONNECTOR_NOT_FOUND' {
    const connector = this.getConnector(connectorId);
    if (!connector) return 'CONNECTOR_NOT_FOUND';
    const record: ConnectorVersion = {
      id: randomUUID(),
      pluginId: connectorId,
      version: input.version,
      changelog: input.changelog,
      published: false,
      createdAt: new Date().toISOString(),
    };
    this.connectorVersions.push(record);
    return record;
  }

  publishConnectorVersion(connectorId: string, versionId: string): ConnectorVersion | 'NOT_FOUND' {
    const version = this.connectorVersions.find(
      (v) => v.id === versionId && v.pluginId === connectorId
    );
    if (!version) return 'NOT_FOUND';
    version.published = true;
    version.publishedAt = new Date().toISOString();
    const connector = this.getConnector(connectorId);
    if (connector) {
      connector.version = version.version;
      connector.status = 'PUBLISHED';
      connector.updatedAt = new Date().toISOString();
    }
    return version;
  }

  listOrganizationConnectors(organizationId: string): OrganizationConnector[] {
    return this.organizationConnectors.filter((oc) => oc.organizationId === organizationId);
  }

  getOrganizationConnector(
    organizationId: string,
    pluginId: string
  ): OrganizationConnector | undefined {
    return this.organizationConnectors.find(
      (oc) => oc.organizationId === organizationId && oc.pluginId === pluginId
    );
  }

  installOrganizationConnector(
    organizationId: string,
    pluginId: string,
    version: string
  ): OrganizationConnector {
    const existing = this.getOrganizationConnector(organizationId, pluginId);
    if (existing) {
      existing.version = version;
      existing.enabled = true;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
    const record: OrganizationConnector = {
      id: randomUUID(),
      organizationId,
      pluginId,
      version,
      enabled: true,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizationConnectors.push(record);
    return record;
  }

  setOrganizationConnectorEnabled(
    organizationId: string,
    pluginId: string,
    enabled: boolean
  ): OrganizationConnector | null {
    const record = this.getOrganizationConnector(organizationId, pluginId);
    if (!record) return null;
    record.enabled = enabled;
    record.updatedAt = new Date().toISOString();
    return record;
  }

  removeOrganizationConnector(organizationId: string, pluginId: string): boolean {
    const idx = this.organizationConnectors.findIndex(
      (oc) => oc.organizationId === organizationId && oc.pluginId === pluginId
    );
    if (idx === -1) return false;
    this.organizationConnectors.splice(idx, 1);
    return true;
  }

  // ─── Deployments ────────────────────────────────────────────────────────

  listDeployments(
    filters: { organizationId?: string; environmentId?: string; status?: string } = {}
  ): Deployment[] {
    let list = [...this.deployments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.organizationId)
      list = list.filter((d) => d.organizationId === filters.organizationId);
    if (filters.environmentId) list = list.filter((d) => d.environmentId === filters.environmentId);
    if (filters.status) list = list.filter((d) => d.status === filters.status);
    return list;
  }

  getDeployment(id: string): Deployment | undefined {
    return this.deployments.find((d) => d.id === id);
  }

  createDeployment(input: {
    organizationId: string;
    environmentId: string;
    pluginId: string;
    pluginVersionId: string;
    triggeredBy?: string;
  }):
    | Deployment
    | 'ORGANIZATION_NOT_FOUND'
    | 'ENVIRONMENT_NOT_FOUND'
    | 'CONNECTOR_VERSION_NOT_FOUND' {
    if (!this.getOrganization(input.organizationId)) return 'ORGANIZATION_NOT_FOUND';
    if (!this.getEnvironment(input.environmentId)) return 'ENVIRONMENT_NOT_FOUND';
    const version = this.connectorVersions.find(
      (v) => v.id === input.pluginVersionId && v.pluginId === input.pluginId
    );
    if (!version) return 'CONNECTOR_VERSION_NOT_FOUND';

    const now = new Date().toISOString();
    const deployment: Deployment = {
      id: randomUUID(),
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      pluginId: input.pluginId,
      pluginVersionId: input.pluginVersionId,
      status: 'IN_PROGRESS',
      triggeredBy: input.triggeredBy,
      startedAt: now,
      createdAt: now,
    };
    this.deployments.push(deployment);

    // Simulated rollout — resolves synchronously since there's no real infra to drive it yet.
    deployment.status = 'SUCCEEDED';
    deployment.completedAt = new Date().toISOString();

    const existing = this.organizationConnectors.find(
      (oc) => oc.organizationId === input.organizationId && oc.pluginId === input.pluginId
    );
    if (existing) {
      existing.version = version.version;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.organizationConnectors.push({
        id: randomUUID(),
        organizationId: input.organizationId,
        pluginId: input.pluginId,
        version: version.version,
        enabled: true,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return deployment;
  }

  rollbackDeployment(id: string): Deployment | 'NOT_FOUND' | 'NOT_ROLLBACKABLE' {
    const deployment = this.getDeployment(id);
    if (!deployment) return 'NOT_FOUND';
    if (deployment.status !== 'SUCCEEDED') return 'NOT_ROLLBACKABLE';
    deployment.status = 'ROLLED_BACK' as DeploymentStatus;
    deployment.completedAt = new Date().toISOString();
    return deployment;
  }

  // ─── Feature Flags ──────────────────────────────────────────────────────

  listFeatureFlags(
    filters: { organizationId?: string; environmentId?: string; enabled?: boolean } = {}
  ): FeatureFlag[] {
    let list = [...this.featureFlags];
    if (filters.organizationId)
      list = list.filter((f) => f.organizationId === filters.organizationId);
    if (filters.environmentId) list = list.filter((f) => f.environmentId === filters.environmentId);
    if (filters.enabled !== undefined) list = list.filter((f) => f.enabled === filters.enabled);
    return list;
  }

  getFeatureFlag(id: string): FeatureFlag | undefined {
    return this.featureFlags.find((f) => f.id === id);
  }

  createFeatureFlag(input: {
    key: string;
    organizationId?: string;
    environmentId?: string;
    kind?: FeatureFlag['kind'];
    enabled?: boolean;
    rolloutPercent?: number;
    description?: string;
  }): FeatureFlag {
    const now = new Date().toISOString();
    const flag: FeatureFlag = {
      id: randomUUID(),
      key: input.key,
      organizationId: input.organizationId,
      environmentId: input.environmentId,
      kind: input.kind ?? 'BOOLEAN',
      enabled: input.enabled ?? false,
      rolloutPercent: input.rolloutPercent,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    this.featureFlags.push(flag);
    return flag;
  }

  toggleFeatureFlag(id: string): FeatureFlag | null {
    const flag = this.getFeatureFlag(id);
    if (!flag) return null;
    flag.enabled = !flag.enabled;
    flag.updatedAt = new Date().toISOString();
    return flag;
  }

  deleteFeatureFlag(id: string): boolean {
    const idx = this.featureFlags.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    this.featureFlags.splice(idx, 1);
    return true;
  }

  // ─── Dashboard aggregation ──────────────────────────────────────────────

  getDashboardSummary(): {
    tenants: number;
    organizations: number;
    environments: number;
    runtimesOnline: number;
    runtimesTotal: number;
    connectorsPublished: number;
    deploymentsInProgress: number;
    activeFeatureFlags: number;
  } {
    return {
      tenants: this.listTenants().length,
      organizations: this.listOrganizations().length,
      environments: this.listEnvironments().length,
      runtimesOnline: this.runtimes.filter((r) => r.status === 'ONLINE').length,
      runtimesTotal: this.runtimes.length,
      connectorsPublished: this.connectors.filter((c) => c.status === 'PUBLISHED').length,
      deploymentsInProgress: this.deployments.filter((d) => d.status === 'IN_PROGRESS').length,
      activeFeatureFlags: this.featureFlags.filter((f) => f.enabled).length,
    };
  }

  // ─── Snapshot / restore (Disaster Recovery — Sprint 47) ──────────────────

  /** Full, serializable snapshot of all business state — the "Control Plane" a DR backup actually protects. */
  exportSnapshot(): ControlPlaneSnapshot {
    return {
      tenants: structuredClone(this.tenants),
      organizations: structuredClone(this.organizations),
      workspaces: structuredClone(this.workspaces),
      environments: structuredClone(this.environments),
      runtimes: structuredClone(this.runtimes),
      runtimeTokens: structuredClone(this.runtimeTokens),
      connectors: structuredClone(this.connectors),
      connectorVersions: structuredClone(this.connectorVersions),
      organizationConnectors: structuredClone(this.organizationConnectors),
      deployments: structuredClone(this.deployments),
      featureFlags: structuredClone(this.featureFlags),
    };
  }

  /** Replaces all in-memory state with a previously captured snapshot. */
  importSnapshot(snapshot: ControlPlaneSnapshot): void {
    this.tenants = structuredClone(snapshot.tenants);
    this.organizations = structuredClone(snapshot.organizations);
    this.workspaces = structuredClone(snapshot.workspaces);
    this.environments = structuredClone(snapshot.environments);
    this.runtimes = structuredClone(snapshot.runtimes);
    this.runtimeTokens = structuredClone(snapshot.runtimeTokens);
    this.connectors = structuredClone(snapshot.connectors);
    this.connectorVersions = structuredClone(snapshot.connectorVersions);
    this.organizationConnectors = structuredClone(snapshot.organizationConnectors);
    this.deployments = structuredClone(snapshot.deployments);
    this.featureFlags = structuredClone(snapshot.featureFlags);
  }

  // ─── Seed data ──────────────────────────────────────────────────────────

  private seed(): void {
    const now = new Date().toISOString();
    const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

    // Tenants
    const tenantAcme = this.createTenant({
      name: 'Acme Corp',
      slug: 'acme-corp',
      primaryContactEmail: 'ops@acme.example',
    });
    const tenantTech = this.createTenant({
      name: 'TechVentures',
      slug: 'techventures',
      primaryContactEmail: 'it@techventures.example',
    });
    const tenantStartup = this.createTenant({
      name: 'StartupXYZ',
      slug: 'startupxyz',
      primaryContactEmail: 'founder@startupxyz.example',
    });
    this.tenants.forEach((t) => (t.createdAt = daysAgo(180)));

    // Organizations (createOrganization auto-creates workspace + 3 environments each)
    const orgAcme = this.createOrganization({
      name: 'Acme Corp',
      slug: 'acme-corp',
      tenantId: tenantAcme.id,
      tier: 'ENTERPRISE',
    });
    const orgTech = this.createOrganization({
      name: 'TechVentures Labs',
      slug: 'techventures-labs',
      tenantId: tenantTech.id,
      tier: 'PRO',
    });
    const orgStartup = this.createOrganization({
      name: 'StartupXYZ',
      slug: 'startupxyz',
      tenantId: tenantStartup.id,
      tier: 'STARTER',
    });
    this.organizations.forEach((o) => (o.createdAt = daysAgo(150)));

    const envFor = (orgId: string, kind: Environment['kind']): Environment =>
      this.environments.find((e) => e.organizationId === orgId && e.kind === kind)!;

    // Runtimes
    const mkRuntime = (
      org: Organization,
      env: Environment,
      name: string,
      status: Runtime['status'],
      version: string
    ): void => {
      this.runtimes.push({
        id: randomUUID(),
        organizationId: org.id,
        environmentId: env.id,
        name,
        version,
        status,
        lastSeenAt: status === 'OFFLINE' ? daysAgo(3) : new Date().toISOString(),
        registeredAt: daysAgo(90),
        hostname: `${name.toLowerCase().replace(/\s+/g, '-')}.internal`,
        ipAddress: '10.0.4.12',
        platform: 'linux',
        arch: 'x64',
        capabilities: ['sync', 'discovery'],
        createdAt: daysAgo(90),
        updatedAt: now,
      });
    };
    mkRuntime(orgAcme, envFor(orgAcme.id, 'PRODUCTION'), 'Acme Prod Runtime', 'ONLINE', '2.4.1');
    mkRuntime(orgAcme, envFor(orgAcme.id, 'STAGING'), 'Acme Staging Runtime', 'ONLINE', '2.4.1');
    mkRuntime(orgAcme, envFor(orgAcme.id, 'DEVELOPMENT'), 'Acme Dev Runtime', 'DEGRADED', '2.3.0');
    mkRuntime(
      orgTech,
      envFor(orgTech.id, 'PRODUCTION'),
      'TechVentures Prod Runtime',
      'ONLINE',
      '2.4.1'
    );
    mkRuntime(
      orgTech,
      envFor(orgTech.id, 'DEVELOPMENT'),
      'TechVentures Dev Runtime',
      'OFFLINE',
      '2.2.5'
    );
    mkRuntime(
      orgStartup,
      envFor(orgStartup.id, 'PRODUCTION'),
      'StartupXYZ Runtime',
      'ONLINE',
      '2.4.0'
    );

    // Connectors + versions
    const mkConnector = (
      name: string,
      slug: string,
      category: string,
      description: string,
      versions: string[]
    ): Connector => {
      const connector: Connector = {
        id: randomUUID(),
        slug,
        name,
        description,
        version: versions[versions.length - 1]!,
        publisherId: 'seltriva-core',
        status: 'PUBLISHED',
        category,
        tags: [category.toLowerCase()],
        createdAt: daysAgo(200),
        updatedAt: daysAgo(10),
      };
      this.connectors.push(connector);
      versions.forEach((v, i) => {
        this.connectorVersions.push({
          id: randomUUID(),
          pluginId: connector.id,
          version: v,
          changelog: i === versions.length - 1 ? 'Latest stable release' : 'Previous release',
          published: true,
          publishedAt: daysAgo((versions.length - i) * 30),
          createdAt: daysAgo((versions.length - i) * 30),
        });
      });
      return connector;
    };
    const cMssql = mkConnector(
      'MSSQL Connector',
      'mssql',
      'Database',
      'Microsoft SQL Server connector',
      ['1.0.0', '1.1.0', '1.2.0']
    );
    const cPostgres = mkConnector(
      'PostgreSQL Connector',
      'postgresql',
      'Database',
      'PostgreSQL connector',
      ['1.0.0', '1.3.0']
    );
    mkConnector('Salesforce Connector', 'salesforce', 'CRM', 'Salesforce CRM connector', ['1.0.0']);

    const draftConnector: Connector = {
      id: randomUUID(),
      slug: 'sap-connector',
      name: 'SAP Connector',
      description: 'SAP ERP connector (in review)',
      version: '0.1.0',
      publisherId: 'seltriva-core',
      status: 'DRAFT',
      category: 'ERP',
      tags: ['erp'],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    };
    this.connectors.push(draftConnector);
    this.connectorVersions.push({
      id: randomUUID(),
      pluginId: draftConnector.id,
      version: '0.1.0',
      changelog: 'Initial draft',
      published: false,
      createdAt: daysAgo(5),
    });

    // Installations + deployments
    const mssqlLatest = this.connectorVersions.find(
      (v) => v.pluginId === cMssql.id && v.version === '1.2.0'
    )!;
    const postgresLatest = this.connectorVersions.find(
      (v) => v.pluginId === cPostgres.id && v.version === '1.3.0'
    )!;

    this.createDeployment({
      organizationId: orgAcme.id,
      environmentId: envFor(orgAcme.id, 'PRODUCTION').id,
      pluginId: cMssql.id,
      pluginVersionId: mssqlLatest.id,
      triggeredBy: 'seed',
    });
    this.createDeployment({
      organizationId: orgTech.id,
      environmentId: envFor(orgTech.id, 'PRODUCTION').id,
      pluginId: cPostgres.id,
      pluginVersionId: postgresLatest.id,
      triggeredBy: 'seed',
    });

    // One deployment left mid-flight and one that failed, for realistic status variety.
    const inProgress: Deployment = {
      id: randomUUID(),
      organizationId: orgStartup.id,
      environmentId: envFor(orgStartup.id, 'PRODUCTION').id,
      pluginId: cPostgres.id,
      pluginVersionId: postgresLatest.id,
      status: 'IN_PROGRESS',
      triggeredBy: 'seed',
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    };
    this.deployments.push(inProgress);

    const mssqlV1 = this.connectorVersions.find(
      (v) => v.pluginId === cMssql.id && v.version === '1.0.0'
    )!;
    this.deployments.push({
      id: randomUUID(),
      organizationId: orgTech.id,
      environmentId: envFor(orgTech.id, 'STAGING').id,
      pluginId: cMssql.id,
      pluginVersionId: mssqlV1.id,
      status: 'FAILED',
      triggeredBy: 'seed',
      error: 'Connection timeout to staging database',
      startedAt: daysAgo(2),
      completedAt: daysAgo(2),
      createdAt: daysAgo(2),
    });

    // Feature flags
    this.createFeatureFlag({
      key: 'new-discovery-ui',
      enabled: true,
      description: 'New AI-powered discovery UI',
    });
    this.createFeatureFlag({
      key: 'beta-workflow-builder',
      organizationId: orgAcme.id,
      enabled: true,
      description: 'Beta workflow builder for Acme',
    });
    this.createFeatureFlag({
      key: 'rate-limit-v2',
      organizationId: orgTech.id,
      environmentId: envFor(orgTech.id, 'PRODUCTION').id,
      enabled: false,
      kind: 'PERCENTAGE',
      rolloutPercent: 10,
      description: 'Gradual rollout of the new rate limiter',
    });
    this.createFeatureFlag({
      key: 'legacy-sync-fallback',
      organizationId: orgStartup.id,
      enabled: false,
      description: 'Fallback to legacy sync engine',
    });
  }
}

export const controlPlaneStore = ControlPlaneStore.getInstance();
