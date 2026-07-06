/**
 * @seltriva/runtime/permissions
 * Permission Model — capability-based access control for runtime modules
 *
 * The permission system governs:
 *   - Which modules can communicate with which services
 *   - What capabilities plugins may exercise
 *   - Which resources a sandboxed module can access
 *
 * Design:
 *   Capability-based: access is granted, not denied. Modules start with
 *   no permissions and are granted specific capabilities at registration.
 *   This is critical for plugin sandbox safety.
 */

import type { RuntimeResult, ModuleId, PluginId, PermissionId } from '../kernel/index';

// ─── Permission Model ───────��─────────────────────────────────────────────

export interface PermissionModel {
  /**
   * Grant a permission to a module
   */
  grant(grant: PermissionGrant): RuntimeResult<void>;

  /**
   * Revoke a previously granted permission
   */
  revoke(grantId: PermissionId, reason?: string): RuntimeResult<void>;

  /**
   * Check whether a principal has a permission
   */
  check(request: PermissionRequest): PermissionCheckResult;

  /**
   * Assert a permission — throws PermissionDeniedError if denied
   */
  assert(request: PermissionRequest): void;

  /**
   * List all permissions granted to a principal
   */
  listGrants(principal: PermissionPrincipal): PermissionGrant[];

  /**
   * Get all permissions defined in the registry
   */
  listDefinitions(): PermissionDefinition[];

  /**
   * Register a new permission definition
   */
  definePermission(definition: PermissionDefinition): void;

  /**
   * Audit log of permission checks
   */
  getAuditLog(filter?: PermissionAuditFilter): PermissionAuditEntry[];
}

// ─── Permission Definition ───────���────────────────────────────────────────

export interface PermissionDefinition {
  readonly id: PermissionId;
  readonly name: string;
  readonly description: string;
  readonly resource: ResourceKind;
  readonly action: ResourceAction;
  readonly scope: PermissionScope;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ─── Permission Grant ─��───────────────────────────────────────────────────

export interface PermissionGrant {
  readonly id: PermissionId;
  readonly principal: PermissionPrincipal;
  readonly permissionId: PermissionId;
  readonly resourceId?: string;
  readonly conditions?: PermissionCondition[];
  readonly grantedBy: string;
  readonly grantedAt: Date;
  readonly expiresAt?: Date;
}

// ─── Permission Request / Result ──────────────────────────────────────────

export interface PermissionRequest {
  readonly principal: PermissionPrincipal;
  readonly permissionId: PermissionId;
  readonly resourceId?: string;
  readonly context?: Record<string, unknown>;
}

export interface PermissionCheckResult {
  readonly granted: boolean;
  readonly reason?: string;
  readonly matchedGrant?: PermissionGrant;
  readonly conditionsFailed?: string[];
}

// ─── Principal ────────────��───────────────────────────────────────────────

export type PermissionPrincipal =
  | { readonly kind: 'module';  readonly id: ModuleId }
  | { readonly kind: 'plugin';  readonly id: PluginId }
  | { readonly kind: 'service'; readonly name: string }
  | { readonly kind: 'system' };

// ─── Resource Kinds ───────────────────────────────────────────────────────

export type ResourceKind =
  | 'service'        // access to a registered service
  | 'event'          // publish/subscribe events
  | 'command'        // dispatch/handle commands
  | 'configuration'  // read/write configuration
  | 'secret'         // access secrets
  | 'file-system'    // read/write files (sandboxed)
  | 'network'        // outbound HTTP/TCP calls
  | 'database'       // database access
  | 'worker-pool'    // create/use worker pool
  | 'scheduler'      // schedule jobs
  | 'telemetry'      // emit metrics/traces/logs
  | 'module'         // load/unload modules
  | 'platform';      // platform kernel operations

export type ResourceAction = 'read' | 'write' | 'execute' | 'subscribe' | 'publish' | 'manage';

export type PermissionScope = 'global' | 'namespace' | 'resource';

// ─── Conditions ───���────────────────────────────���──────────────────────────

export interface PermissionCondition {
  readonly kind: PermissionConditionKind;
  readonly value: unknown;
}

export type PermissionConditionKind =
  | 'environment-equals'    // only in specific environment
  | 'resource-matches'      // resource ID must match pattern
  | 'time-window'           // only during specified time range
  | 'rate-limit'            // max N checks per window
  | 'namespace-prefix';     // resource must be under a namespace

// ─── Built-in Permission IDs ──────────���───────────────────────────────────

export const PERMISSION_IDS = {
  // Services
  SERVICE_READ:          'perm-service-read'          as PermissionId,
  SERVICE_WRITE:         'perm-service-write'         as PermissionId,

  // Events
  EVENT_PUBLISH:         'perm-event-publish'         as PermissionId,
  EVENT_SUBSCRIBE:       'perm-event-subscribe'       as PermissionId,

  // Commands
  COMMAND_DISPATCH:      'perm-command-dispatch'      as PermissionId,
  COMMAND_HANDLE:        'perm-command-handle'        as PermissionId,

  // Configuration
  CONFIG_READ:           'perm-config-read'           as PermissionId,
  CONFIG_WRITE:          'perm-config-write'          as PermissionId,
  SECRET_READ:           'perm-secret-read'           as PermissionId,

  // Storage
  DATABASE_READ:         'perm-database-read'         as PermissionId,
  DATABASE_WRITE:        'perm-database-write'        as PermissionId,

  // Network
  NETWORK_OUTBOUND:      'perm-network-outbound'      as PermissionId,

  // Workers & Scheduler
  WORKER_CREATE:         'perm-worker-create'         as PermissionId,
  JOB_SCHEDULE:          'perm-job-schedule'          as PermissionId,

  // Platform
  MODULE_LOAD:           'perm-module-load'           as PermissionId,
  PLATFORM_MANAGE:       'perm-platform-manage'       as PermissionId,
} as const;

export type BuiltInPermissionId = (typeof PERMISSION_IDS)[keyof typeof PERMISSION_IDS];

// ─── Role ─────────────────────────────────────��───────────────────────────

export interface PermissionRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly permissions: PermissionId[];
}

export const BUILT_IN_ROLES = {
  CORE_MODULE:     'role-core-module',
  PLUGIN_STANDARD: 'role-plugin-standard',
  PLUGIN_TRUSTED:  'role-plugin-trusted',
  READONLY:        'role-readonly',
  OBSERVER:        'role-observer',
} as const;

// ─── Audit ───────────────────────────────────────────��────────────────────

export interface PermissionAuditEntry {
  readonly id: string;
  readonly principal: PermissionPrincipal;
  readonly permissionId: PermissionId;
  readonly resourceId?: string;
  readonly result: 'granted' | 'denied';
  readonly reason?: string;
  readonly checkedAt: Date;
}

export interface PermissionAuditFilter {
  readonly principal?: PermissionPrincipal;
  readonly permissionId?: PermissionId;
  readonly result?: 'granted' | 'denied';
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
}
