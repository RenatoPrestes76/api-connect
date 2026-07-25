import type {
  OrgRole,
  PortalPermission,
  PortalPermissionAction,
  PortalPermissionKey,
  PortalPermissionResource,
} from './types.js';

export const PERMISSION_CATALOG: Array<{
  resource: PortalPermissionResource;
  action: PortalPermissionAction;
  description: string;
}> = [
  { resource: 'organization', action: 'read', description: 'View organization details' },
  { resource: 'organization', action: 'write', description: 'Edit organization details' },
  { resource: 'organization', action: 'delete', description: 'Delete the organization' },
  { resource: 'environments', action: 'read', description: 'View environments' },
  { resource: 'environments', action: 'write', description: 'Create and edit environments' },
  { resource: 'environments', action: 'delete', description: 'Delete environments' },
  { resource: 'org-users', action: 'read', description: 'View organization members' },
  { resource: 'org-users', action: 'manage', description: 'Change member roles, remove members' },
  { resource: 'invites', action: 'read', description: 'View pending invites' },
  { resource: 'invites', action: 'write', description: 'Invite new members' },
  { resource: 'audit', action: 'read', description: 'Read the organization audit log' },
  { resource: 'api-keys', action: 'read', description: 'View API keys' },
  {
    resource: 'api-keys',
    action: 'manage',
    description: 'Create, revoke, and regenerate API keys',
  },
  { resource: 'rate-limits', action: 'read', description: 'View rate limit rules' },
  { resource: 'rate-limits', action: 'manage', description: 'Configure rate limit rules' },
  { resource: 'gateway-settings', action: 'read', description: 'View gateway settings' },
  { resource: 'gateway-settings', action: 'manage', description: 'Configure gateway settings' },
  { resource: 'api-logs', action: 'read', description: 'Read the centralized API request log' },
];

export function permissionKey(
  resource: PortalPermissionResource,
  action: PortalPermissionAction
): PortalPermissionKey {
  return `${resource}.${action}`;
}

/** Default permission grants per organization role. */
export const ROLE_PERMISSIONS: Record<OrgRole, PortalPermissionKey[]> = {
  OWNER: PERMISSION_CATALOG.map((p) => permissionKey(p.resource, p.action)),
  ADMINISTRATOR: PERMISSION_CATALOG.filter(
    (p) => !(p.resource === 'organization' && p.action === 'delete')
  ).map((p) => permissionKey(p.resource, p.action)),
  DEVELOPER: [
    'organization.read',
    'environments.read',
    'environments.write',
    'org-users.read',
    'invites.read',
    'api-keys.read',
    'api-keys.manage',
    'rate-limits.read',
    'gateway-settings.read',
    'api-logs.read',
  ],
  OPERATOR: [
    'organization.read',
    'environments.read',
    'environments.write',
    'org-users.read',
    'api-keys.read',
    'rate-limits.read',
    'gateway-settings.read',
    'api-logs.read',
  ],
  VIEWER: [
    'organization.read',
    'environments.read',
    'org-users.read',
    'invites.read',
    'audit.read',
    'api-keys.read',
    'rate-limits.read',
    'gateway-settings.read',
    'api-logs.read',
  ],
};

export function buildPermissionRecords(): PortalPermission[] {
  return PERMISSION_CATALOG.map((p) => ({
    id: permissionKey(p.resource, p.action),
    resource: p.resource,
    action: p.action,
    description: p.description,
  }));
}
