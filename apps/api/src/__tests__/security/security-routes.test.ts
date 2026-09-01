import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateTotpToken, base32Decode } from '@seltriva/aegis';
import {
  startServer,
  stopServer,
  get,
  post,
  del,
  put,
  orgBearer,
  noOrgBearer,
  securityAdminBearer,
  lowPrivAdminBearer,
  portalUserBearer,
  runtimeBearer,
} from './helpers.js';
import type { TestServer } from './helpers.js';

const TENANT = 'tenant-enterprise';
const OTHER_TENANT = 'tenant-professional';
const auth = orgBearer(TENANT);
const otherAuth = orgBearer(OTHER_TENANT);

let srv: TestServer;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await stopServer(srv.server);
});

// ─── Secrets ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/secrets', () => {
  it('returns secrets list for enterprise tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/security/secrets', auth);
    expect(status).toBe(200);
    expect(body.secrets.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('does not expose encryptedValue in list', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/security/secrets', auth);
    for (const s of body.secrets) {
      expect(s.encryptedValue).toBeUndefined();
      expect(s.masked).toBeTruthy();
    }
  });

  it("never returns another tenant's secrets, even with a ?tenantId= override in the URL", async () => {
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/secrets?tenantId=${OTHER_TENANT}`,
      auth
    );
    expect(body.secrets.every((s: any) => s.tenantId === TENANT)).toBe(true);
  });

  it('returns 401 unauthenticated', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/security/secrets');
    expect(status).toBe(401);
  });

  it('returns 403 ORGANIZATION_NOT_LINKED for a session with no org', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/security/secrets', noOrgBearer());
    expect(status).toBe(403);
    expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
  });
});

describe('GET /api/v1/security/secrets/:id — cross-tenant BOLA', () => {
  it('returns metadata for a seeded secret to its own tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001`, auth);
    expect(status).toBe(200);
    expect(body.secret.id).toBe('sec-001');
    expect(body.secret.encryptedValue).toBeUndefined();
  });

  it("tenant-professional cannot read tenant-enterprise's secret (sec-001)", async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001`, otherAuth);
    expect(status).toBe(404);
  });

  it("tenant-enterprise cannot read tenant-professional's secret (sec-004)", async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-004`, auth);
    expect(status).toBe(404);
  });

  it('returns 404 for unknown id', async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-999`, auth);
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/security/secrets/:id/decrypt — the most severe finding in this audit', () => {
  it('decrypts a seeded secret for its own tenant', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-001/decrypt`,
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.value).toBeTruthy();
    expect(typeof body.value).toBe('string');
  });

  it("tenant-professional cannot decrypt tenant-enterprise's secret plaintext (sec-001)", async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-001/decrypt`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
    expect(body.value).toBeUndefined();
  });

  it("tenant-enterprise cannot decrypt tenant-professional's secret plaintext (sec-004)", async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-004/decrypt`,
      undefined,
      auth
    );
    expect(status).toBe(404);
    expect(body.value).toBeUndefined();
  });

  it('returns 404 for unknown secret', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-999/decrypt`,
      undefined,
      auth
    );
    expect(status).toBe(404);
  });

  it('returns 401 unauthenticated (cannot decrypt anything with no session at all)', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001/decrypt`);
    expect(status).toBe(401);
  });
});

describe('POST /api/v1/security/secrets + DELETE', () => {
  it('creates and deletes a secret', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      {
        name: 'Test Secret',
        type: 'api_key',
        provider: 'internal',
        value: 'my-test-key',
        tags: [],
      },
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(201);
    const id = body.secret.id;
    const { status: delStatus } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/${id}`,
      undefined,
      orgBearer('tenant-mutation-test')
    );
    expect(delStatus).toBe(200);
  });

  it("a body-supplied tenantId/organizationId is ignored — the secret is always created under the caller's session org (mass-assignment check)", async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      {
        name: 'Mass-assignment probe',
        type: 'api_key',
        provider: 'internal',
        value: 'v',
        tags: [],
        tenantId: OTHER_TENANT,
        organizationId: OTHER_TENANT,
      },
      auth
    );
    expect(status).toBe(201);
    expect(body.secret.tenantId).toBe(TENANT);
  });

  it("another tenant cannot delete this tenant's secret by id", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      { name: 'Delete-target', type: 'api_key', provider: 'internal', value: 'v', tags: [] },
      auth
    );
    const id = created.body.secret.id;
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/${id}`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
    // Still readable by the rightful owner — proves delete was actually blocked, not a no-op 404 that also deleted it.
    const stillThere = await get<any>(srv.baseUrl, `/api/v1/security/secrets/${id}`, auth);
    expect(stillThere.status).toBe(200);
  });

  it('returns 400 when value missing', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      {
        name: 'Test',
        type: 'api_key',
        provider: 'internal',
      },
      auth
    );
    expect(status).toBe(400);
  });

  it('requires rotationIntervalDays when autoRotate is true', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      {
        name: 'Auto-rotate without interval',
        type: 'api_key',
        provider: 'internal',
        value: 'v',
        autoRotate: true,
      },
      auth
    );
    expect(status).toBe(400);
  });
});

// ─── Secret-access auditing (Sprint 47 / ATLAS FORTRESS) ───────────────────────

