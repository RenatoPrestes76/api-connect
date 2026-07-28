import type {
  AdminRoleName,
  Permission,
  PermissionAction,
  PermissionKey,
  PermissionResource,
} from './types.js';

/** The full permission catalogue, as specified for Sprint 46.2. */
export const PERMISSION_CATALOG: Array<{
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}> = [
  { resource: 'companies', action: 'read', description: 'View company records' },
  { resource: 'companies', action: 'write', description: 'Create and edit company records' },
  { resource: 'companies', action: 'delete', description: 'Delete company records' },
  { resource: 'runtime', action: 'read', description: 'View runtime fleet status' },
  { resource: 'runtime', action: 'restart', description: 'Restart a runtime instance' },
  { resource: 'runtime', action: 'update', description: 'Update runtime configuration/version' },
  { resource: 'runtime', action: 'token', description: 'Issue or rotate runtime access tokens' },
  {
    resource: 'marketplace',
    action: 'publish',
    description: 'Publish connectors to the marketplace',
  },
  {
    resource: 'marketplace',
    action: 'review',
    description: 'Review pending marketplace submissions',
  },
  { resource: 'users', action: 'manage', description: 'Manage admin users and role assignments' },
  { resource: 'audit', action: 'read', description: 'Read the admin audit log' },
  { resource: 'billing', action: 'manage', description: 'Manage licenses and billing' },
  { resource: 'settings', action: 'manage', description: 'Manage global Control Plane settings' },
  { resource: 'dashboard', action: 'view', description: 'View the Control Plane dashboard' },
  {
    resource: 'erp-integration',
    action: 'read',
    description: "Read a company's ERP integration mode and health status",
  },
  {
    resource: 'erp-integration',
    action: 'manage',
    description: "Register or update a company's ERP integration mode",
  },
  { resource: 'projects', action: 'read', description: 'View projects' },
  { resource: 'projects', action: 'write', description: 'Create and edit projects' },
  { resource: 'projects', action: 'delete', description: 'Delete projects' },
  { resource: 'connector-registry', action: 'read', description: 'View the connector registry' },
  {
    resource: 'connector-registry',
    action: 'write',
    description: 'Register connectors, publish versions, manage parameters and templates',
  },
  {
    resource: 'connector-registry',
    action: 'delete',
    description: 'Delete connectors, parameters, and templates',
  },
  {
    resource: 'runtime-registration',
    action: 'read',
    description: 'View registered Atlas Runtimes and activation keys',
  },
  {
    resource: 'runtime-registration',
    action: 'write',
    description: 'Issue activation keys, block/reactivate Runtimes',
  },
  {
    resource: 'runtime-registration',
    action: 'delete',
    description: "Revoke a Runtime's certificate",
  },
  {
    resource: 'connector-management',
    action: 'read',
    description: 'View connector installations on Runtimes',
  },
  {
    resource: 'connector-management',
    action: 'write',
    description: 'Assign, update, and roll back connectors on Runtimes',
  },
  {
    resource: 'job-orchestration',
    action: 'read',
    description: 'View remote command jobs and their execution history',
  },
  {
    resource: 'job-orchestration',
    action: 'write',
    description: 'Create and cancel remote command jobs',
  },
  {
    resource: 'message-delivery',
    action: 'read',
    description: 'View message delivery status, pending queues, and the dead-letter queue',
  },
  {
    resource: 'message-delivery',
    action: 'write',
    description: 'Send messages and reprocess dead-lettered messages',
  },
  {
    resource: 'erp-connectivity',
    action: 'read',
    description: 'View ERP connection profiles, health, and diagnostics',
  },
  {
    resource: 'erp-connectivity',
    action: 'write',
    description: 'Create, update, and delete ERP connection profiles',
  },
  {
    resource: 'runtime-connector-execution',
    action: 'read',
    description: 'View connector execution plans and their results',
  },
  {
    resource: 'runtime-connector-execution',
    action: 'write',
    description: 'Request connector executions against a Runtime',
  },
  {
    resource: 'erp-metadata',
    action: 'read',
    description: 'View discovered ERP schema, tables, and relationships',
  },
  {
    resource: 'erp-metadata',
    action: 'write',
    description: 'Trigger ERP schema discovery against a Runtime',
  },
  {
    resource: 'semantic-mapping',
    action: 'read',
    description: 'View suggested and approved business-entity mappings',
  },
  {
    resource: 'semantic-mapping',
    action: 'write',
    description: 'Run semantic mapping analysis and approve/reject mappings',
  },
];

