import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { startTestServer, get, post, bearer, type TestServer } from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

const SEED_EMAIL = 'admin@atlasconnect.com.br';
const SEED_PASSWORD = 'TrocarNoPrimeiroLogin!';
const DEV_JWT_SECRET = new TextEncoder().encode('atlas-admin-dev-secret-change-in-prod');

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

const G = (path: string, headers?: Record<string, string>) => get(srv.baseUrl, path, headers);
const P = (path: string, data?: unknown, headers?: Record<string, string>) =>
  post(srv.baseUrl, path, data, headers);

async function loginAsSeedAdmin(
  ip = '10.0.0.1'
): Promise<{ accessToken: string; refreshToken: string }> {
  const { body } = await P(
    '/admin/auth/login',
    { email: SEED_EMAIL, password: SEED_PASSWORD },
    { 'x-forwarded-for': ip }
  );
  return body as { accessToken: string; refreshToken: string };
}

async function craftExpiredToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'SUPER_ADMIN', name: 'x', email: SEED_EMAIL })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('some-user-id')
    .setIssuedAt(now - 1000)
    .setExpirationTime(now - 10)
    .sign(DEV_JWT_SECRET);
}

// ─── Login ──────────────────────────────────────────────────────────────────

describe('POST /admin/auth/login', () => {
  it('returns 400 MISSING_FIELDS when email or password is absent', async () => {
    const { status, body } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL },
      { 'x-forwarded-for': '10.0.1.1' }
    );
    expect(status).toBe(400);
    expect((body as any).error.code).toBe('MISSING_FIELDS');
  });

  it('returns 401 INVALID_CREDENTIALS for an unknown email', async () => {
    const { status, body } = await P(
      '/admin/auth/login',
      { email: 'nobody@atlasconnect.com.br', password: 'whatever123' },
      { 'x-forwarded-for': '10.0.1.2' }
    );
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for a wrong password', async () => {
    const { status, body } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: 'wrong-password' },
      { 'x-forwarded-for': '10.0.1.3' }
    );
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with the seeded SUPER_ADMIN and returns tokens + mustChangePassword=true', async () => {
    const { status, body } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: SEED_PASSWORD },
      { 'x-forwarded-for': '10.0.1.4' }
    );
    expect(status).toBe(200);
    const b = body as any;
    expect(b.accessToken).toBeTruthy();
    expect(b.refreshToken).toBeTruthy();
    expect(b.expiresIn).toBe(900);
    expect(b.mustChangePassword).toBe(true);
  });

  it('rejects login for a disabled account', async () => {
    const role = adminIdentityStore.getRoleByName('DEVOPS')!;
    const user = adminIdentityStore.createUser({
      name: 'Disabled User',
      email: 'disabled@atlasconnect.com.br',
      passwordHash: await hashPassword('SomePassword123!'),
      roleId: role.id,
    });
    user.status = 'disabled';

    const { status, body } = await P(
      '/admin/auth/login',
      { email: user.email, password: 'SomePassword123!' },
      { 'x-forwarded-for': '10.0.1.5' }
    );
    expect(status).toBe(403);
    expect((body as any).error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rejects login for a suspended account', async () => {
    const role = adminIdentityStore.getRoleByName('DEVOPS')!;
    const user = adminIdentityStore.createUser({
      name: 'Suspended User',
      email: 'suspended@atlasconnect.com.br',
      passwordHash: await hashPassword('SomePassword123!'),
      roleId: role.id,
    });
    user.status = 'suspended';

    const { status, body } = await P(
      '/admin/auth/login',
      { email: user.email, password: 'SomePassword123!' },
      { 'x-forwarded-for': '10.0.1.6' }
    );
    expect(status).toBe(403);
    expect((body as any).error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

// ─── Rate limiting / lockout ──────────────────────────────────────────────────

describe('Login rate limiting', () => {
  it('locks the account out after 5 failed attempts within 15 minutes', async () => {
    const ip = '10.0.2.1';
    for (let i = 0; i < 5; i++) {
      const { status } = await P(
        '/admin/auth/login',
        { email: SEED_EMAIL, password: 'wrong' },
        { 'x-forwarded-for': ip }
      );
      expect(status).toBe(401);
    }
    const { status, body } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: 'wrong' },
      { 'x-forwarded-for': ip }
    );
    expect(status).toBe(423);
    expect((body as any).error.code).toBe('ACCOUNT_LOCKED');
  });

  it('still locks out even with the correct password once the threshold is hit', async () => {
    const ip = '10.0.2.1'; // same IP as previous test — already locked
    const { status, body } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: SEED_PASSWORD },
      { 'x-forwarded-for': ip }
    );
    expect(status).toBe(423);
    expect((body as any).error.code).toBe('ACCOUNT_LOCKED');
  });

  it('a different IP is not affected by another IP’s lockout', async () => {
    const { status } = await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: SEED_PASSWORD },
      { 'x-forwarded-for': '10.0.2.99' }
    );
    expect(status).toBe(200);
  });
});