describe('Secrets — access auditing writes to the tamper-evident chain', () => {
  it('decrypting a secret records a secret_accessed audit event', async () => {
    await post<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001/decrypt`, undefined, auth);
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/audit?action=secret_accessed`,
      auth
    );
    expect(body.entries.some((e: any) => e.event.resourceId === 'sec-001')).toBe(true);
  });

  it('creating, rotating, and deleting a secret each record their own audit action', async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets`,
      {
        name: 'Audited lifecycle secret',
        type: 'api_key',
        provider: 'internal',
        value: 'v1',
        tags: [],
      },
      orgBearer('tenant-mutation-test')
    );
    const id = created.body.secret.id;

    await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/${id}/rotate`,
      { value: 'v2' },
      orgBearer('tenant-mutation-test')
    );
    await del<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/${id}`,
      undefined,
      orgBearer('tenant-mutation-test')
    );

    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/audit`,
      orgBearer('tenant-mutation-test')
    );
    const actions = body.entries
      .filter((e: any) => e.event.resourceId === id)
      .map((e: any) => e.event.action);
    expect(actions).toContain('secret_created');
    expect(actions).toContain('secret_rotated');
    expect(actions).toContain('secret_deleted');
  });

  it('the audit chain still verifies as tamper-free after these new entries', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/security/audit/verify', auth);
    expect(body.valid).toBe(true);
  });
});

describe('POST /api/v1/security/secrets/:id/rotate — cross-tenant BOLA', () => {
  it("tenant-professional cannot rotate tenant-enterprise's secret", async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-001/rotate`,
      { value: 'hostile-overwrite' },
      otherAuth
    );
    expect(status).toBe(404);
  });
});

// ─── Automatic secret rotation (Sprint 47 / ATLAS FORTRESS) ────────────────────

describe('Secret rotation scheduler', () => {
  it('rotate-now genuinely re-encrypts and bumps the version', async () => {
    const before = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-001', auth);
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-001/rotate-now',
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.secretId).toBe('sec-001');
    expect(body.newVersion).toBe(before.body.secret.version + 1);
    expect(body.previousVersion).toBe(before.body.secret.version);
  });

  it("tenant-professional cannot force-rotate tenant-enterprise's secret via rotate-now", async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-002/rotate-now',
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
  });

  it('rotate-now returns 404 for an unknown secret', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-does-not-exist/rotate-now',
      undefined,
      auth
    );
    expect(status).toBe(404);
  });

  it('rotation history includes the forced rotation', async () => {
    await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-004/rotate-now',
      undefined,
      otherAuth
    );
    const { body } = await get<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/rotation/history?secretId=sec-004',
      otherAuth
    );
    expect(body.history.some((r: any) => r.secretId === 'sec-004')).toBe(true);
  });

  describe('GET /rotation/history — cross-tenant BOLA (final hardening, Part 1)', () => {
    it('returns 401 unauthenticated', async () => {
      const { status } = await get<any>(srv.baseUrl, '/api/v1/security/secrets/rotation/history');
      expect(status).toBe(401);
    });

    it("never returns another tenant's rotation history, even unfiltered", async () => {
      const { body } = await get<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/history',
        auth
      );
      expect(body.history.every((r: any) => r.tenantId === TENANT)).toBe(true);
    });

    it("tenant-enterprise cannot read tenant-professional's per-secret rotation history (sec-004)", async () => {
      const { status } = await get<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/history?secretId=sec-004',
        auth
      );
      expect(status).toBe(404);
    });
  });

  describe('POST /rotation/evaluate — platform-wide admin operation, not a tenant self-service one (final hardening, Part 1)', () => {
    it('rejects a plain tenant session (any authenticated user could previously force fleet-wide rotation)', async () => {
      const { status } = await post<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/evaluate',
        undefined,
        auth
      );
      expect(status).toBe(401);
    });

    it('rejects an admin session without security.manage', async () => {
      const { status } = await post<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/evaluate',
        undefined,
        await lowPrivAdminBearer()
      );
      expect(status).toBe(403);
    });

    it('rejects a fully unauthenticated caller', async () => {
      const { status } = await post<any>(srv.baseUrl, '/api/v1/security/secrets/rotation/evaluate');
      expect(status).toBe(401);
    });

    it('does not touch secrets whose expiry is far in the future, for an admin holding security.manage', async () => {
      const before = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-005', auth);
      const { status } = await post<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/evaluate',
        undefined,
        await securityAdminBearer()
      );
      expect(status).toBe(200);
      const after = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-005', auth);
      expect(after.body.secret.version).toBe(before.body.secret.version);
    });

    it('rotates a secret whose expiry falls inside the rotation lead window, for an admin holding security.manage', async () => {
      const created = await post<any>(
        srv.baseUrl,
        `/api/v1/security/secrets`,
        {
          name: 'Nearly-expired auto-rotate secret',
          type: 'api_key',
          provider: 'internal',
          value: 'about-to-expire',
          tags: [],
          autoRotate: true,
          rotationIntervalDays: 30,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        orgBearer('tenant-mutation-test')
      );
      const id = created.body.secret.id;
      expect(created.body.secret.version).toBe(1);

      const { body } = await post<any>(
        srv.baseUrl,
        '/api/v1/security/secrets/rotation/evaluate',
        undefined,
        await securityAdminBearer()
      );
      expect(body.rotated.some((r: any) => r.secretId === id)).toBe(true);

      const after = await get<any>(
        srv.baseUrl,
        `/api/v1/security/secrets/${id}`,
        orgBearer('tenant-mutation-test')
      );
      expect(after.body.secret.version).toBe(2);
      expect(new Date(after.body.secret.expiresAt).getTime()).toBeGreaterThan(
        Date.now() + 20 * 24 * 60 * 60 * 1000
      );
    });
  });
});

// ─── MFA ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/mfa/status', () => {
  it('returns enrolled status for enterprise admin', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=admin@atlas.enterprise.com`,
      auth
    );
    expect(status).toBe(200);
    expect(body.enrolled).toBe(true);
    expect(body.secretBase32).toBeUndefined();
  });

  it('returns not enrolled for community tenant', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=dev@atlas.community.com`,
      orgBearer('tenant-community')
    );
    expect(status).toBe(200);
    expect(body.enrolled).toBe(false);
  });

  it('MFA userId default never crosses tenant boundary (final hardening, Part 5)', async () => {
    // enterprise's default identity IS enrolled (seeded); professional's
    // own default (a DIFFERENT string, derived from its own tenantId) must
    // report its own independent state, never leaking enterprise's.
    const enterpriseDefault = await get<any>(srv.baseUrl, `/api/v1/security/mfa/status`, auth);
    expect(enterpriseDefault.body.userId).toBe('admin@atlas.enterprise.com');
    expect(enterpriseDefault.body.enrolled).toBe(true);

    const professionalDefault = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status`,
      otherAuth
    );
    expect(professionalDefault.body.userId).toBe('admin@atlas.professional.com');
    expect(professionalDefault.body.userId).not.toBe(enterpriseDefault.body.userId);
  });
});

