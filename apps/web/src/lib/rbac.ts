import type { UserRole } from '@/types/index';

// ─── Role hierarchy ───────────────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  ADMIN:       3,
  OPERATOR:    2,
  READ_ONLY:   1,
};

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

// ─── Permission definitions ───────────────────────────────────────────────────

export type Permission =
  | 'connectors:read'
  | 'connectors:write'
  | 'connectors:lifecycle'   // start / stop / restart
  | 'agents:read'
  | 'agents:write'
  | 'agents:disable'
  | 'databases:read'
  | 'sync:read'
  | 'sync:run'
  | 'sync:cancel'
  | 'discovery:read'
  | 'discovery:run'
  | 'health:read'
  | 'logs:read'
  | 'logs:export'
  | 'settings:read'
  | 'settings:write'
  | 'users:read'
  | 'users:write'
  | 'users:delete';

const PERMISSIONS: Record<Permission, UserRole> = {
  'connectors:read':      'READ_ONLY',
  'connectors:write':     'ADMIN',
  'connectors:lifecycle': 'OPERATOR',
  'agents:read':          'READ_ONLY',
  'agents:write':         'ADMIN',
  'agents:disable':       'ADMIN',
  'databases:read':       'READ_ONLY',
  'sync:read':            'READ_ONLY',
  'sync:run':             'OPERATOR',
  'sync:cancel':          'OPERATOR',
  'discovery:read':       'READ_ONLY',
  'discovery:run':        'OPERATOR',
  'health:read':          'READ_ONLY',
  'logs:read':            'READ_ONLY',
  'logs:export':          'OPERATOR',
  'settings:read':        'ADMIN',
  'settings:write':       'ADMIN',
  'users:read':           'ADMIN',
  'users:write':          'ADMIN',
  'users:delete':         'SUPER_ADMIN',
};

export function can(userRole: UserRole, permission: Permission): boolean {
  const required = PERMISSIONS[permission];
  return hasRole(userRole, required);
}

export function canAll(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(userRole, p));
}

export function canAny(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(userRole, p));
}

// ─── Permission groups ────────────────────────────────────────────────────────

export const SECTION_PERMISSIONS: Partial<Record<string, Permission>> = {
  connectors: 'connectors:read',
  agents:     'agents:read',
  databases:  'databases:read',
  discovery:  'discovery:read',
  sync:       'sync:read',
  health:     'health:read',
  logs:       'logs:read',
  settings:   'settings:read',
  users:      'users:read',
};

export function isSectionVisible(userRole: UserRole, section: string): boolean {
  const perm = SECTION_PERMISSIONS[section];
  if (!perm) return true; // dashboard always visible
  return can(userRole, perm);
}
