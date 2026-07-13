import { describe, it, expect } from 'vitest';
import { hasRole, can, canAll, canAny, isSectionVisible, type Permission } from '@/lib/rbac';
import type { UserRole } from '@/types/index';

describe('hasRole', () => {
  it('SUPER_ADMIN has all roles', () => {
    const roles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'READ_ONLY'];
    roles.forEach((r) => expect(hasRole('SUPER_ADMIN', r)).toBe(true));
  });
  it('READ_ONLY only has READ_ONLY', () => {
    expect(hasRole('READ_ONLY', 'READ_ONLY')).toBe(true);
    expect(hasRole('READ_ONLY', 'OPERATOR')).toBe(false);
    expect(hasRole('READ_ONLY', 'ADMIN')).toBe(false);
    expect(hasRole('READ_ONLY', 'SUPER_ADMIN')).toBe(false);
  });
  it('OPERATOR has OPERATOR and READ_ONLY', () => {
    expect(hasRole('OPERATOR', 'OPERATOR')).toBe(true);
    expect(hasRole('OPERATOR', 'READ_ONLY')).toBe(true);
    expect(hasRole('OPERATOR', 'ADMIN')).toBe(false);
  });
  it('ADMIN has ADMIN, OPERATOR, READ_ONLY', () => {
    expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
    expect(hasRole('ADMIN', 'OPERATOR')).toBe(true);
    expect(hasRole('ADMIN', 'READ_ONLY')).toBe(true);
    expect(hasRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
  });
});

describe('can', () => {
  it('READ_ONLY can read but not write', () => {
    expect(can('READ_ONLY', 'connectors:read')).toBe(true);
    expect(can('READ_ONLY', 'connectors:write')).toBe(false);
    expect(can('READ_ONLY', 'connectors:lifecycle')).toBe(false);
    expect(can('READ_ONLY', 'health:read')).toBe(true);
    expect(can('READ_ONLY', 'logs:read')).toBe(true);
    expect(can('READ_ONLY', 'logs:export')).toBe(false);
  });
  it('OPERATOR can run sync and lifecycle', () => {
    expect(can('OPERATOR', 'sync:run')).toBe(true);
    expect(can('OPERATOR', 'sync:cancel')).toBe(true);
    expect(can('OPERATOR', 'connectors:lifecycle')).toBe(true);
    expect(can('OPERATOR', 'connectors:write')).toBe(false);
    expect(can('OPERATOR', 'settings:read')).toBe(false);
    expect(can('OPERATOR', 'users:read')).toBe(false);
  });
  it('ADMIN can manage settings and users', () => {
    expect(can('ADMIN', 'settings:read')).toBe(true);
    expect(can('ADMIN', 'settings:write')).toBe(true);
    expect(can('ADMIN', 'users:read')).toBe(true);
    expect(can('ADMIN', 'users:write')).toBe(true);
    expect(can('ADMIN', 'users:delete')).toBe(false);
  });
  it('SUPER_ADMIN can delete users', () => {
    expect(can('SUPER_ADMIN', 'users:delete')).toBe(true);
  });
});

describe('canAll', () => {
  it('returns true when user has all permissions', () => {
    const perms: Permission[] = ['connectors:read', 'agents:read', 'databases:read'];
    expect(canAll('READ_ONLY', perms)).toBe(true);
  });
  it('returns false when user lacks any permission', () => {
    const perms: Permission[] = ['connectors:read', 'connectors:write'];
    expect(canAll('READ_ONLY', perms)).toBe(false);
  });
  it('returns true for empty array', () => {
    expect(canAll('READ_ONLY', [])).toBe(true);
  });
});

describe('canAny', () => {
  it('returns true when user has at least one', () => {
    const perms: Permission[] = ['connectors:write', 'connectors:read'];
    expect(canAny('READ_ONLY', perms)).toBe(true);
  });
  it('returns false when user has none', () => {
    const perms: Permission[] = ['connectors:write', 'settings:read'];
    expect(canAny('READ_ONLY', perms)).toBe(false);
  });
  it('returns false for empty array', () => {
    expect(canAny('READ_ONLY', [])).toBe(false);
  });
});

describe('isSectionVisible', () => {
  it('dashboard always visible', () => {
    expect(isSectionVisible('READ_ONLY', 'dashboard')).toBe(true);
    expect(isSectionVisible('READ_ONLY', 'unknown-section')).toBe(true);
  });
  it('settings hidden from READ_ONLY and OPERATOR', () => {
    expect(isSectionVisible('READ_ONLY', 'settings')).toBe(false);
    expect(isSectionVisible('OPERATOR', 'settings')).toBe(false);
    expect(isSectionVisible('ADMIN', 'settings')).toBe(true);
  });
  it('connectors visible to READ_ONLY', () => {
    expect(isSectionVisible('READ_ONLY', 'connectors')).toBe(true);
  });
  it('logs visible to READ_ONLY', () => {
    expect(isSectionVisible('READ_ONLY', 'logs')).toBe(true);
  });
  it('users hidden from READ_ONLY and OPERATOR', () => {
    expect(isSectionVisible('READ_ONLY', 'users')).toBe(false);
    expect(isSectionVisible('OPERATOR', 'users')).toBe(false);
    expect(isSectionVisible('ADMIN', 'users')).toBe(true);
  });
});