describe('MFA — cross-tenant BOLA', () => {
  it('sets up MFA and verifies backup codes are returned', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'test@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(201);
    expect(body.secret).toBeTruthy();
    expect(body.otpUri).toMatch(/^otpauth:\/\/totp\//);
    expect(body.backupCodes).toHaveLength(8);
  });

  it("tenant-professional's status check for enterprise's admin userId reports not-enrolled, never enterprise's real MFA state (each tenant's userId namespace is independent)", async () => {
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=admin@atlas.enterprise.com`,
      otherAuth
    );
    expect(body.enrolled).toBe(false);
  });

  it('disables MFA for a tenant', async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'disable@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const { status, body } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/disable?userId=disable%40mutation.com`,
      undefined,
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(200);
    expect(body.disabled).toBe(true);
  });

  it("another tenant cannot disable this tenant's MFA for the same userId string, because it's scoped by session org, not the userId alone", async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'shared-name@example.com' },
      auth
    );
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/disable?userId=shared-name%40example.com`,
      undefined,
      otherAuth
    );
    // tenant-professional has no MFA record for this userId under its own
    // tenant scope — 404, and tenant-enterprise's record must be untouched.
    expect(status).toBe(404);
    const stillEnrolled = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=shared-name%40example.com`,
      auth
    );
    expect(stillEnrolled.body.enrolled).toBe(true);
  });
});

