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
  ],
  SUPORTE: ['companies.read', 'runtime.read', 'marketplace.review', 'audit.read', 'dashboard.view'],
  CUSTOMER_SUCCESS: ['companies.read', 'companies.write', 'marketplace.review', 'dashboard.view'],
  COMERCIAL: ['companies.read', 'companies.write', 'billing.manage', 'dashboard.view'],
  DEVOPS: ['runtime.read', 'runtime.restart', 'runtime.update', 'runtime.token', 'dashboard.view'],
  AUDITOR: ['companies.read', 'runtime.read', 'audit.read', 'dashboard.view'],
};

export function buildPermissionRecords(): Permission[] {
  return PERMISSION_CATALOG.map((p) => ({
    id: permissionKey(p.resource, p.action),
    resource: p.resource,
    action: p.action,
    description: p.description,
  }));
}
