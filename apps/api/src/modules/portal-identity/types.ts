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
  | 'audit'
  | 'api-keys'
  | 'rate-limits'
  | 'gateway-settings'
  | 'api-logs';
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
  /**
   * ATLAS 46.21 — cross-reference to the real, Postgres-persisted Control
   * Plane Organization (packages/database's `Organization` model,
   * apps/api/src/modules/control-plane/tenancy.repository.ts) that this
   * portal Organization was linked to at creation. portal-identity's own
   * OrganizationRecord remains in-memory and is NOT restart-durable — see
   * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md for why the two weren't
   * merged into one entity. Null when the Control Plane link couldn't be
   * established (e.g. database unavailable at registration time) — a
   * portal Organization is still usable without it, just not yet visible
   * cross-referenced in the Control Plane.
   */
  controlPlaneOrganizationId: string | null;
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
  | 'ENVIRONMENT_DELETED'
  // Sprint 46.5 — API Gateway Foundation
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'API_KEY_REGENERATED'
  | 'RATE_LIMIT_RULE_UPDATED'
  | 'RATE_LIMIT_RULE_DELETED'
  | 'GATEWAY_SETTINGS_UPDATED';

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