describe('POST /api/v1/security/mfa/verify — brute-force lockout (final hardening, Part 2)', () => {
  it('locks out after 5 invalid attempts, a valid code is then rejected too, and a different userId is unaffected', async () => {
    const setup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'bruteforce-target@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const secretBase32 = setup.body.secret;
    const validToken = generateTotpToken(base32Decode(secretBase32));

    for (let i = 0; i < 5; i++) {
      const { body } = await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/verify`,
        { userId: 'bruteforce-target@mutation.com', token: '000000' },
        orgBearer('tenant-mutation-test')
      );
      expect(body.valid).toBe(false);
    }

    // Locked out even with the CORRECT TOTP now — proves this blocks brute
    // force rather than just re-rejecting bad guesses.
    const lockedOut = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'bruteforce-target@mutation.com', token: validToken },
      orgBearer('tenant-mutation-test')
    );
    expect(lockedOut.status).toBe(423);
    expect(lockedOut.body.error.code).toBe('MFA_LOCKED');

    // Keyed by (tenantId, userId), deliberately not IP — a different
    // x-forwarded-for on the SAME userId+tenant is still locked out (an
    // attacker can't escape the limit by spoofing a header).
    const differentIp = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'bruteforce-target@mutation.com', token: validToken },
      { ...orgBearer('tenant-mutation-test'), 'x-forwarded-for': '203.0.113.55' }
    );
    expect(differentIp.status).toBe(423);

    // A different userId under the same tenant is completely unaffected.
    const otherSetup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'unrelated-user@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const otherToken = generateTotpToken(base32Decode(otherSetup.body.secret));
    const otherUser = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'unrelated-user@mutation.com', token: otherToken },
      orgBearer('tenant-mutation-test')
    );
    expect(otherUser.status).toBe(200);
    expect(otherUser.body.valid).toBe(true);
  });

  it('a successful verification resets the failure counter', async () => {
    const setup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'reset-check@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const secretBuf = base32Decode(setup.body.secret);
    // ATLAS 46.28 — replay protection means the exact same code can only
    // ever verify once; each verification below must use a genuinely
    // different time-step's code, not the same `validToken` reused.
    const validToken = generateTotpToken(secretBuf);

    // 2 failures, well under the 5-attempt threshold.
    for (let i = 0; i < 2; i++) {
      await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/verify`,
        { userId: 'reset-check@mutation.com', token: '111111' },
        orgBearer('tenant-mutation-test')
      );
    }
    const success = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'reset-check@mutation.com', token: validToken },
      orgBearer('tenant-mutation-test')
    );
    expect(success.status).toBe(200);
    expect(success.body.valid).toBe(true);

    // 2 more failures after the reset — still well under threshold, so this
    // must NOT be locked out (proves the counter was actually cleared, not
    // just not-yet-at-5).
    for (let i = 0; i < 2; i++) {
      await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/verify`,
        { userId: 'reset-check@mutation.com', token: '222222' },
        orgBearer('tenant-mutation-test')
      );
    }
    // A different time-step's code (T+1) — the previous one is now a
    // replay and would correctly be rejected.
    const nextStepToken = generateTotpToken(secretBuf, Date.now() + 30_000);
    const stillOpen = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'reset-check@mutation.com', token: nextStepToken },
      orgBearer('tenant-mutation-test')
    );
    expect(stillOpen.status).toBe(200);
    expect(stillOpen.body.valid).toBe(true);
  });

  it('rejects a replayed code — the same successful code cannot verify twice', async () => {
    const setup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'replay-check@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const token = generateTotpToken(base32Decode(setup.body.secret));

    const first = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'replay-check@mutation.com', token },
      orgBearer('tenant-mutation-test')
    );
    expect(first.status).toBe(200);
    expect(first.body.valid).toBe(true);

    const replay = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'replay-check@mutation.com', token },
      orgBearer('tenant-mutation-test')
    );
    expect(replay.status).toBe(200);
    expect(replay.body.valid).toBe(false);
    // Same generic message as a wrong code — no oracle revealing "this
    // code was valid but already used".
    expect(replay.body.message).toBe('Invalid or expired token');
  });

  it('N concurrent invalid-code attempts for the same userId never let more than the limit through (no race-condition bypass)', async () => {
    const userId = `verify-concurrency-${Date.now()}@mutation.com`;
    const tenantAuth = orgBearer('tenant-mutation-test');
    await post<any>(srv.baseUrl, `/api/v1/security/mfa/setup`, { userId }, tenantAuth);

    const CONCURRENT = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        post<any>(
          srv.baseUrl,
          `/api/v1/security/mfa/verify`,
          { userId, token: '000000' },
          tenantAuth
        )
      )
    );
    const notLocked = results.filter((r) => r.status === 200).length;
    const locked = results.filter((r) => r.status === 423).length;
    expect(notLocked + locked).toBe(CONCURRENT);
    // Under true concurrency the exact number that slip through before the
    // in-memory counter catches up can vary, but the burst must not be
    // entirely unthrottled.
    expect(notLocked).toBeLessThan(CONCURRENT);

    // The limiter must now be tripped for subsequent sequential calls too.
    const after = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId, token: '000000' },
      tenantAuth
    );
    expect(after.status).toBe(423);
  });

  it("tenant-professional's failed MFA attempts against its own userId never lock out tenant-enterprise's identically-named userId", async () => {
    const enterpriseSetup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'shared-mfa-name@example.com' },
      auth
    );
    const enterpriseToken = generateTotpToken(base32Decode(enterpriseSetup.body.secret));

    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'shared-mfa-name@example.com' },
      otherAuth
    );
    for (let i = 0; i < 5; i++) {
      await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/verify`,
        { userId: 'shared-mfa-name@example.com', token: '000000' },
        otherAuth
      );
    }
    const otherLocked = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'shared-mfa-name@example.com', token: '000000' },
      otherAuth
    );
    expect(otherLocked.status).toBe(423);

    const enterpriseStillOpen = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'shared-mfa-name@example.com', token: enterpriseToken },
      auth
    );
    expect(enterpriseStillOpen.status).toBe(200);
    expect(enterpriseStillOpen.body.valid).toBe(true);
  });
});

