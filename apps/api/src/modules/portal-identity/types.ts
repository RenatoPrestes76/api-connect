// ─── Roles & Permissions ────────────────────────────────────────────────────
//
// Deliberately separate from `UserRole` in @seltriva/release (owner/admin/
// developer/viewer, used by the older apps/api/src/modules/portal/portal-store.ts
// user records) — this sprint adds a 5th role (Operator) that the shared
// package doesn't have, and extending a shared package for a portal-only
// concern would ripple into Prisma's MemberRole enum and unrelated consumers
// (apps/admin's erp-integration code also imports UserRole). See the Sprint
// 46.4 plan for the full rationale.

export type OrgRole = 'OWNER' | 'ADMINISTRATOR' | 'DEVELOPER' | 'OPERATOR' | 'VIEWER';

export type PortalPermissionResource =
  | 'organization'
  | 'environments'
  | 'org-users'
  | 'invites'
  | 'audit';
export type PortalPermissionAction = 'read' | 'write' | 'delete' | 'manage';

/** `${resource}.${action}` — e.g. "organization.write". */
export type PortalPermissionKey = string;

export interface PortalPermission {
  id: PortalPermissionKey;
  resource: PortalPermissionResource;
  action: PortalPermissionAction;
  description: string;
}

// ─── Organization ───────────────────────────────────────────────────────────

export type OrganizationStatus = 'active' | 'suspended' | 'deleted';
export type OrganizationPlan = 'community' | 'professional' | 'enterprise';

export interface OrganizationRecord {
  id: string;
  name: string;
  razaoSocial: string;
  cnpj: string;
  internalCode: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Environments ───────────────────────────────────────────────────────────

export type EnvironmentKind = 'production' | 'staging' | 'development';
export type EnvironmentStatus = 'active' | 'inactive';

export interface EnvironmentRecord {
  id: string;
  organizationId: string;
  name: string;
  kind: EnvironmentKind;
  status: EnvironmentStatus;
  region: string;
  timezone: string;
  createdAt: string;
}

// ─── Org users ──────────────────────────────────────────────────────────────

export type OrgUserStatus = 'invited' | 'active' | 'suspended';

export interface OrgUserRecord {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: OrgRole;
  status: OrgUserStatus;
  invitedAt: string;
  joinedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUserDTO {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: OrgRole;
  status: OrgUserStatus;
  invitedAt: string;
  joinedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Invites ────────────────────────────────────────────────────────────────

export interface OrgInviteRecord {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: OrgRole;
  tokenHash: string;
  expiresAt: string;
  acceptedAt?: string;
  invitedBy: string;
  createdAt: string;
}

export interface OrgInviteDTO {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: OrgRole;
  expiresAt: string;
  acceptedAt?: string;
  invitedBy: string;
  createdAt: string;
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export type OrgAuditAction =
  | 'ORG_CREATED'
  | 'ORG_UPDATED'
  | 'ORG_DELETED'
  | 'USER_INVITED'
  | 'INVITE_ACCEPTED'
  | 'USER_ROLE_CHANGED'
  | 'USER_REMOVED'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'ENVIRONMENT_CREATED'
  | 'ENVIRONMENT_DELETED';

export interface OrgAuditEntry {
  id: string;
  organizationId: string;
  action: OrgAuditAction;
  actorId?: string;
  actorEmail: string;
  target?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
