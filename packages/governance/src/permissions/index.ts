/**
 * @seltriva/governance — permissions
 *
 * Fine-grained permission registry: permission sets, matrices, and resolution.
 * Permissions are the atomic units of access control.
 * Roles aggregate permissions. Policies evaluate whether permissions apply.
 */

import type { PermissionId, Permission, PermissionCategory, PermissionAction } from '../rbac/index';
import type { ResourceType, GovernanceResult } from '../policies/index';

// ─── Permission Set ──────────────────────────────────────────────────────────

export interface PermissionSet {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permissions: PermissionId[];
  readonly system: boolean;
  readonly category: PermissionCategory;
}

// ─── Permission Matrix ───────────────────────────────────────────────────────

export type PermissionMatrix = Map<ResourceType, Set<PermissionAction>>;

export interface PermissionMatrixView {
  readonly resource: ResourceType;
  readonly actions: PermissionAction[];
  readonly granted: boolean[];
}

// ─── Permission Resolution ──────────────────────────────────────────────────

export interface PermissionResolutionInput {
  readonly roleIds: string[];
  readonly scopeContext?: {
    readonly organizationId?: string;
    readonly workspaceId?: string;
    readonly environmentId?: string;
  };
}

export interface PermissionResolutionResult {
  readonly permissions: string[];
  readonly sources: PermissionSource[];
  readonly resolvedAt: Date;
}

export interface PermissionSource {
  readonly permission: string;
  readonly fromRole: string;
  readonly fromInheritance: boolean;
}

// ─── Permission Registry Interface ───────────────────────────────────────────

export interface IPermissionRegistry {
  /**
   * Find a permission by its key (e.g. "agents:read")
   */
  findByKey(key: string): Permission | null;

  /**
   * List all permissions in a category.
   */
  listByCategory(category: PermissionCategory): Permission[];

  /**
   * List all permissions for a resource type.
   */
  listByResource(resource: ResourceType): Permission[];

  /**
   * Resolve effective permissions from a set of role IDs.
   */
  resolve(input: PermissionResolutionInput): Promise<PermissionResolutionResult>;

  /**
   * Build a permission matrix for a subject in a given context.
   */
  buildMatrix(permissions: string[]): PermissionMatrixView[];

  /**
   * Register a custom permission (for plugin-defined permissions).
   */
  register(permission: Omit<Permission, 'id'>): GovernanceResult<Permission>;

  /**
   * Check whether a permission key is valid.
   */
  isValid(key: string): boolean;

  /**
   * Expand wildcard permissions (e.g. "*:admin" → all admin permissions).
   */
  expand(key: string): string[];
}

// ─── Permission Guard ────────────────────────────────────────────────────────

export interface IPermissionGuard {
  /**
   * Assert a permission is held — throws GovernanceError if not.
   */
  assert(permission: string, context: PermissionGuardContext): void;

  /**
   * Check a permission — returns boolean.
   */
  check(permission: string, context: PermissionGuardContext): boolean;

  /**
   * Check multiple permissions at once.
   */
  checkAll(permissions: string[], context: PermissionGuardContext): boolean;

  /**
   * Check any one of the permissions.
   */
  checkAny(permissions: string[], context: PermissionGuardContext): boolean;
}

export interface PermissionGuardContext {
  readonly subjectPermissions: string[];
  readonly organizationId?: string;
  readonly environmentId?: string;
}

// ─── Built-in Permission Sets ────────────────────────────────────────────────

export const PERMISSION_SETS: Record<string, string[]> = {
  READ_ONLY: [
    'organizations:read',
    'workspaces:read',
    'environments:read',
    'agents:read',
    'plugins:read',
    'configurations:read',
    'audit:read',
    'metrics:read',
  ],
  DEVELOPER: [
    'organizations:read',
    'workspaces:read',
    'environments:read',
    'agents:read',
    'agents:execute',
    'plugins:read',
    'plugins:install',
    'configurations:read',
    'configurations:write',
    'feature-flags:read',
    'change-requests:create',
  ],
  OPERATOR: [
    'agents:read',
    'agents:write',
    'agents:execute',
    'configurations:read',
    'configurations:write',
    'releases:read',
    'releases:execute',
    'backups:read',
    'metrics:read',
  ],
  SECURITY_ADMIN: [
    'policies:read',
    'policies:write',
    'roles:read',
    'roles:write',
    'roles:admin',
    'secrets:admin',
    'audit:read',
    'audit:execute',
    'compliance:read',
    'compliance:admin',
  ],
  COMPLIANCE_OFFICER: [
    'audit:read',
    'audit:execute',
    'compliance:read',
    'compliance:admin',
    'policies:read',
    'roles:read',
  ],
  RELEASE_MANAGER: [
    'releases:read',
    'releases:create',
    'releases:publish',
    'releases:execute',
    'change-requests:read',
    'change-requests:approve',
    'change-requests:execute',
  ],
} as const;
