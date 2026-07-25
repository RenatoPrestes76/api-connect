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
  ],
  OPERATOR: ['organization.read', 'environments.read', 'environments.write', 'org-users.read'],
  VIEWER: [
    'organization.read',
    'environments.read',
    'org-users.read',
    'invites.read',
    'audit.read',
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
