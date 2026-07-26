import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type {
  OrganizationRecord,
  OrganizationPlan,
  EnvironmentRecord,
  EnvironmentKind,
  OrgUserRecord,
  OrgUserDTO,
  OrgRole,
  OrgInviteRecord,
  OrgInviteDTO,
  OrgAuditAction,
  OrgAuditEntry,
} from './types.js';
import { generateInviteToken, hashInviteToken } from './jwt.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_ENVIRONMENTS: Array<{ name: string; kind: EnvironmentKind }> = [
  { name: 'Produção', kind: 'production' },
  { name: 'Homologação', kind: 'staging' },
  { name: 'Desenvolvimento', kind: 'development' },
];

let _instance: PortalIdentityStore | null = null;

export class PortalIdentityStore {
  private organizations: OrganizationRecord[] = [];
  private environments: EnvironmentRecord[] = [];
  private orgUsers: OrgUserRecord[] = [];
  private orgInvites: OrgInviteRecord[] = [];
  private auditLog: OrgAuditEntry[] = [];

  private constructor() {
    this.seedDemoOrganization();
  }

  static getInstance(): PortalIdentityStore {
    if (!_instance) _instance = new PortalIdentityStore();
    return _instance;
  }

  // ─── Seed ───────────────────────────────────────────────────────────────

