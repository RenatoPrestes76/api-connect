import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createLogger } from '@seltriva/logger';
import { prisma } from '../../services/prisma.js';
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

const SEED_ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@atlasconnect.com.br';
/**
 * Temporary bootstrap password — the seeded SUPER_ADMIN is created with
 * mustChangePassword=true, so this value can never be used past first login.
 * Do not reuse this value in production; override via SEED_ADMIN_PASSWORD.
 */
const SEED_ADMIN_TEMP_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'root102030';

/**
 * Vitest runs test files in parallel worker processes by default, and this
 * whole suite already shares one real Postgres instance across all of them
 * (Sprint 46.19 onward — no in-memory DB fallback). Persisting the admin
 * user under a fixed, well-known email would turn it into GLOBAL shared
 * mutable state across every test file/worker, exactly the kind of
 * cross-test interference the pre-existing (pure in-memory, one isolated
 * copy per process) design never had to worry about. Tests don't exercise
 * restart-durability at all, so there's nothing to gain from persisting
 * there — keep the exact previous in-memory-only behavior under Vitest,
 * persist for real everywhere else (including a real local `pnpm dev`).
 */
const PERSIST_ADMIN_IDENTITY = !process.env['VITEST'];

const logger = createLogger('admin-identity');

let _instance: AdminIdentityStore | null = null;

export class AdminIdentityStore {
  private roles: AdminRole[] = [];
  private permissions: Permission[] = [];
  private rolePermissions: Map<string, Set<PermissionKey>> = new Map();
  private users: AdminUserRecord[] = [];
  private sessions: AdminSessionRecord[] = [];
  private loginAttempts: LoginAttemptRecord[] = [];
  private auditLog: AdminAuditEntry[] = [];

  /**
   * Resolves once the super admin has been loaded from (or written to) the
   * database — see seedSuperAdmin()'s own header comment for why this
   * exists. Callers that need the identity to be fully ready before their
   * first request (index.ts's boot sequence) await this.
   */
  readonly ready: Promise<void>;

