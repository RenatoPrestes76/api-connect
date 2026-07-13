/**
 * @seltriva/governance — rbac
 *
 * Role-Based Access Control: Roles, Permissions, Claims, Scopes, Contexts.
 *
 * Architecture:
 *   Subject → has Roles → Roles grant Permissions
 *   Subject → has Claims → Claims carry contextual attributes
 *   Subject → has Scopes → Scopes limit API key access
 *   Access checked via RBACContext (bound to org/workspace/environment)
 */

import type { PolicyId, GovernanceResult, GovernanceError } from '../policies/index';

// ─── Branded Types ────────────────────────────────────────────────────────

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type RoleId = Branded<string, 'RoleId'>;
export type PermissionId = Branded<string, 'PermissionId'>;
export type ScopeId = Branded<string, 'ScopeId'>;
export type ClaimId = Branded<string, 'ClaimId'>;
export type ContextId = Branded<string, 'ContextId'>;

// ─── Permission ──────────────────────────────────────────────────────────────

export interface Permission {
  readonly id: PermissionId;
  readonly key: string; // format: "resource:action[:qualifier]"
  readonly resource: string; // e.g. "agents", "configurations", "secrets"
  readonly action: PermissionAction; // e.g. "read", "write", "delete", "admin"
  readonly qualifier?: string; // e.g. "production", "sensitive"
  readonly description: string;
  readonly category: PermissionCategory;
  readonly sensitive: boolean; // requires extra scrutiny in audit
}

export type PermissionAction =
  | 'read'
  | 'write'
  | 'create'
  | 'delete'
  | 'admin'
  | 'execute'
  | 'approve'
  | 'publish'
  | 'install'
  | 'configure'
  | '*';

export type PermissionCategory =
  | 'platform'
  | 'organization'
  | 'workspace'
  | 'environment'
  | 'agent'
  | 'plugin'
  | 'security'
  | 'governance'
  | 'compliance'
  | 'infrastructure';

// ─── Platform Permission Registry ───────────────────────────────────────────

export const PLATFORM_PERMISSIONS = {
  // Organizations
  ORGS_READ: 'organizations:read',
  ORGS_WRITE: 'organizations:write',
  ORGS_DELETE: 'organizations:delete',
  ORGS_ADMIN: 'organizations:admin',

  // Workspaces
  WORKSPACES_READ: 'workspaces:read',
  WORKSPACES_WRITE: 'workspaces:write',
  WORKSPACES_DELETE: 'workspaces:delete',

  // Environments
  ENVS_READ: 'environments:read',
  ENVS_WRITE: 'environments:write',
  ENVS_ADMIN: 'environments:admin',
  ENVS_PROD_WRITE: 'environments:write:production',

  // Agents
  AGENTS_READ: 'agents:read',
  AGENTS_WRITE: 'agents:write',
  AGENTS_COMMAND: 'agents:execute',
  AGENTS_RETIRE: 'agents:delete',

  // Plugins
  PLUGINS_READ: 'plugins:read',
  PLUGINS_INSTALL: 'plugins:install',
  PLUGINS_PUBLISH: 'plugins:publish',
  PLUGINS_ADMIN: 'plugins:admin',

  // Configurations
  CONFIG_READ: 'configurations:read',
  CONFIG_WRITE: 'configurations:write',
  CONFIG_SECRETS_READ: 'configurations:read:sensitive',

  // Secrets
  SECRETS_READ: 'secrets:read',
  SECRETS_WRITE: 'secrets:write',
  SECRETS_ADMIN: 'secrets:admin',

  // Policies
  POLICIES_READ: 'policies:read',
  POLICIES_WRITE: 'policies:write',
  POLICIES_ADMIN: 'policies:admin',

  // Roles
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_ASSIGN: 'roles:admin',

  // Audit
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:execute',

  // Compliance
  COMPLIANCE_READ: 'compliance:read',
  COMPLIANCE_ADMIN: 'compliance:admin',

  // Change Management
  CHANGES_READ: 'change-requests:read',
  CHANGES_CREATE: 'change-requests:create',
  CHANGES_APPROVE: 'change-requests:approve',
  CHANGES_DEPLOY: 'change-requests:execute',

  // Feature Flags
  FLAGS_READ: 'feature-flags:read',
  FLAGS_WRITE: 'feature-flags:write',

  // Releases
  RELEASES_READ: 'releases:read',
  RELEASES_CREATE: 'releases:create',
  RELEASES_PUBLISH: 'releases:publish',
  RELEASES_ROLLBACK: 'releases:execute',

  // Backup
  BACKUP_READ: 'backups:read',
  BACKUP_EXECUTE: 'backups:execute',
  BACKUP_RESTORE: 'backups:admin',

  // Platform admin
  PLATFORM_ADMIN: '*:admin',
} as const;

