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
  | 'erp-integration'
  | 'projects'
  | 'connector-registry'
  | 'runtime-registration'
  | 'connector-management'
  | 'job-orchestration'
  | 'message-delivery'
  | 'erp-connectivity'
  | 'runtime-connector-execution'
  | 'erp-metadata'
  | 'semantic-mapping'
  | 'canonical-model'
  | 'query-planner'
  | 'sql-generator'
  | 'query-execution'
  | 'security'
  | 'ha';

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
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
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
  | 'RUN_CHAOS_SCENARIO'
  // Sprint 46.6 — Connector Registry
  | 'CONNECTOR_REGISTERED'
  | 'CONNECTOR_UPDATED'
  | 'CONNECTOR_DELETED'
  | 'CONNECTOR_ACTIVATED'
  | 'CONNECTOR_DEACTIVATED'
  | 'CONNECTOR_VERSION_PUBLISHED'
  | 'CONNECTOR_PARAMETER_UPDATED'
  | 'CONNECTOR_PARAMETER_DELETED'
  | 'CONNECTOR_TEMPLATE_CREATED'
  | 'CONNECTOR_TEMPLATE_DELETED'
  // Sprint 46.3 — Atlas Runtime Registration & Provisioning Engine
  | 'RUNTIME_REGISTERED'
  | 'RUNTIME_ACTIVATED'
  | 'RUNTIME_BLOCKED'
  | 'RUNTIME_REACTIVATED'
  | 'RUNTIME_CERTIFICATE_REVOKED'
  | 'RUNTIME_ACTIVATION_KEY_ISSUED'
  | 'RUNTIME_ACTIVATION_KEY_REVOKED'
  // Runtime Registration & Agent Management — JWT session auth + config
  | 'RUNTIME_LOGIN'
  | 'RUNTIME_LOGOUT'
  | 'RUNTIME_TOKEN_ROTATED'
  | 'RUNTIME_CONFIG_UPDATED'
  // Sprint 46.4 — Connector Lifecycle Management Engine
  | 'CONNECTOR_ASSIGNED'
  | 'CONNECTOR_UPDATE_REQUESTED'
  | 'CONNECTOR_UPDATE_REJECTED'
  | 'CONNECTOR_INSTALLATION_OUTCOME_REPORTED'
  | 'CONNECTOR_ROLLED_BACK'
  // Sprint 46.5 — Remote Command & Job Orchestration Engine
  | 'JOB_CREATED'
  | 'JOB_CANCELLED'
  | 'JOB_RESULT_REPORTED'
  // Reliable Message Delivery & Execution Engine (message-delivery module)
  | 'MESSAGE_ENQUEUED'
  | 'MESSAGE_ACKNOWLEDGED'
  | 'MESSAGE_REPROCESSED'
  // Secure ERP Connectivity Engine (erp-connectivity module)
  | 'CONNECTION_PROFILE_CREATED'
  | 'CONNECTION_CREDENTIAL_ROTATED'
  | 'CONNECTION_AUTH_FAILED'
  | 'CONNECTION_RECONNECTED'
  | 'CONNECTION_STATUS_CHANGED'
  | 'CONNECTION_PROFILE_DELETED'
  // Runtime Connector Execution Engine (runtime-connector-execution module)
  | 'EXECUTION_PLANNED'
  | 'EXECUTION_REJECTED'
  | 'EXECUTION_RESULT_REPORTED'
  // ERP Command Reliability & Production Readiness (Sprint 46.11)
  | 'EXECUTION_ROLLED_BACK'
  // Universal ERP Metadata Discovery Engine (erp-metadata module)
  | 'METADATA_DISCOVERY_REQUESTED'
  | 'METADATA_DISCOVERY_COMPLETED'
  | 'METADATA_DISCOVERY_FAILED'
  // Intelligent ERP Semantic Mapping Engine (semantic-mapping module)
  | 'SEMANTIC_MAPPING_ANALYZED'
  | 'SEMANTIC_MAPPING_APPROVED'
  | 'SEMANTIC_MAPPING_REJECTED'
  // Canonical Business Model Engine (canonical-model module)
  | 'CANONICAL_MODEL_BUILT'
  | 'CANONICAL_MODEL_APPROVED'
  | 'CANONICAL_MODEL_ROLLED_BACK'
  // Universal Query Planning Engine (query-planner module)
  | 'QUERY_PLAN_CREATED'
  // Universal SQL Generation Engine (sql-generator module)
  | 'SQL_QUERY_GENERATED'
  // Universal Query Execution Engine (query-execution module)
  | 'QUERY_EXECUTION_REQUESTED'
  | 'QUERY_EXECUTION_COMPLETED'
  | 'QUERY_EXECUTION_FAILED'
  | 'QUERY_EXECUTION_CANCELLED';

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
