import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type {
  AdminRole,
  AdminRoleName,
  AdminUserRecord,
  AdminUserDTO,
  AdminSessionRecord,
  LoginAttemptRecord,
  AdminAuditEntry,
  AdminAuditAction,
  Permission,
  PermissionKey,
} from './types.js';
import { SYSTEM_ROLES, ROLE_PERMISSIONS, buildPermissionRecords } from './permissions.js';
import { REFRESH_TOKEN_TTL_SECONDS } from './jwt.js';

const SEED_ADMIN_EMAIL = 'admin@atlasconnect.com.br';
/**
 * Temporary bootstrap password — the seeded SUPER_ADMIN is created with
 * mustChangePassword=true, so this value can never be used past first login.
 * Do not reuse this value in production.
 */
const SEED_ADMIN_TEMP_PASSWORD = 'TrocarNoPrimeiroLogin!';

let _instance: AdminIdentityStore | null = null;

export class AdminIdentityStore {
  private roles: AdminRole[] = [];
  private permissions: Permission[] = [];
  private rolePermissions: Map<string, Set<PermissionKey>> = new Map();
  private users: AdminUserRecord[] = [];
  private sessions: AdminSessionRecord[] = [];
  private loginAttempts: LoginAttemptRecord[] = [];
  private auditLog: AdminAuditEntry[] = [];

  private constructor() {
    this.seedRolesAndPermissions();
    this.seedSuperAdmin();
  }

  static getInstance(): AdminIdentityStore {
    if (!_instance) _instance = new AdminIdentityStore();
    return _instance;
  }

  // ─── Seed ───────────────────────────────────────────────────────────────

  private seedRolesAndPermissions(): void {
    this.permissions = buildPermissionRecords();
    this.roles = SYSTEM_ROLES.map((r) => ({
      id: `role-${r.name.toLowerCase()}`,
      name: r.name,
      description: r.description,
      isSystem: true,
    }));
    for (const role of this.roles) {
      this.rolePermissions.set(role.id, new Set(ROLE_PERMISSIONS[role.name]));
    }
  }

  private seedSuperAdmin(): void {
    const role = this.getRoleByName('SUPER_ADMIN');
    if (!role) throw new Error('SUPER_ADMIN role failed to seed');
    const now = new Date().toISOString();
    this.users.push({
      id: randomUUID(),
      name: 'Atlas Super Admin',
      email: SEED_ADMIN_EMAIL,
      // Synchronous hash is acceptable here — this runs once at process boot, not per-request.
      passwordHash: bcrypt.hashSync(SEED_ADMIN_TEMP_PASSWORD, 12),
      roleId: role.id,
      status: 'active',
      mfaEnabled: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ─── Roles & Permissions ────────────────────────────────────────────────

  getAllRoles(): AdminRole[] {
    return [...this.roles];
  }

  getAllPermissions(): Permission[] {
    return [...this.permissions];
  }

  getRoleById(id: string): AdminRole | undefined {
    return this.roles.find((r) => r.id === id);
  }

  getRoleByName(name: AdminRoleName): AdminRole | undefined {
    return this.roles.find((r) => r.name === name);
  }

  getPermissionsForRole(roleId: string): PermissionKey[] {
    return [...(this.rolePermissions.get(roleId) ?? new Set())];
  }

  // ─── Users ──────────────────────────────────────────────────────────────

  findUserByEmail(email: string): AdminUserRecord | undefined {
    const normalized = email.toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized);
  }

  findUserById(id: string): AdminUserRecord | undefined {
    return this.users.find((u) => u.id === id);
  }

  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    roleId: string;
    mustChangePassword?: boolean;
  }): AdminUserRecord {
    const now = new Date().toISOString();
    const user: AdminUserRecord = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      roleId: input.roleId,
      status: 'active',
      mfaEnabled: false,
      mustChangePassword: input.mustChangePassword ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return user;
  }

  toDTO(user: AdminUserRecord): AdminUserDTO {
    const role = this.getRoleById(user.roleId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: role?.name ?? 'AUDITOR',
      permissions: this.getPermissionsForRole(user.roleId),
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  recordLogin(userId: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.lastLogin = new Date().toISOString();
    user.updatedAt = user.lastLogin;
  }

  setPassword(userId: string, passwordHash: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
  }

  // ─── Sessions (refresh tokens) ────────────────────────────────────────────

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  createSession(
    adminUserId: string,
    refreshToken: string,
    ip: string,
    userAgent: string
  ): AdminSessionRecord {
    const now = new Date();
    const session: AdminSessionRecord = {
      id: randomUUID(),
      adminUserId,
      refreshTokenHash: this.hashToken(refreshToken),
      ip,
      userAgent,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
      createdAt: now.toISOString(),
    };
    this.sessions.push(session);
    return session;
  }

  /** Returns the active (non-revoked, non-expired) session for a refresh token, if any. */
  findActiveSessionByRefreshToken(refreshToken: string): AdminSessionRecord | undefined {
    const hash = this.hashToken(refreshToken);
    const session = this.sessions.find((s) => s.refreshTokenHash === hash);
    if (!session) return undefined;
    if (session.revokedAt) return undefined;
    if (new Date(session.expiresAt).getTime() < Date.now()) return undefined;
    return session;
  }

  revokeSession(sessionId: string): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session && !session.revokedAt) session.revokedAt = new Date().toISOString();
  }

  revokeSessionByRefreshToken(refreshToken: string): boolean {
    const hash = this.hashToken(refreshToken);
    const session = this.sessions.find((s) => s.refreshTokenHash === hash && !s.revokedAt);
    if (!session) return false;
    session.revokedAt = new Date().toISOString();
    return true;
  }

  // ─── Login attempts ─────────────────────────────────────────────────────

  recordLoginAttempt(email: string, ip: string, success: boolean): void {
    this.loginAttempts.push({
      id: randomUUID(),
      email: email.toLowerCase(),
      ip,
      success,
      createdAt: new Date().toISOString(),
    });
  }

  getLoginAttempts(email: string): LoginAttemptRecord[] {
    const normalized = email.toLowerCase();
    return this.loginAttempts.filter((a) => a.email === normalized);
  }

  // ─── Audit log ──────────────────────────────────────────────────────────

  recordAudit(entry: {
    action: AdminAuditAction;
    actorId?: string;
    actorEmail: string;
    target?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }): AdminAuditEntry {
    const record: AdminAuditEntry = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this.auditLog.push(record);
    return record;
  }

  getAuditLog(filters: { limit?: number; action?: AdminAuditAction } = {}): AdminAuditEntry[] {
    let list = [...this.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.action) list = list.filter((e) => e.action === filters.action);
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }
}

export const adminIdentityStore = AdminIdentityStore.getInstance();
