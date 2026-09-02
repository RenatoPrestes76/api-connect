import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type {
  Tenant,
  Organization,
  Project,
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
import { tenancyRepository } from './tenancy.repository.js';

/** Narrow check for a Prisma unique-constraint violation (P2002) on a slug
 * column — same detection shape as tenancy.repository.ts's
 * isPrismaNotFoundError (P2025) and runtime-registration.repository.ts's
 * uniqueConstraintTarget (P2002), without importing @prisma/client's
 * runtime error class. */
function isUniqueSlugConflict(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === 'P2002');
}

let _instance: ControlPlaneStore | null = null;

/**
 * Full serializable state captured by a Disaster Recovery backup — see
 * exportSnapshot()/importSnapshot(). Tenant/Organization are deliberately
 * NOT included here as of Sprint 46.19 — they moved to real Postgres
 * persistence (tenancy.repository.ts), which has its own durability/backup
 * story (pg_dump/pg_restore, managed-Postgres snapshots), rather than
 * mixing two different durability mechanisms for the same data in one JS
 * object. See docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md.
 */
export interface ControlPlaneSnapshot {
  projects: Project[];
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
  private projects: Project[] = [];
  private workspaces: Workspace[] = [];
  private environments: Environment[] = [];
  private runtimes: Runtime[] = [];
  private runtimeTokens: RuntimeAccessToken[] = [];
  private connectors: Connector[] = [];
  private connectorVersions: ConnectorVersion[] = [];
  private organizationConnectors: OrganizationConnector[] = [];
  private deployments: Deployment[] = [];
  private featureFlags: FeatureFlag[] = [];
  private seeded: Promise<void> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
    // Tenant/Organization now live in Postgres (async) and everything below
    // this point in seed() depends on their ids, so seeding can no longer
    // happen synchronously in the constructor — see ready(), awaited once
    // by the module's top-level await below before the singleton is used
    // anywhere.
  }

  static getInstance(): ControlPlaneStore {
    if (!_instance) _instance = new ControlPlaneStore();
    return _instance;
  }

  /**
   * Awaited once, at module load (top-level await below) — every consumer
   * that imports `controlPlaneStore` transitively waits for seeding to
   * finish before its own module resolves, so no route handler, test, or
   * other module needs an explicit init call. Safe to call more than once
   * (e.g. a test file importing this module multiple times) — the actual
   * seed() body only ever runs once per process; later callers just await
   * the same in-flight/completed promise instead of re-running it (its
   * in-memory demo steps, unlike the Postgres-backed tenant/org steps,
   * are NOT idempotent and would duplicate runtimes/connectors/deployments
   * if actually re-executed).
   */
  async ready(): Promise<void> {
    if (!this.seeded) this.seeded = this.seed();
    await this.seeded;
  }

  // ─── Tenants (Postgres-backed — Sprint 46.19, see tenancy.repository.ts) ──

  async listTenants(filters: { status?: string } = {}): Promise<Tenant[]> {
    return tenancyRepository.listTenants(filters);
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    return tenancyRepository.getTenant(id);
  }

  async createTenant(input: {
    name: string;
    slug: string;
    primaryContactEmail?: string;
  }): Promise<Tenant> {
    return tenancyRepository.createTenant(input);
  }

  async updateTenant(
    id: string,
    patch: Partial<Pick<Tenant, 'name' | 'status' | 'primaryContactEmail'>>
  ): Promise<Tenant | null> {
    return tenancyRepository.updateTenant(id, patch);
  }

  async deleteTenant(id: string): Promise<boolean> {
    return tenancyRepository.deleteTenant(id);
  }

  // ─── Organizations (Postgres-backed — Sprint 46.19) ───────────────────────

  async listOrganizations(
    filters: { tenantId?: string; status?: string; tier?: string } = {}
  ): Promise<Organization[]> {
    return tenancyRepository.listOrganizations(filters);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    return tenancyRepository.getOrganization(id);
  }

  /**
   * Workspace + the three standard Environments are still in-memory (out of
   * this sprint's scope, see docs/ATLAS-46.19-CONTROL-PLANE-PERSISTENCE.md)
   * — they're created as a best-effort side effect AFTER the Organization
   * row is durably committed in Postgres, referencing its real id. This is
   * unchanged in nature from before the migration (it was never atomic with
   * anything either, since everything was in-memory); what's new is that
   * the Organization itself, and the tenant-existence check guarding it,
   * are now a single real transaction (see tenancyRepository.createOrganization).
   */
  async createOrganization(input: {
    name: string;
    slug: string;
    tenantId?: string;
    tier?: Organization['tier'];
  }): Promise<Organization> {
    const result = await tenancyRepository.createOrganization(input);
    if (!result.ok) throw new OrganizationTenantNotFoundError();
    const org = result.organization;
    this.ensureDefaultWorkspace(org);
    return org;
  }

  /**
   * Idempotent within this process's in-memory state: a brand-new
   * Organization never has one yet (the common case, called right after
   * createOrganization's Postgres insert above). The second caller is
   * seed() on a restart where the Organization already existed in Postgres
   * from a prior process — this process's in-memory workspaces/environments
   * arrays are empty again either way, so without this the org would be
   * left with no default workspace to attach anything to after a restart.
   */
  private ensureDefaultWorkspace(org: Organization): Workspace {
    const existing = this.workspaces.find((w) => w.organizationId === org.id);
    if (existing) return existing;

    const now = new Date().toISOString();
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

    return workspace;
  }

  async updateOrganization(
    id: string,
    patch: Partial<Pick<Organization, 'name' | 'tier' | 'status' | 'tenantId'>>
  ): Promise<
    | { ok: true; organization: Organization }
    | { ok: false; error: 'NOT_FOUND' | 'TENANT_NOT_FOUND' }
  > {
    return tenancyRepository.updateOrganization(id, patch);
  }

  async deleteOrganization(id: string): Promise<boolean> {
    return tenancyRepository.deleteOrganization(id);
  }

  // ─── Projects ───────────────────────────────────────────────────────────
  // Sprint 46.4 (Atlas Control Plane Core Modules) — grouping layer under an
  // Organization. Additive only: does not own Environments.

  listProjects(filters: { organizationId?: string; status?: string } = {}): Project[] {
    let list = this.projects.filter((p) => !p.deletedAt);
    if (filters.organizationId)
      list = list.filter((p) => p.organizationId === filters.organizationId);
    if (filters.status) list = list.filter((p) => p.status === filters.status);
    return list;
  }

  getProject(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id && !p.deletedAt);
  }

  async createProject(input: {
    organizationId: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<Project | 'ORGANIZATION_NOT_FOUND'> {
    const org = await this.getOrganization(input.organizationId);
    if (!org) return 'ORGANIZATION_NOT_FOUND';
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      organizationId: org.id,
      name: input.name,
      slug: input.slug,
      status: 'ACTIVE',
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.push(project);
    return project;
  }

  /**
   * ATLAS 46.26 — final hardening, Part 8 (mass-assignment sweep): a body
   * containing `organizationId` (a real ownership field on Project) would
   * have silently re-parented this project to a different organization —
   * the route's `ctx.body as Partial<Pick<...>>` cast is compile-time
   * only. Fixed with an explicit allowlist; `id`, `organizationId`,
   * `slug`, `createdAt` are never accepted from the patch.
   */
  updateProject(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'status' | 'description'>>
  ): Project | null {
    const project = this.getProject(id);
    if (!project) return null;
    const { name, status, description } = patch;
    Object.assign(
      project,
      {
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      {
        id: project.id,
        organizationId: project.organizationId,
        slug: project.slug,
        createdAt: project.createdAt,
        updatedAt: new Date().toISOString(),
      }
    );
    return project;
  }

  deleteProject(id: string): boolean {
    const project = this.getProject(id);
    if (!project) return false;
    project.deletedAt = new Date().toISOString();
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

  async createEnvironment(input: {
    organizationId: string;
    name: string;
    slug: string;
    kind: Environment['kind'];
  }): Promise<Environment | 'ORGANIZATION_NOT_FOUND'> {
    const org = await this.getOrganization(input.organizationId);
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

  async createDeployment(input: {
    organizationId: string;
    environmentId: string;
    pluginId: string;
    pluginVersionId: string;
    triggeredBy?: string;
  }): Promise<
    Deployment | 'ORGANIZATION_NOT_FOUND' | 'ENVIRONMENT_NOT_FOUND' | 'CONNECTOR_VERSION_NOT_FOUND'
  > {
    if (!(await this.getOrganization(input.organizationId))) return 'ORGANIZATION_NOT_FOUND';
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

  async getDashboardSummary(): Promise<{
    tenants: number;
    organizations: number;
    environments: number;
    runtimesOnline: number;
    runtimesTotal: number;
    connectorsPublished: number;
    deploymentsInProgress: number;
    activeFeatureFlags: number;
  }> {
    const [tenants, organizations] = await Promise.all([
      this.listTenants(),
      this.listOrganizations(),
    ]);
    return {
      tenants: tenants.length,
      organizations: organizations.length,
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
      projects: structuredClone(this.projects),
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
    this.projects = structuredClone(snapshot.projects);
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

  private async seed(): Promise<void> {
    const now = new Date().toISOString();
    const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

    // Tenants/Organizations now persist in Postgres across restarts (Sprint
    // 46.19), unlike the rest of this seed — so unlike everything below,
    // this can't unconditionally re-create on every boot: a second `pnpm
    // dev` would either duplicate rows or hit the unique(slug) constraint.
    // "Get existing or create" makes it safe to run on every startup.
    //
    // ATLAS 46.33 — that find-then-create is a check-then-act race, not
    // atomic: two separate PROCESSES (not just calls within one process —
    // ready()'s promise memoization already covers that) each calling
    // ensureTenant/ensureOrganization for the same fixed demo slug against
    // a freshly-migrated, previously-empty database can both see "not
    // found" before either has committed its insert, and the loser
    // crashes with a raw P2002 instead of returning the winner's row.
    // Invisible in this repo's own long-lived local dev Postgres (these
    // rows have existed since the first time anything ever ran against
    // it, so `find` always wins), but real and reproducible in CI: a
    // brand-new database, migrated fresh, with multiple vitest worker
    // processes each importing control-plane-store.ts (and therefore each
    // running this exact seed) concurrently — confirmed directly from a
    // real GitHub Actions run failing with `Unique constraint failed on
    // the fields: (slug)` in `prisma.tenant.create()`. Catching the
    // conflict and re-reading is the correct fix (not a lock, not
    // serializing seeding) — the loser doesn't need to have won, it just
    // needs the row that did.
    const ensureTenant = async (input: {
      name: string;
      slug: string;
      primaryContactEmail?: string;
    }): Promise<Tenant> => {
      const existing = await tenancyRepository.findTenantBySlug(input.slug);
      if (existing) return existing;
      try {
        return await this.createTenant(input);
      } catch (err) {
        if (!isUniqueSlugConflict(err)) throw err;
        const winner = await tenancyRepository.findTenantBySlug(input.slug);
        if (winner) return winner;
        throw err;
      }
    };

    // Pre-existing orgs (Postgres, prior process) still need their default
    // workspace re-materialized in THIS process's memory — createOrganization
    // only runs (and calls ensureDefaultWorkspace itself) for a genuinely
    // new insert, the `??` branch below skips it.
    const ensureOrganization = async (input: {
      name: string;
      slug: string;
      tenantId?: string;
      tier?: Organization['tier'];
    }): Promise<Organization> => {
      const existing = await tenancyRepository.findOrganizationBySlug(input.slug);
      if (existing) {
        this.ensureDefaultWorkspace(existing);
        return existing;
      }
      try {
        const org = await this.createOrganization(input);
        return org;
      } catch (err) {
        if (!isUniqueSlugConflict(err)) throw err;
        const winner = await tenancyRepository.findOrganizationBySlug(input.slug);
        if (winner) {
          this.ensureDefaultWorkspace(winner);
          return winner;
        }
        throw err;
      }
    };

    // Tenants
    const tenantAcme = await ensureTenant({
      name: 'Acme Corp',
      slug: 'acme-corp',
      primaryContactEmail: 'ops@acme.example',
    });
    const tenantTech = await ensureTenant({
      name: 'TechVentures',
      slug: 'techventures',
      primaryContactEmail: 'it@techventures.example',
    });
    const tenantStartup = await ensureTenant({
      name: 'StartupXYZ',
      slug: 'startupxyz',
      primaryContactEmail: 'founder@startupxyz.example',
    });

    // Organizations (createOrganization auto-creates workspace + 3 environments each)
    const orgAcme = await ensureOrganization({
      name: 'Acme Corp',
      slug: 'acme-corp',
      tenantId: tenantAcme.id,
      tier: 'ENTERPRISE',
    });
    const orgTech = await ensureOrganization({
      name: 'TechVentures Labs',
      slug: 'techventures-labs',
      tenantId: tenantTech.id,
      tier: 'PRO',
    });
    const orgStartup = await ensureOrganization({
      name: 'StartupXYZ',
      slug: 'startupxyz',
      tenantId: tenantStartup.id,
      tier: 'STARTER',
    });

    // The rest of this method (runtimes/connectors/deployments/feature
    // flags below) is still pure in-memory demo data, unchanged from before
    // this sprint — it re-creates fresh rows with new ids on every process
    // boot regardless of whether the Organizations above were newly
    // inserted or already existed in Postgres from a prior run, exactly
    // like it always has (that data was never meant to survive a restart;
    // only Tenant/Organization gained that property in Sprint 46.19).
    // ensureDefaultWorkspace() above guarantees envFor() below always finds
    // a workspace/environments to attach to either way.

    const envFor = (orgId: string, kind: Environment['kind']): Environment => {
      const env = this.environments.find((e) => e.organizationId === orgId && e.kind === kind);
      if (!env) throw new Error(`Seed environment not found for org ${orgId} kind ${kind}`);
      return env;
    };

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
        version: versions[versions.length - 1],
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
    );
    if (!mssqlLatest) throw new Error('Seed connector version mssql@1.2.0 not found');
    const postgresLatest = this.connectorVersions.find(
      (v) => v.pluginId === cPostgres.id && v.version === '1.3.0'
    );
    if (!postgresLatest) throw new Error('Seed connector version postgres@1.3.0 not found');

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
    );
    if (!mssqlV1) throw new Error('Seed connector version mssql@1.0.0 not found');
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

/** Thrown by createOrganization() when a given tenantId doesn't resolve to a real, non-deleted Tenant. */
export class OrganizationTenantNotFoundError extends Error {
  constructor() {
    super('Tenant not found for the given tenantId');
    this.name = 'OrganizationTenantNotFoundError';
  }
}

export const controlPlaneStore = ControlPlaneStore.getInstance();
// Top-level await (valid — apps/api is an ESM package): every module that
// imports controlPlaneStore, directly or transitively, waits for this to
// settle before its own import resolves. See ready()'s doc comment.
await controlPlaneStore.ready();
