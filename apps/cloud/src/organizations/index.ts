/**
 * @seltriva/cloud — organizations
 * Organization management: creation, lifecycle, member management.
 */

import type {
  Organization,
  OrganizationId,
  UserId,
  WorkspaceId,
  MemberRole,
  OrganizationTier,
  OrganizationStatus,
  PaginatedResult,
  DomainResult,
  Email,
  Slug,
} from '../domain/index';

export interface IOrganizationService {
  create(input: CreateOrganizationInput): Promise<DomainResult<Organization>>;
  getById(id: OrganizationId): Promise<Organization | null>;
  getBySlug(slug: Slug): Promise<Organization | null>;
  update(
    id: OrganizationId,
    input: UpdateOrganizationInput,
    actorId: UserId
  ): Promise<DomainResult<Organization>>;
  suspend(id: OrganizationId, reason: string, actorId: UserId): Promise<DomainResult<void>>;
  activate(id: OrganizationId, actorId: UserId): Promise<DomainResult<void>>;
  delete(id: OrganizationId, actorId: UserId): Promise<DomainResult<void>>;
  list(filter: OrganizationListFilter): Promise<PaginatedResult<Organization>>;
  getSummary(id: OrganizationId): Promise<OrganizationSummaryView | null>;
  changeTier(
    id: OrganizationId,
    tier: OrganizationTier,
    actorId: UserId
  ): Promise<DomainResult<void>>;
}

export interface IMemberService {
  invite(input: InviteMemberInput): Promise<DomainResult<void>>;
  acceptInvite(token: string, userId: UserId): Promise<DomainResult<Organization>>;
  removeMember(
    orgId: OrganizationId,
    memberId: UserId,
    actorId: UserId
  ): Promise<DomainResult<void>>;
  updateRole(
    orgId: OrganizationId,
    memberId: UserId,
    role: MemberRole,
    actorId: UserId
  ): Promise<DomainResult<void>>;
  getMembers(orgId: OrganizationId): Promise<OrganizationMemberView[]>;
  getMember(orgId: OrganizationId, userId: UserId): Promise<OrganizationMemberView | null>;
}

export interface CreateOrganizationInput {
  readonly name: string;
  readonly slug: Slug;
  readonly tier?: OrganizationTier;
  readonly ownerUserId: UserId;
}

export interface UpdateOrganizationInput {
  readonly name?: string;
  readonly logoUrl?: string;
  readonly settings?: Record<string, unknown>;
}

export interface InviteMemberInput {
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: Email;
  readonly role: MemberRole;
  readonly invitedByUserId: UserId;
}

export interface OrganizationListFilter {
  readonly status?: OrganizationStatus;
  readonly tier?: OrganizationTier;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface OrganizationMemberView {
  readonly userId: UserId;
  readonly email: Email;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly role: MemberRole;
  readonly joinedAt?: Date;
  readonly invitedAt: Date;
  readonly isPending: boolean;
}

export interface OrganizationSummaryView {
  readonly organization: Organization;
  readonly workspaceCount: number;
  readonly agentCount: number;
  readonly memberCount: number;
  readonly onlineAgentCount: number;
  readonly tier: OrganizationTier;
  readonly licenseStatus?: string;
  readonly licenseExpiresAt?: Date;
}

export interface OrganizationSlugAvailabilityResult {
  readonly slug: string;
  readonly available: boolean;
  readonly suggestions?: string[];
}