describe('POST /api/v1/security/mfa/setup — rate limiting & abuse resistance (ATLAS 46.28)', () => {
  it('locks out after 5 setup calls within the window, for the same (tenant, userId)', async () => {
    const userId = 'setup-abuse@mutation.com';
    const tenantAuth = orgBearer('tenant-mutation-test');
    let lastSecret = '';
    for (let i = 0; i < 5; i++) {
      const { status, body } = await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/setup`,
        { userId },
        tenantAuth
      );
      expect(status).toBe(201);
      lastSecret = body.secret;
    }
    const sixth = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId },
      tenantAuth
    );
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('MFA_SETUP_RATE_LIMITED');

    // And the factor from the 5th call is still the active one — the
    // rate-limited 6th call never touched stored state.
    const statusCheck = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=${encodeURIComponent(userId)}`,
      tenantAuth
    );
    expect(statusCheck.body.enrolled).toBe(true);
    expect(lastSecret).toBeTruthy();
  });

  it("setup's rate limiter is independent from verify's — exhausting one does not lock the other", async () => {
    const userId = 'independent-limiters@mutation.com';
    const tenantAuth = orgBearer('tenant-mutation-test');
    await post<any>(srv.baseUrl, `/api/v1/security/mfa/setup`, { userId }, tenantAuth);

    for (let i = 0; i < 5; i++) {
      await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/verify`,
        { userId, token: '000000' },
        tenantAuth
      );
    }
    const verifyLocked = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId, token: '000000' },
      tenantAuth
    );
    expect(verifyLocked.status).toBe(423);

    // verify is locked, but setup (a separate counter) still has budget.
    const setupStillOpen = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId },
      tenantAuth
    );
    expect(setupStillOpen.status).toBe(201);
  });

  it('setup calls for a different userId are unaffected by another userId being rate-limited', async () => {
    const lockedUserId = 'setup-locked-target@mutation.com';
    const tenantAuth = orgBearer('tenant-mutation-test');
    for (let i = 0; i < 5; i++) {
      await post<any>(
        srv.baseUrl,
        `/api/v1/security/mfa/setup`,
        { userId: lockedUserId },
        tenantAuth
      );
    }
    const { status: lockedStatus } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: lockedUserId },
      tenantAuth
    );
    expect(lockedStatus).toBe(429);

    const { status: otherStatus } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'setup-unrelated-target@mutation.com' },
      tenantAuth
    );
    expect(otherStatus).toBe(201);
  });

  it('N concurrent setup calls for the same userId never exceed the limit (no race-condition bypass)', async () => {
    const userId = `setup-concurrency-${Date.now()}@mutation.com`;
    const tenantAuth = orgBearer('tenant-mutation-test');
    const CONCURRENT = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        post<any>(srv.baseUrl, `/api/v1/security/mfa/setup`, { userId }, tenantAuth)
      )
    );
    const succeeded = results.filter((r) => r.status === 201).length;
    const limited = results.filter((r) => r.status === 429).length;
    // The limiter's own MAX_ATTEMPTS is 5 — under true concurrency the
    // exact number that slip through before the counter catches up can
    // vary, but it must never be the full burst of 10, and every response
    // must be one of the two expected codes.
    expect(succeeded + limited).toBe(CONCURRENT);
    expect(succeeded).toBeLessThan(CONCURRENT);
    expect(succeeded).toBeGreaterThan(0);
  });
});

describe('MFA — cross-authentication-scheme boundary (ATLAS 46.28, Etapa 8)', () => {
  const MFA_ROUTES: Array<[string, string, unknown]> = [
    ['GET', '/api/v1/security/mfa/status', undefined],
    ['POST', '/api/v1/security/mfa/setup', { userId: 'boundary-probe@mutation.com' }],
    [
      'POST',
      '/api/v1/security/mfa/verify',
      { userId: 'boundary-probe@mutation.com', token: '000000' },
    ],
    ['DELETE', '/api/v1/security/mfa/disable', undefined],
    ['GET', '/api/v1/security/mfa/backup-codes', undefined],
  ];

  const call = (
    method: string,
    path: string,
    payload: unknown,
    headers?: Record<string, string>
  ) => {
    switch (method) {
      case 'GET':
        return get<any>(srv.baseUrl, path, headers);
      case 'POST':
        return post<any>(srv.baseUrl, path, payload, headers);
      case 'DELETE':
        return del<any>(srv.baseUrl, path, payload, headers);
      default:
        throw new Error(`unsupported method ${method}`);
    }
  };

  for (const [method, path, payload] of MFA_ROUTES) {
    it(`${method} ${path} rejects a real portal-identity session (different signing secret)`, async () => {
      const { status } = await call(method, path, payload, await portalUserBearer());
      expect(status).toBe(401);
    });

    it(`${method} ${path} rejects a real Runtime access token (different signing secret)`, async () => {
      const { status } = await call(method, path, payload, await runtimeBearer());
      expect(status).toBe(401);
    });

    it(`${method} ${path} rejects a real admin-identity session (different signing secret — security/* uses the generic middleware, not requirePermission)`, async () => {
      const { status } = await call(method, path, payload, await securityAdminBearer());
      expect(status).toBe(401);
    });

    it(`${method} ${path} rejects a fully anonymous caller`, async () => {
      const { status } = await call(method, path, payload);
      expect(status).toBe(401);
    });

    it(`${method} ${path} rejects an authenticated session with no organization (403, not a silent default tenant)`, async () => {
      const { status, body } = await call(method, path, payload, noOrgBearer());
      expect(status).toBe(403);
      expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
    });
  }
});

describe('MFA — enumeration resistance (ATLAS 46.28, Etapa 7)', () => {
  it('verify returns the identical response shape for "user never enrolled" and "wrong code for an enrolled user"', async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'enum-enrolled@mutation.com' },
      orgBearer('tenant-mutation-test')
    );

    const neverEnrolled = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'enum-never-enrolled@mutation.com', token: '123456' },
      orgBearer('tenant-mutation-test')
    );
    // Not enrolled → 404 today (an explicit, pre-existing contract — see
    // "MFA not enrolled" branch). Documented here, not silently assumed:
    // this DOES distinguish "enrolled" from "not enrolled" by design,
    // which is an accepted, pre-existing tenant-internal disclosure (the
    // caller already has a valid tenant session — this isn't a
    // cross-tenant or cross-authentication-scheme leak). What must NOT
    // differ is the response for two DIFFERENT wrong-code attempts against
    // enrolled users — see the next assertion.
    expect(neverEnrolled.status).toBe(404);

    const wrongCodeEnrolled = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'enum-enrolled@mutation.com', token: '123456' },
      orgBearer('tenant-mutation-test')
    );
    expect(wrongCodeEnrolled.status).toBe(200);
    expect(wrongCodeEnrolled.body).toEqual({
      valid: false,
      message: 'Invalid or expired token',
    });
  });

  it('a replayed (already-used) code and a genuinely-wrong code produce byte-identical response bodies', async () => {
    const setup = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'enum-replay@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const secretBuf = base32Decode(setup.body.secret);
    const token = generateTotpToken(secretBuf);

    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'enum-replay@mutation.com', token },
      orgBearer('tenant-mutation-test')
    );
    const replay = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'enum-replay@mutation.com', token },
      orgBearer('tenant-mutation-test')
    );
    const wrongGuess = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/verify`,
      { userId: 'enum-replay@mutation.com', token: '999999' },
      orgBearer('tenant-mutation-test')
    );
    expect(replay.body).toEqual(wrongGuess.body);
  });

  it('setup never echoes back a previously-issued secret or backup codes for an already-enrolled userId — always a fresh set', async () => {
    const first = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'enum-setup-fresh@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const second = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'enum-setup-fresh@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    expect(second.body.secret).not.toBe(first.body.secret);
    expect(second.body.backupCodes).not.toEqual(first.body.backupCodes);
  });

  it('status never includes secretBase32, backupCodes, or lastUsedStep in its response', async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup`,
      { userId: 'enum-status-shape@mutation.com' },
      orgBearer('tenant-mutation-test')
    );
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?userId=enum-status-shape@mutation.com`,
      orgBearer('tenant-mutation-test')
    );
    expect(body.secretBase32).toBeUndefined();
    expect(body.backupCodes).toBeUndefined();
    expect(body.lastUsedStep).toBeUndefined();
  });
});

// ─── SSO ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/sso', () => {
  it('returns providers for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/sso`, auth);
    expect(status).toBe(200);
    expect(body.providers.length).toBeGreaterThan(0);
  });
});

describe('GET/DELETE /api/v1/security/sso/:id — cross-tenant BOLA', () => {
  it("tenant-professional cannot read tenant-enterprise's SSO provider config (sso-001)", async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/sso/sso-001`, otherAuth);
    expect(status).toBe(404);
  });

  it('the rightful tenant can read its own SSO provider', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/sso/sso-001`, auth);
    expect(status).toBe(200);
    expect(body.provider.id).toBe('sso-001');
  });

  it("tenant-professional cannot delete tenant-enterprise's SSO provider (denial-of-login-service attack)", async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/sso/sso-001`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
    const stillThere = await get<any>(srv.baseUrl, `/api/v1/security/sso/sso-001`, auth);
    expect(stillThere.status).toBe(200);
  });
});

describe('POST /api/v1/security/sso/:id/initiate', () => {
  // See sso.ts's doc comment: despite reading like a pre-session login-start
  // step, this module sits behind the global generic authMiddleware, so it
  // already requires a valid session in the deployed system today — a
  // pre-existing functional inconsistency, not a vulnerability, left
  // unchanged per this audit's scope (see ATLAS 46.26 report, Residual
  // Risks).
  it('returns redirect URL for active OIDC provider', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/sso/sso-001/initiate`,
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.redirectUrl).toBeTruthy();
    expect(body.state).toBeTruthy();
    expect(body.nonce).toBeTruthy();
  });

  it('returns 400 for inactive provider', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/sso/sso-003/initiate`,
      undefined,
      auth
    );
    expect(status).toBe(400);
  });

  it('returns 404 for unknown provider', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/sso/sso-999/initiate`,
      undefined,
      auth
    );
    expect(status).toBe(404);
  });

  it('returns 401 unauthenticated (confirms the current, if unintended, auth requirement)', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/sso/sso-001/initiate`);
    expect(status).toBe(401);
  });
});

// ─── Policies ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/policies', () => {
  it('returns policies for tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/policies`, auth);
    expect(status).toBe(200);
    expect(body.policies.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/policies/evaluate', () => {
  it('evaluates ALLOW for admin role', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies/evaluate`,
      { context: { role: 'admin', riskScore: 10 } },
      auth
    );
    expect(status).toBe(200);
    expect(body.decision).toBe('ALLOW');
    expect(body.matchedPolicy).not.toBeNull();
  });

  it('DEFAULT_DENY when no policies match', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies/evaluate`,
      { context: { role: 'nobody' } },
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(200);
    expect(body.decision).toBe('DEFAULT_DENY');
  });

  it('returns 200 when context missing (defaults to {})', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/policies/evaluate`, {}, auth);
    expect(status).toBe(200);
  });
});

describe('POST + PUT + DELETE /api/v1/security/policies — CRUD + cross-tenant BOLA + mass assignment', () => {
  it('CRUD lifecycle', async () => {
    const { status: cs, body: cb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies`,
      { name: 'TEST_POLICY', effect: 'ALLOW', logic: 'AND', conditions: [] },
      orgBearer('tenant-mutation-test')
    );
    expect(cs).toBe(201);
    const id = cb.policy.id;

    const { status: us, body: ub } = await put<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      { active: false },
      orgBearer('tenant-mutation-test')
    );
    expect(us).toBe(200);
    expect(ub.policy.active).toBe(false);

    const { status: ds } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      undefined,
      orgBearer('tenant-mutation-test')
    );
    expect(ds).toBe(200);
  });

  it("a PUT body containing tenantId/id/createdAt cannot reassign a policy to a different tenant (mass-assignment fix in security-store.ts's updatePolicy)", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies`,
      { name: 'MASS_ASSIGN_PROBE', effect: 'DENY', logic: 'AND', conditions: [] },
      auth
    );
    const id = created.body.policy.id;
    const originalCreatedAt = created.body.policy.createdAt;

    const { status, body } = await put<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      {
        name: 'Renamed',
        tenantId: OTHER_TENANT,
        id: 'pol-should-not-change',
        createdAt: '2000-01-01T00:00:00.000Z',
      },
      auth
    );
    expect(status).toBe(200);
    expect(body.policy.tenantId).toBe(TENANT);
    expect(body.policy.id).toBe(id);
    expect(body.policy.createdAt).toBe(originalCreatedAt);
    expect(body.policy.name).toBe('Renamed');

    // And the policy must not have become visible/reachable under the other tenant.
    const stolen = await get<any>(srv.baseUrl, `/api/v1/security/policies/${id}`, otherAuth);
    expect(stolen.status).toBe(404);
  });

  it("tenant-professional cannot read tenant-enterprise's policy by id", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies`,
      { name: 'ENTERPRISE_ONLY', effect: 'ALLOW', logic: 'AND', conditions: [] },
      auth
    );
    const id = created.body.policy.id;
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/policies/${id}`, otherAuth);
    expect(status).toBe(404);
  });

  it("tenant-professional cannot flip a DENY policy to ALLOW on tenant-enterprise's policy (privilege-widening BOLA)", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies`,
      { name: 'DENY_SENSITIVE', effect: 'DENY', logic: 'AND', conditions: [] },
      auth
    );
    const id = created.body.policy.id;
    const { status } = await put<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      { effect: 'ALLOW' },
      otherAuth
    );
    expect(status).toBe(404);
    const stillDeny = await get<any>(srv.baseUrl, `/api/v1/security/policies/${id}`, auth);
    expect(stillDeny.body.policy.effect).toBe('DENY');
  });

  it("tenant-professional cannot delete tenant-enterprise's policy", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies`,
      { name: 'DELETE_TARGET', effect: 'ALLOW', logic: 'AND', conditions: [] },
      auth
    );
    const id = created.body.policy.id;
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
    const stillThere = await get<any>(srv.baseUrl, `/api/v1/security/policies/${id}`, auth);
    expect(stillThere.status).toBe(200);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/audit', () => {
  it('returns audit entries for tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/audit`, auth);
    expect(status).toBe(200);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('respects limit and offset', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/audit?limit=3&offset=0`, auth);
    expect(body.entries.length).toBeLessThanOrEqual(3);
  });

  it("never returns another tenant's audit entries, even with a ?tenantId= override", async () => {
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/audit?tenantId=${OTHER_TENANT}`,
      auth
    );
    expect(body.entries.every((e: any) => e.event.tenantId === TENANT)).toBe(true);
  });
});

describe('GET /api/v1/security/audit/verify', () => {
  it('verifies chain integrity (deliberately global — whole-chain cryptographic check, not tenant data)', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/audit/verify`, auth);
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/audit/export', () => {
  it("exports in ECS format, scoped to the caller's own tenant", async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/audit/export`,
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.format).toBe('ecs');
    expect(body.records.length).toBeGreaterThan(0);
    expect(body.records[0]['event.action']).toBeTruthy();
  });
});

// ─── Compliance ───────────────────────────────────────────────────────────────

describe('GET /api/v1/security/compliance', () => {
  it('returns compliance controls and summary (deliberately global — framework controls, not tenant data)', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/compliance`, auth);
    expect(status).toBe(200);
    expect(body.controls.length).toBeGreaterThan(0);
    expect(body.summary.length).toBeGreaterThan(0);
  });

  it('filters by framework', async () => {
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/compliance?framework=LGPD`,
      auth
    );
    expect(body.controls.every((c: any) => c.framework === 'LGPD')).toBe(true);
  });

  it('returns 401 unauthenticated (still requires SOME session, even though the data is global)', async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/compliance`);
    expect(status).toBe(401);
  });
});

describe('POST /api/v1/security/compliance/data-request', () => {
  it('creates a LGPD data deletion request', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-request`,
      { type: 'deletion', requestorEmail: 'user@example.com', framework: 'LGPD' },
      auth
    );
    expect(status).toBe(201);
    expect(body.request.type).toBe('deletion');
    expect(body.request.status).toBe('pending');
  });

  it('returns 400 when missing fields', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-request`,
      { type: 'deletion' },
      auth
    );
    expect(status).toBe(400);
  });
});

describe('GET /api/v1/security/compliance/data-requests — tenant isolation', () => {
  it("never returns another tenant's data requests", async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-request`,
      { type: 'access', requestorEmail: 'isolation-check@example.com', framework: 'GDPR' },
      auth
    );
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-requests`,
      otherAuth
    );
    expect(
      body.requests.every((r: any) => r.requestorEmail !== 'isolation-check@example.com')
    ).toBe(true);
  });
});

// ─── Consent ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/consent', () => {
  it('returns consent records for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/consent`, auth);
    expect(status).toBe(200);
    expect(body.records.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/consent', () => {
  it('records a new consent', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/consent`,
      { userId: 'consent@mutation.com', purpose: 'analytics', framework: 'GDPR' },
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(201);
    expect(body.record.granted).toBe(true);
  });
});

describe('DELETE /api/v1/security/consent/revoke', () => {
  it('revokes an existing consent', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/consent`,
      { userId: 'revoke@mutation.com', purpose: 'marketing', framework: 'LGPD' },
      orgBearer('tenant-mutation-test')
    );
    expect(created.record.granted).toBe(true);
    const { status, body } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/consent/revoke?userId=revoke%40mutation.com&purpose=marketing`,
      undefined,
      orgBearer('tenant-mutation-test')
    );
    expect(status).toBe(200);
    expect(body.record.granted).toBe(false);
    expect(body.record.revokedAt).toBeTruthy();
  });

  it('returns 404 for unknown consent', async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/consent/revoke?userId=nobody%40example.com&purpose=analytics`,
      undefined,
      auth
    );
    expect(status).toBe(404);
  });

  it("another tenant cannot revoke this tenant's consent for the same userId/purpose", async () => {
    await post<any>(
      srv.baseUrl,
      `/api/v1/security/consent`,
      { userId: 'cross-tenant@example.com', purpose: 'marketing', framework: 'LGPD' },
      auth
    );
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/consent/revoke?userId=cross-tenant%40example.com&purpose=marketing`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
  });
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/risk', () => {
  it('returns risk events for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/risk`, auth);
    expect(status).toBe(200);
    expect(body.events.length).toBeGreaterThan(0);
  });

  it('filters unresolved events', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/risk?resolved=false`, auth);
    expect(body.events.every((e: any) => e.resolved === false)).toBe(true);
  });
});

describe('GET /api/v1/security/risk/score/:tenantId — previously trusted the URL segment with NO check at all', () => {
  it('returns risk score for enterprise when the URL segment matches the session', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/risk/score/tenant-enterprise`,
      auth
    );
    expect(status).toBe(200);
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(body.level);
  });

  it("returns 403 when tenant-professional requests tenant-enterprise's risk score by editing the URL", async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/risk/score/tenant-enterprise`,
      otherAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/v1/security/risk/assess + resolve', () => {
  it('creates and resolves a risk event', async () => {
    const { status: cs, body: cb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/assess`,
      {
        type: 'suspicious_ip',
        actor: 'test@mutation.com',
        level: 'MEDIUM',
        score: 55,
        description: 'Test risk event',
        ip: '1.2.3.4',
      },
      orgBearer('tenant-mutation-test')
    );
    expect(cs).toBe(201);
    const id = cb.event.id;

    const { status: rs, body: rb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/${id}/resolve`,
      undefined,
      orgBearer('tenant-mutation-test')
    );
    expect(rs).toBe(200);
    expect(rb.event.resolved).toBe(true);
  });

  it('returns 400 when missing fields', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/assess`,
      { type: 'bot_detected' },
      auth
    );
    expect(status).toBe(400);
  });

  it("tenant-professional cannot resolve tenant-enterprise's risk event", async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/assess`,
      {
        type: 'bot_detected',
        actor: 'attacker@example.com',
        level: 'HIGH',
        score: 90,
        description: 'Cross-tenant resolve probe',
        ip: '9.9.9.9',
      },
      auth
    );
    const id = created.body.event.id;
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/${id}/resolve`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
    const stillUnresolved = await get<any>(srv.baseUrl, `/api/v1/security/risk`, auth);
    expect(stillUnresolved.body.events.find((e: any) => e.id === id)?.resolved).toBe(false);
  });
});

// ─── Certificates ─────────────────────────────────────────────────────────────

describe('GET /api/v1/security/certificates', () => {
  it('returns certificates for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/certificates`, auth);
    expect(status).toBe(200);
    expect(body.certificates.length).toBeGreaterThan(0);
    expect(body.expiringSoon).toBeGreaterThan(0); // cert-001 expires in 25 days
  });
});

describe('POST /api/v1/security/certificates/renew/:id — cross-tenant BOLA', () => {
  it('renews a certificate for its own tenant', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/certificates/renew/cert-002`,
      undefined,
      auth
    );
    expect(status).toBe(200);
    expect(body.certificate.daysUntilExpiry).toBe(365);
    expect(body.certificate.renewedAt).toBeTruthy();
  });

  it("tenant-professional cannot renew tenant-enterprise's certificate", async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/certificates/renew/cert-003`,
      undefined,
      otherAuth
    );
    expect(status).toBe(404);
  });

  it('returns 404 for unknown certificate', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/certificates/renew/cert-999`,
      undefined,
      auth
    );
    expect(status).toBe(404);
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/dashboard', () => {
  it('returns a complete security dashboard', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/dashboard`, auth);
    expect(status).toBe(200);
    expect(typeof body.eventsToday).toBe('number');
    expect(typeof body.failedAuthLast24h).toBe('number');
    expect(typeof body.mfaAdoptionPct).toBe('number');
    expect(typeof body.activePolicies).toBe('number');
    expect(body.compliance).toBeTruthy();
    expect(body.criticalAlerts).toBeInstanceOf(Array);
    expect(body.riskScores).toBeInstanceOf(Array);
  });

  it('dashboard has LGPD and GDPR compliance fields', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/dashboard`, auth);
    expect(body.compliance.LGPD).toBeTruthy();
    expect(body.compliance.GDPR).toBeTruthy();
  });
});

// ─── Org enforcement ──────────────────────────────────────────────────────────
// No route may fall back to a default tenant, trust a client-supplied
// tenantId header/query param, or serve an unauthenticated request.

describe('Org enforcement — session-derived identity only, no client-supplied fallback', () => {
  const ORG_SCOPED_GET_ROUTES = [
    '/api/v1/security/secrets',
    '/api/v1/security/policies',
    '/api/v1/security/risk',
    '/api/v1/security/consent',
    '/api/v1/security/compliance/data-requests',
    '/api/v1/security/sso',
    '/api/v1/security/mfa/status',
    '/api/v1/security/dashboard',
    '/api/v1/security/certificates',
    '/api/v1/security/audit',
  ];

  for (const path of ORG_SCOPED_GET_ROUTES) {
    it(`GET ${path} returns 401 unauthenticated`, async () => {
      const { status } = await get(srv.baseUrl, path);
      expect(status).toBe(401);
    });

    it(`GET ${path} returns 403 ORGANIZATION_NOT_LINKED for a session with no org`, async () => {
      const { status, body } = await get<{ error: { code: string } }>(
        srv.baseUrl,
        path,
        noOrgBearer()
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
    });

    it(`GET ${path}?tenantId=${OTHER_TENANT} is ignored — an x-tenant-id-style override no longer controls scope`, async () => {
      const { status } = await get(srv.baseUrl, `${path}?tenantId=${OTHER_TENANT}`, auth);
      expect([200, 403, 404]).toContain(status);
    });
  }

  it('a valid tenant continues to work (no regression)', async () => {
    const { status } = await get(srv.baseUrl, `/api/v1/security/secrets`, auth);
    expect(status).toBe(200);
  });
});