export type PlatformPermissionKey =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

// ─── Role ────────────────────────────────────────────────────────────────────

export interface Role {
  readonly id: RoleId;
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly type: RoleType;
  readonly level: RoleLevel;
  readonly permissions: PermissionId[];
  readonly inherits?: RoleId[]; // role inheritance chain
  readonly policies?: PolicyId[]; // attached policies
  readonly maxScope?: RoleScope; // maximum scope this role can be assigned at
  readonly system: boolean; // system roles cannot be modified
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type RoleType = 'platform' | 'organization' | 'workspace' | 'environment' | 'custom';
export type RoleLevel = 'platform' | 'organization' | 'workspace' | 'environment';

export interface RoleScope {
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
}

// ─── Built-in Platform Roles ─────────────────────────────────────────────────

export const PLATFORM_ROLES = {
  // Platform-level (applies across all organizations)
  PLATFORM_SUPER_ADMIN: 'role-platform-super-admin',
  PLATFORM_ADMIN: 'role-platform-admin',
  PLATFORM_AUDITOR: 'role-platform-auditor',
  PLATFORM_VIEWER: 'role-platform-viewer',

  // Organization-level
  ORG_OWNER: 'role-org-owner',
  ORG_ADMIN: 'role-org-admin',
  ORG_SECURITY_ADMIN: 'role-org-security-admin',
  ORG_COMPLIANCE: 'role-org-compliance',
  ORG_DEVELOPER: 'role-org-developer',
  ORG_VIEWER: 'role-org-viewer',
  ORG_BILLING: 'role-org-billing',

  // Environment-level
  ENV_MANAGER: 'role-env-manager',
  ENV_OPERATOR: 'role-env-operator',
  ENV_DEPLOYER: 'role-env-deployer',
  ENV_VIEWER: 'role-env-viewer',

  // Functional roles
  PLUGIN_PUBLISHER: 'role-plugin-publisher',
  AGENT_OPERATOR: 'role-agent-operator',
  CHANGE_MANAGER: 'role-change-manager',
  RELEASE_MANAGER: 'role-release-manager',
  BACKUP_OPERATOR: 'role-backup-operator',
} as const;

// ─── Scope ───────────────────────────────────────────────────────────────────

export interface Scope {
  readonly id: ScopeId;
  readonly name: string;
  readonly description: string;
  readonly permissions: string[]; // permission keys included in this scope
  readonly audience?: string; // intended API consumer
  readonly system: boolean;
}

// ─── Built-in API Scopes ─────────────────────────────────────────────────────

export const API_SCOPES = {
  // Read scopes
  'agents:read': 'Read agent status and metrics',
  'organizations:read': 'Read organization data',
  'workspaces:read': 'Read workspace data',
  'configurations:read': 'Read configuration values',
  'plugins:read': 'Read plugin data',
  'audit:read': 'Read audit logs',
  'compliance:read': 'Read compliance reports',
  'releases:read': 'Read release data',
  'metrics:read': 'Read platform metrics',

  // Write scopes
  'agents:write': 'Send commands to agents',
  'configurations:write': 'Write configuration values',
  'plugins:install': 'Install plugins',
  'feature-flags:write': 'Manage feature flags',
  'change-requests:create': 'Create change requests',

  // Admin scopes
  'organizations:admin': 'Full organization administration',
  'policies:admin': 'Manage governance policies',
  'roles:admin': 'Manage roles and assignments',
  'secrets:admin': 'Manage secrets (restricted)',
  'platform:admin': 'Full platform administration',
} as const;

// ─── RBAC Context ────────────────────────────────────────────────────────────

export interface RBACContext {
  readonly id: ContextId;
  readonly subjectId: string;
  readonly subjectType: 'user' | 'api-key' | 'agent' | 'service';
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly roles: RoleId[];
  readonly permissions: string[]; // flattened effective permissions
  readonly scopes: string[]; // API key scopes (if applicable)
  readonly claims: ContextClaim[];
  readonly attributes: Record<string, unknown>;
  readonly resolvedAt: Date;
}

export interface ContextClaim {
  readonly key: string;
  readonly value: unknown;
  readonly verified: boolean;
  readonly expiresAt?: Date;
}

// ─── Role Assignment ─────────────────────────────────────────────────────────

export interface RoleAssignment {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectType: 'user' | 'api-key' | 'service';
  readonly roleId: RoleId;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly grantedBy: string;
  readonly expiresAt?: Date;
  readonly conditions?: Record<string, unknown>;
  readonly createdAt: Date;
}

// ─── RBAC Service Interface ──────────────────────────────────────────────────

export interface IRBACService {
  /**
   * Resolve full RBAC context for a subject in a given org/workspace/env.
   */
  resolveContext(
    subjectId: string,
    subjectType: RBACContext['subjectType'],
    scope: RoleScope
  ): Promise<RBACContext>;