export function permissionKey(
  resource: PermissionResource,
  action: PermissionAction
): PermissionKey {
  return `${resource}.${action}`;
}

/** The seven system roles created automatically on first boot. */
export const SYSTEM_ROLES: Array<{ name: AdminRoleName; description: string }> = [
  { name: 'SUPER_ADMIN', description: 'Full, unrestricted access to the Control Plane' },
  { name: 'ATLAS_ADMIN', description: 'Day-to-day platform administration' },
  { name: 'SUPORTE', description: 'Customer support — read access plus marketplace review' },
  { name: 'CUSTOMER_SUCCESS', description: 'Manages customer/company relationships' },
  { name: 'COMERCIAL', description: 'Sales and billing operations' },
  { name: 'DEVOPS', description: 'Runtime fleet operations' },
  { name: 'AUDITOR', description: 'Read-only compliance and audit access' },
];

/** Default permission grants per system role. */
export const ROLE_PERMISSIONS: Record<AdminRoleName, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => permissionKey(p.resource, p.action)),
  ATLAS_ADMIN: [
    'companies.read',
    'companies.write',
    'runtime.read',
    'runtime.restart',
    'runtime.update',
    'runtime.token',
    'marketplace.publish',
    'marketplace.review',
    'audit.read',
    'settings.manage',
    'dashboard.view',
    'erp-integration.read',
    'erp-integration.manage',
    'projects.read',
    'projects.write',
    'projects.delete',
    'connector-registry.read',
    'connector-registry.write',
    'connector-registry.delete',
    'runtime-registration.read',
    'runtime-registration.write',
    'runtime-registration.delete',
    'connector-management.read',
    'connector-management.write',
    'job-orchestration.read',
    'job-orchestration.write',
    'message-delivery.read',
    'message-delivery.write',
    'erp-connectivity.read',
    'erp-connectivity.write',
    'runtime-connector-execution.read',
    'runtime-connector-execution.write',
    'erp-metadata.read',
    'erp-metadata.write',
    'semantic-mapping.read',
    'semantic-mapping.write',
  ],
  SUPORTE: [
    'companies.read',
    'runtime.read',
    'marketplace.review',
    'audit.read',
    'dashboard.view',
    'connector-registry.read',
    'runtime-registration.read',
    'connector-management.read',
    'job-orchestration.read',
    'message-delivery.read',
    'erp-connectivity.read',
    'runtime-connector-execution.read',
    'erp-metadata.read',
    'semantic-mapping.read',
  ],
  CUSTOMER_SUCCESS: [
    'companies.read',
    'companies.write',
    'marketplace.review',
    'dashboard.view',
    'connector-registry.read',
  ],
  COMERCIAL: ['companies.read', 'companies.write', 'billing.manage', 'dashboard.view'],
  DEVOPS: [
    'runtime.read',
    'runtime.restart',
    'runtime.update',
    'runtime.token',
    'dashboard.view',
    'connector-registry.read',
    'runtime-registration.read',
    'runtime-registration.write',
    'runtime-registration.delete',
    'connector-management.read',
    'connector-management.write',
    'job-orchestration.read',
    'job-orchestration.write',
    'message-delivery.read',
    'message-delivery.write',
    'erp-connectivity.read',
    'erp-connectivity.write',
    'runtime-connector-execution.read',
    'runtime-connector-execution.write',
    'erp-metadata.read',
    'erp-metadata.write',
    'semantic-mapping.read',
    'semantic-mapping.write',
  ],
  AUDITOR: [
    'companies.read',
    'runtime.read',
    'audit.read',
    'dashboard.view',
    'connector-registry.read',
    'runtime-registration.read',
    'connector-management.read',
    'job-orchestration.read',
    'message-delivery.read',
    'erp-connectivity.read',
    'runtime-connector-execution.read',
    'erp-metadata.read',
    'semantic-mapping.read',
  ],
};

export function buildPermissionRecords(): Permission[] {
  return PERMISSION_CATALOG.map((p) => ({
    id: permissionKey(p.resource, p.action),
    resource: p.resource,
    action: p.action,
    description: p.description,
  }));
}