// ─── /me ────────────────────────────────────────────────────────────────────

describe('GET /admin/auth/me', () => {
  it('returns 401 UNAUTHENTICATED with no Authorization header', async () => {
    const { status, body } = await G('/admin/auth/me');
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 INVALID_SESSION for a garbage token', async () => {
    const { status, body } = await G('/admin/auth/me', bearer('not-a-real-token'));
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_SESSION');
  });

  it('returns 401 INVALID_SESSION for an expired token', async () => {
    const expired = await craftExpiredToken();
    const { status, body } = await G('/admin/auth/me', bearer(expired));
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_SESSION');
  });

  it('returns the profile, role, and permissions for a valid token', async () => {
    const { accessToken } = await loginAsSeedAdmin('10.0.3.1');
    const { status, body } = await G('/admin/auth/me', bearer(accessToken));
    expect(status).toBe(200);
    const b = body as any;
    expect(b.email).toBe(SEED_EMAIL);
    expect(b.role).toBe('SUPER_ADMIN');
    expect(b.permissions).toContain('audit.read');
    expect(b.permissions).toContain('companies.delete');
  });
});

// ─── Logout ─────────────────────────────────────────────────────────────────

describe('POST /admin/auth/logout', () => {
  it('returns 400 when refreshToken is missing', async () => {
    const { status } = await P('/admin/auth/logout', {});
    expect(status).toBe(400);
  });

  it('invalidates the refresh token so it cannot be reused for a refresh', async () => {
    const { refreshToken } = await loginAsSeedAdmin('10.0.4.1');

    const logoutRes = await P('/admin/auth/logout', { refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await P('/admin/auth/refresh', { refreshToken });
    expect(refreshRes.status).toBe(401);
    expect((refreshRes.body as any).error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

// ─── Refresh ────────────────────────────────────────────────────────────────

describe('POST /admin/auth/refresh', () => {
  it('returns 400 when refreshToken is missing', async () => {
    const { status } = await P('/admin/auth/refresh', {});
    expect(status).toBe(400);
  });

  it('returns 401 for an unknown refresh token', async () => {
    const { status, body } = await P('/admin/auth/refresh', {
      refreshToken: 'not-a-real-refresh-token',
    });
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('issues a new token pair and rotates the refresh token (the old one stops working)', async () => {
    const { refreshToken: oldRefresh } = await loginAsSeedAdmin('10.0.5.1');

    const { status, body } = await P('/admin/auth/refresh', { refreshToken: oldRefresh });
    expect(status).toBe(200);
    const b = body as any;
    expect(b.accessToken).toBeTruthy();
    expect(b.refreshToken).toBeTruthy();
    expect(b.refreshToken).not.toBe(oldRefresh);

    // New access token works
    const meRes = await G('/admin/auth/me', bearer(b.accessToken));
    expect(meRes.status).toBe(200);

    // Old refresh token is now dead (rotation)
    const reuseRes = await P('/admin/auth/refresh', { refreshToken: oldRefresh });
    expect(reuseRes.status).toBe(401);
  });
});

// ─── RBAC / permissions ───────────────────────────────────────────────────────

describe('RBAC — GET /admin/audit-log', () => {
  it('allows a SUPER_ADMIN (has audit.read)', async () => {
    const { accessToken } = await loginAsSeedAdmin('10.0.6.1');
    const { status } = await G('/admin/audit-log', bearer(accessToken));
    expect(status).toBe(200);
  });

  it('forbids a role without audit.read (e.g. a fresh COMERCIAL user)', async () => {
    const role = adminIdentityStore.getRoleByName('COMERCIAL')!;
    expect(adminIdentityStore.getPermissionsForRole(role.id)).not.toContain('audit.read');

    const password = 'ComercialPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Comercial User',
      email: 'comercial@atlasconnect.com.br',
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });

    const { body: loginBody } = await P(
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.0.6.2' }
    );
    const { accessToken } = loginBody as { accessToken: string };

    const { status, body } = await G('/admin/audit-log', bearer(accessToken));
    expect(status).toBe(403);
    expect((body as any).error.code).toBe('FORBIDDEN');
  });
});

// ─── Auditoria ──────────────────────────────────────────────────────────────

describe('Audit log records identity events', () => {
  it('records LOGIN, LOGIN_FAILED, and LOGOUT entries', async () => {
    const ip = '10.0.7.1';
    await P(
      '/admin/auth/login',
      { email: SEED_EMAIL, password: 'wrong' },
      { 'x-forwarded-for': ip }
    );
    const { accessToken, refreshToken } = await loginAsSeedAdmin(ip);
    await P('/admin/auth/logout', { refreshToken });

    const { body } = await G('/admin/audit-log?limit=200', bearer(accessToken));
    const entries = (body as any).entries as Array<{ action: string; actorEmail: string }>;

    expect(entries.some((e) => e.action === 'LOGIN' && e.actorEmail === SEED_EMAIL)).toBe(true);
    expect(entries.some((e) => e.action === 'LOGIN_FAILED' && e.actorEmail === SEED_EMAIL)).toBe(
      true
    );
    expect(entries.some((e) => e.action === 'LOGOUT' && e.actorEmail === SEED_EMAIL)).toBe(true);
  });
});

// ─── Change password ────────────────────────────────────────────────────────

describe('POST /admin/auth/change-password', () => {
  it('requires authentication', async () => {
    const { status } = await P('/admin/auth/change-password', {
      currentPassword: 'a',
      newPassword: 'b',
    });
    expect(status).toBe(401);
  });

  it('rejects an incorrect current password', async () => {
    const { accessToken } = await loginAsSeedAdmin('10.0.8.1');
    const { status, body } = await P(
      '/admin/auth/change-password',
      { currentPassword: 'wrong', newPassword: 'NewPassword123!' },
      bearer(accessToken)
    );
    expect(status).toBe(401);
    expect((body as any).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('changes the password and clears mustChangePassword', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const oldPassword = 'OldPassword123!';
    const user = adminIdentityStore.createUser({
      name: 'Change PW User',
      email: 'changepw@atlasconnect.com.br',
      passwordHash: await hashPassword(oldPassword),
      roleId: role.id,
      mustChangePassword: true,
    });

    const { body: loginBody } = await P(
      '/admin/auth/login',
      { email: user.email, password: oldPassword },
      { 'x-forwarded-for': '10.0.8.2' }
    );
    const { accessToken } = loginBody as { accessToken: string; mustChangePassword: boolean };
    expect((loginBody as any).mustChangePassword).toBe(true);

    const changeRes = await P(
      '/admin/auth/change-password',
      { currentPassword: oldPassword, newPassword: 'NewPassword456!' },
      bearer(accessToken)
    );
    expect(changeRes.status).toBe(200);

    const { body: secondLoginBody } = await P(
      '/admin/auth/login',
      { email: user.email, password: 'NewPassword456!' },
      { 'x-forwarded-for': '10.0.8.3' }
    );
    expect((secondLoginBody as any).mustChangePassword).toBe(false);
  });
});