  /**
   * Check a single permission for a context.
   */
  checkPermission(context: RBACContext, permission: string): boolean;

  /**
   * Check multiple permissions at once (UI optimization).
   */
  checkPermissions(context: RBACContext, permissions: string[]): Record<string, boolean>;

  /**
   * Assign a role to a subject.
   */
  assignRole(input: AssignRoleInput): Promise<GovernanceResult<RoleAssignment>>;

  /**
   * Revoke a role assignment.
   */
  revokeRole(assignmentId: string, revokedBy: string): Promise<GovernanceResult<void>>;

  /**
   * Get all role assignments for a subject.
   */
  getAssignments(subjectId: string, scope?: RoleScope): Promise<RoleAssignment[]>;

  /**
   * Get effective permissions (flattened, including inheritance).
   */
  getEffectivePermissions(subjectId: string, scope: RoleScope): Promise<string[]>;
}

export interface AssignRoleInput {
  readonly subjectId: string;
  readonly subjectType: RoleAssignment['subjectType'];
  readonly roleId: RoleId;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly grantedBy: string;
  readonly expiresAt?: Date;
  readonly conditions?: Record<string, unknown>;
}

// ─── Role Administration ─────────────────────────────────────────────────────

export interface IRoleAdminService {
  create(input: CreateRoleInput): Promise<GovernanceResult<Role>>;
  update(id: RoleId, input: UpdateRoleInput): Promise<GovernanceResult<Role>>;
  delete(id: RoleId): Promise<GovernanceResult<void>>;
  getById(id: RoleId): Promise<Role | null>;
  listByOrganization(orgId: string): Promise<Role[]>;
  cloneRole(id: RoleId, newName: string): Promise<GovernanceResult<Role>>;
}

export interface CreateRoleInput {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly type: RoleType;
  readonly level: RoleLevel;
  readonly permissions: PermissionId[];
  readonly inherits?: RoleId[];
  readonly organizationId?: string;
}

export interface UpdateRoleInput {
  readonly displayName?: string;
  readonly description?: string;
  readonly permissions?: PermissionId[];
  readonly inherits?: RoleId[];
}

// ─── Claims Provider ─────────────────────────────────────────────────────────

export interface IClaimsProvider {
  /**
   * Extract claims from a JWT / API key / session.
   */
  extractClaims(token: string): Promise<ContextClaim[]>;

  /**
   * Validate claim integrity (signature, expiry).
   */
  validateClaim(claim: ContextClaim): boolean;

  /**
   * Enrich claims with organizational context.
   */
  enrichClaims(claims: ContextClaim[], organizationId: string): Promise<ContextClaim[]>;
}