  private seedDemoOrganization(): void {
    const now = new Date().toISOString();
    const org: OrganizationRecord = {
      id: 'org-demo-enterprise',
      name: 'Seltriva Enterprise',
      razaoSocial: 'Seltriva Tecnologia Ltda',
      cnpj: '12.345.678/0001-90',
      internalCode: 'ORG-0001',
      status: 'active',
      plan: 'enterprise',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.push(org);
    this.seedEnvironments(org.id);
    this.orgUsers.push({
      id: 'org-user-demo-owner',
      organizationId: org.id,
      name: 'Enterprise Owner',
      email: 'owner@enterprise.demo',
      // Synchronous hash is acceptable here — runs once at process boot, not per-request.
      passwordHash: bcrypt.hashSync('TrocarNoPrimeiroLogin!', 12),
      role: 'OWNER',
      status: 'active',
      invitedAt: now,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  private seedEnvironments(organizationId: string): EnvironmentRecord[] {
    const now = new Date().toISOString();
    const created = DEFAULT_ENVIRONMENTS.map(
      (def): EnvironmentRecord => ({
        id: randomUUID(),
        organizationId,
        name: def.name,
        kind: def.kind,
        status: 'active',
        region: 'us-east-1',
        timezone: 'America/Sao_Paulo',
        createdAt: now,
      })
    );
    this.environments.push(...created);
    return created;
  }

  // ─── Organizations ──────────────────────────────────────────────────────

  getOrganization(id: string): OrganizationRecord | undefined {
    return this.organizations.find((o) => o.id === id && o.status !== 'deleted');
  }

  /** Used by Sprint 46.3's Runtime registration flow to resolve organizationCode -> organizationId. */
  findOrganizationByCode(internalCode: string): OrganizationRecord | undefined {
    return this.organizations.find(
      (o) => o.internalCode === internalCode && o.status !== 'deleted'
    );
  }

  createOrganization(input: {
    name: string;
    razaoSocial: string;
    cnpj: string;
    internalCode: string;
    plan?: OrganizationPlan;
    owner: { name: string; email: string; passwordHash: string };
  }): { organization: OrganizationRecord; owner: OrgUserRecord } {
    const now = new Date().toISOString();
    const organization: OrganizationRecord = {
      id: randomUUID(),
      name: input.name,
      razaoSocial: input.razaoSocial,
      cnpj: input.cnpj,
      internalCode: input.internalCode,
      status: 'active',
      plan: input.plan ?? 'community',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.push(organization);
    this.seedEnvironments(organization.id);

    const owner: OrgUserRecord = {
      id: randomUUID(),
      organizationId: organization.id,
      name: input.owner.name,
      email: input.owner.email,
      passwordHash: input.owner.passwordHash,
      role: 'OWNER',
      status: 'active',
      invitedAt: now,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.orgUsers.push(owner);

    return { organization, owner };
  }

  updateOrganization(
    id: string,
    patch: Partial<
      Pick<OrganizationRecord, 'name' | 'razaoSocial' | 'cnpj' | 'internalCode' | 'status' | 'plan'>
    >
  ): OrganizationRecord | null {
    const organization = this.getOrganization(id);
    if (!organization) return null;
    Object.assign(organization, patch, { updatedAt: new Date().toISOString() });
    return organization;
  }

  // ─── Environments ───────────────────────────────────────────────────────

  listEnvironments(organizationId: string): EnvironmentRecord[] {
    return this.environments.filter((e) => e.organizationId === organizationId);
  }

  createEnvironment(
    organizationId: string,
    input: { name: string; kind: EnvironmentKind; region?: string; timezone?: string }
  ): EnvironmentRecord {
    const environment: EnvironmentRecord = {
      id: randomUUID(),
      organizationId,
      name: input.name,
      kind: input.kind,
      status: 'active',
      region: input.region ?? 'us-east-1',
      timezone: input.timezone ?? 'America/Sao_Paulo',
      createdAt: new Date().toISOString(),
    };
    this.environments.push(environment);
    return environment;
  }

  deleteEnvironment(organizationId: string, id: string): boolean {
    const idx = this.environments.findIndex(
      (e) => e.id === id && e.organizationId === organizationId
    );
    if (idx === -1) return false;
    this.environments.splice(idx, 1);
    return true;
  }

  // ─── Org users ──────────────────────────────────────────────────────────

  listUsers(organizationId: string): OrgUserRecord[] {
    return this.orgUsers.filter((u) => u.organizationId === organizationId);
  }

  findUserById(id: string): OrgUserRecord | undefined {
    return this.orgUsers.find((u) => u.id === id);
  }

  findUserByEmail(email: string): OrgUserRecord | undefined {
    const normalized = email.toLowerCase();
    return this.orgUsers.find((u) => u.email.toLowerCase() === normalized);
  }

  updateUserRole(organizationId: string, id: string, role: OrgRole): OrgUserRecord | null {
    const user = this.orgUsers.find((u) => u.id === id && u.organizationId === organizationId);
    if (!user) return null;
    user.role = role;
    user.updatedAt = new Date().toISOString();
    return user;
  }

  removeUser(organizationId: string, id: string): boolean {
    const idx = this.orgUsers.findIndex((u) => u.id === id && u.organizationId === organizationId);
    if (idx === -1) return false;
    this.orgUsers.splice(idx, 1);
    return true;
  }

  recordLogin(userId: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = user.lastLoginAt;
  }

  toDTO(user: OrgUserRecord): OrgUserDTO {
    const { passwordHash: _passwordHash, ...dto } = user;
    return dto;
  }

  // ─── Invites ────────────────────────────────────────────────────────────

  createInvite(input: {
    organizationId: string;
    email: string;
    name: string;
    role: OrgRole;
    invitedBy: string;
  }): { invite: OrgInviteRecord; token: string } {
    const token = generateInviteToken();
    const now = new Date().toISOString();
    const invite: OrgInviteRecord = {
      id: randomUUID(),
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
      role: input.role,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      invitedBy: input.invitedBy,
      createdAt: now,
    };
    this.orgInvites.push(invite);
    return { invite, token };
  }

  listInvites(organizationId: string): OrgInviteRecord[] {
    return this.orgInvites.filter((i) => i.organizationId === organizationId && !i.acceptedAt);
  }

  findInviteByToken(token: string): OrgInviteRecord | undefined {
    const tokenHash = hashInviteToken(token);
    return this.orgInvites.find((i) => i.tokenHash === tokenHash);
  }

  acceptInvite(
    token: string,
    passwordHash: string
  ):
    | { user: OrgUserRecord; invite: OrgInviteRecord }
    | 'INVALID_TOKEN'
    | 'EXPIRED'
    | 'ALREADY_ACCEPTED' {
    const invite = this.findInviteByToken(token);
    if (!invite) return 'INVALID_TOKEN';
    if (invite.acceptedAt) return 'ALREADY_ACCEPTED';
    if (new Date(invite.expiresAt).getTime() < Date.now()) return 'EXPIRED';

    const now = new Date().toISOString();
    invite.acceptedAt = now;

    const user: OrgUserRecord = {
      id: randomUUID(),
      organizationId: invite.organizationId,
      name: invite.name,
      email: invite.email,
      passwordHash,
      role: invite.role,
      status: 'active',
      invitedAt: invite.createdAt,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.orgUsers.push(user);

    return { user, invite };
  }

  inviteToDTO(invite: OrgInviteRecord): OrgInviteDTO {
    const { tokenHash: _tokenHash, ...dto } = invite;
    return dto;
  }

  // ─── Audit log ──────────────────────────────────────────────────────────

  recordAudit(entry: {
    organizationId: string;
    action: OrgAuditAction;
    actorId?: string;
    actorEmail: string;
    target?: string;
    metadata?: Record<string, unknown>;
  }): OrgAuditEntry {
    const record: OrgAuditEntry = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this.auditLog.push(record);
    return record;
  }

  getAuditLog(organizationId: string, filters: { limit?: number } = {}): OrgAuditEntry[] {
    let list = this.auditLog
      .filter((e) => e.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  getDashboardSummary(organizationId: string): {
    organizations: number;
    users: number;
    environments: number;
    apisRegistered: number;
    connectors: number;
  } {
    return {
      organizations: this.getOrganization(organizationId) ? 1 : 0,
      users: this.listUsers(organizationId).length,
      environments: this.listEnvironments(organizationId).length,
      apisRegistered: 0,
      connectors: 0,
    };
  }
}

export const portalIdentityStore = PortalIdentityStore.getInstance();