  private constructor() {
    this.seedRolesAndPermissions();
    this.ready = this.seedSuperAdmin().catch((err) => {
      logger.error('Admin identity seed failed — falling back to a transient in-memory admin', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
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

  /**
   * ATLAS — admin login recovery incident. Roles/permissions above stay
   * in-memory (deterministic IDs from constants, never mutated at runtime —
   * nothing to persist), but the admin USER used to be recreated from
   * scratch on every process boot too, with a brand-new random UUID and the
   * seed password. That's fine for a long-running process, but this repo's
   * apps/api can restart at any time (a redeploy, a crash, or — on a free
   * hosting plan — simply going idle and spinning back up), and every
   * restart silently invalidated every existing session (the JWT's `sub`
   * no longer matched any in-memory user) and reverted any password change
   * back to the seed default. Fixed by loading the real admin's id/hash/
   * status from `AtlasAdminUser` (a table that already existed in the
   * Prisma schema but was never wired up) if one exists, and only creating
   * a fresh row — with a real, persisted id — when it doesn't. The roles
   * still need a matching DB row for AtlasAdminUser.roleId's foreign key
   * to resolve, so those get upserted here too, idempotently.
   */
  private async seedSuperAdmin(): Promise<void> {
    if (!PERSIST_ADMIN_IDENTITY) {
      const role = this.getRoleByName('SUPER_ADMIN');
      if (!role) throw new Error('SUPER_ADMIN role failed to seed');
      const now = new Date().toISOString();
      this.users.push({
        id: randomUUID(),
        name: 'Atlas Super Admin',
        email: SEED_ADMIN_EMAIL,
        passwordHash: bcrypt.hashSync(SEED_ADMIN_TEMP_PASSWORD, 12),
        roleId: role.id,
        status: 'active',
        mfaEnabled: false,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    for (const role of this.roles) {
      await prisma.atlasAdminRole.upsert({
        where: { id: role.id },
        update: {},
        create: { id: role.id, name: role.name, description: role.description, isSystem: true },
      });
    }

    const role = this.getRoleByName('SUPER_ADMIN');
    if (!role) throw new Error('SUPER_ADMIN role failed to seed');

    const existing = await prisma.atlasAdminUser.findUnique({ where: { email: SEED_ADMIN_EMAIL } });
    if (existing) {
      // A real admin already exists — including one that already changed
      // its own password. Load it as-is; never overwrite it with the seed
      // default.
      this.users.push({
        id: existing.id,
        name: existing.name,
        email: existing.email,
        passwordHash: existing.passwordHash,
        roleId: existing.roleId,
        status: existing.status as AdminUserRecord['status'],
        mfaEnabled: existing.mfaEnabled,
        mustChangePassword: existing.mustChangePassword,
        lastLogin: existing.lastLogin?.toISOString(),
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      });
      return;
    }

    const now = new Date().toISOString();
    // Synchronous hash is acceptable here — this runs once at process boot, not per-request.
    const passwordHash = bcrypt.hashSync(SEED_ADMIN_TEMP_PASSWORD, 12);
    const created = await prisma.atlasAdminUser.create({
      data: {
        name: 'Atlas Super Admin',
        email: SEED_ADMIN_EMAIL,
        passwordHash,
        roleId: role.id,
        status: 'active',
        mfaEnabled: false,
        mustChangePassword: true,
      },
    });
    this.users.push({
      id: created.id,
      name: created.name,
      email: created.email,
      passwordHash: created.passwordHash,
      roleId: created.roleId,
      status: created.status as AdminUserRecord['status'],
      mfaEnabled: created.mfaEnabled,
      mustChangePassword: created.mustChangePassword,
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
    if (!PERSIST_ADMIN_IDENTITY) return;
    // Write-through, best-effort — the in-memory update above is what the
    // rest of this request cycle actually relies on; a failed DB write
    // here shouldn't fail the login itself.
    prisma.atlasAdminUser
      .update({ where: { id: userId }, data: { lastLogin: new Date() } })
      .catch((err: unknown) => {
        logger.error('Failed to persist admin lastLogin', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  setPassword(userId: string, passwordHash: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    if (!PERSIST_ADMIN_IDENTITY) return;
    // Write-through, best-effort — see recordLogin()'s comment. A failed
    // write here is the one case genuinely worth surfacing (the whole
    // point of this method is to survive a restart), so this logs loudly,
    // but still doesn't throw: the in-memory password change already
    // succeeded and this request should still report success to the
    // caller — a transient DB hiccup shouldn't make a real password
    // change look like it failed.
    prisma.atlasAdminUser
      .update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } })
      .catch((err: unknown) => {
        logger.error(
          'Failed to persist admin password change — it WILL revert on the next restart',
          { userId, error: err instanceof Error ? err.message : String(err) }
        );
      });
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

  /**
   * Every Control Plane write handler calls this AFTER its own domain write
   * already succeeded and been returned/committed — it is deliberately
   * exception-safe so a failure here (audit is secondary, observational
   * data) can never surface as a 500 for an action that actually went
   * through, which would otherwise make the client believe the action
   * failed and potentially retry/duplicate it.
   */
  recordAudit(entry: {
    action: AdminAuditAction;
    actorId?: string;
    actorEmail: string;
    target?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }): AdminAuditEntry | undefined {
    try {
      const record: AdminAuditEntry = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...entry,
      };
      this.auditLog.push(record);
      return record;
    } catch (err) {
      logger.error('Failed to record audit entry', {
        action: entry.action,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  getAuditLog(filters: { limit?: number; action?: AdminAuditAction } = {}): AdminAuditEntry[] {
    let list = [...this.auditLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.action) list = list.filter((e) => e.action === filters.action);
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }
}

export const adminIdentityStore = AdminIdentityStore.getInstance();
