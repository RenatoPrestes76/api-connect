// ─── Roles & Permissions ────────────────────────────────────────────────────

export type AdminRoleName =
  | 'SUPER_ADMIN'
  | 'ATLAS_ADMIN'
  | 'SUPORTE'
  | 'CUSTOMER_SUCCESS'
  | 'COMERCIAL'
  | 'DEVOPS'
  | 'AUDITOR';

export interface AdminRole {
  id: string;
  name: AdminRoleName;
  description: string;
  isSystem: boolean;
}

export type PermissionResource =
  | 'companies'
  | 'runtime'
  | 'marketplace'
  | 'users'
  | 'audit'
  | 'billing'
  | 'settings'
  | 'dashboard'
  | 'erp-integration';

export type PermissionAction =
  | 'read'
  | 'write'
  | 'delete'
  | 'restart'
  | 'update'
  | 'token'
  | 'publish'
  | 'review'
  | 'manage'
  | 'view';

export interface Permission {
  id: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}

/** `${resource}.${action}` — e.g. "companies.read". */
export type PermissionKey = string;

// ─── Users ──────────────────────────────────────────────────────────────────

export type AdminUserStatus = 'active' | 'suspended' | 'disabled';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  status: AdminUserStatus;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sessions (refresh tokens) ──────────────────────────────────────────────

export interface AdminSessionRecord {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  ip: string;
  userAgent: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

// ─── Login attempts ─────────────────────────────────────────────────────────

export interface LoginAttemptRecord {
  id: string;
  email: string;
  ip: string;
  success: boolean;
  createdAt: string;
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export type AdminAuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REFRESH_TOKEN'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_CHANGED'
  | 'CREATE_COMPANY'
  | 'DELETE_COMPANY'
  | 'UPDATE_RUNTIME'
  | 'CREATE_USER'
  | 'CHANGE_ROLE'
  // Sprint 46.3 — Control Plane functional modules
  | 'CREATE_TENANT'
  | 'UPDATE_TENANT'
  | 'DELETE_TENANT'
  | 'CREATE_ORGANIZATION'
  | 'UPDATE_ORGANIZATION'
  | 'DELETE_ORGANIZATION'
  | 'CREATE_ENVIRONMENT'
  | 'DELETE_ENVIRONMENT'
  | 'RESTART_RUNTIME'
  | 'RETIRE_RUNTIME'
  | 'ROTATE_RUNTIME_TOKEN'
  | 'PUBLISH_CONNECTOR_VERSION'
  | 'CREATE_DEPLOYMENT'
  | 'ROLLBACK_DEPLOYMENT'
  | 'CREATE_FEATURE_FLAG'
  | 'TOGGLE_FEATURE_FLAG'
  | 'DELETE_FEATURE_FLAG'
  // Sprint 46.4 — Operations & Fleet Management
  | 'RUNTIME_COMMAND'
  | 'CONNECTOR_INSTALL'
  | 'CONNECTOR_UPDATE'
  | 'CONNECTOR_REMOVE'
  | 'CONNECTOR_RESTART'
  | 'CREATE_DEPLOYMENT_JOB'
  | 'APPROVE_DEPLOYMENT_JOB'
  | 'REJECT_DEPLOYMENT_JOB'
  | 'ROLLBACK_DEPLOYMENT_JOB'
  | 'ACKNOWLEDGE_ALERT'
  | 'RESOLVE_ALERT'
  // Sprint 47 — ATLAS FORTRESS: HA & Enterprise Resilience
  | 'INJECT_DEPLOYMENT_FAILURE'
  | 'CREATE_AUTOSCALE_POLICY'
  | 'UPDATE_AUTOSCALE_POLICY'
  | 'DELETE_AUTOSCALE_POLICY'
  | 'RUN_CHAOS_SCENARIO';

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  actorId?: string;
  actorEmail: string;
  target?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface AdminUserDTO {
  id: string;
  name: string;
  email: string;
  role: AdminRoleName;
  permissions: PermissionKey[];
  status: AdminUserStatus;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}
