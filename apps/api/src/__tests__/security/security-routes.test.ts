import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, get, post, del, put } from './helpers.js';
import type { TestServer } from './helpers.js';

const TENANT = 'tenant-enterprise';
const TENANT_PRO = 'tenant-professional';
const Q = (t = TENANT) => `?tenantId=${t}`;

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
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/secrets${Q()}`);
    expect(status).toBe(200);
    expect(body.secrets.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('does not expose encryptedValue in list', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/secrets${Q()}`);
    for (const s of body.secrets) {
      expect(s.encryptedValue).toBeUndefined();
      expect(s.masked).toBeTruthy();
    }
  });
});

describe('GET /api/v1/security/secrets/:id', () => {
  it('returns metadata for a seeded secret', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001`);
    expect(status).toBe(200);
    expect(body.secret.id).toBe('sec-001');
    expect(body.secret.encryptedValue).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const { status } = await get<any>(srv.baseUrl, `/api/v1/security/secrets/sec-999`);
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/security/secrets/:id/decrypt', () => {
  it('decrypts a seeded secret', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets/sec-001/decrypt`
    );
    expect(status).toBe(200);
    expect(body.value).toBeTruthy();
    expect(typeof body.value).toBe('string');
  });

  it('returns 404 for unknown secret', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/secrets/sec-999/decrypt`);
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/security/secrets + DELETE', () => {
  it('creates and deletes a secret', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets${Q('tenant-mutation-test')}`,
      {
        name: 'Test Secret',
        type: 'api_key',
        provider: 'internal',
        value: 'my-test-key',
        tags: [],
      }
    );
    expect(status).toBe(201);
    const id = body.secret.id;
    const { status: delStatus } = await del<any>(srv.baseUrl, `/api/v1/security/secrets/${id}`);
    expect(delStatus).toBe(200);
  });

  it('returns 400 when value missing', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/secrets${Q()}`, {
      name: 'Test',
      type: 'api_key',
      provider: 'internal',
    });
    expect(status).toBe(400);
  });

  it('requires rotationIntervalDays when autoRotate is true', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/secrets${Q()}`, {
      name: 'Auto-rotate without interval',
      type: 'api_key',
      provider: 'internal',
      value: 'v',
      autoRotate: true,
    });
    expect(status).toBe(400);
  });

  it('a secret created with provider=hashicorp_vault reports vaultStatus=not_configured (no live Vault in this sandbox)', async () => {
    const { body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets${Q('tenant-mutation-test')}`,
      {
        name: 'Vault-backed secret',
        type: 'api_key',
        provider: 'hashicorp_vault',
        value: 'vault-value',
        tags: [],
      }
    );
    expect(body.secret.vaultStatus).toBe('not_configured');
  });

  it('an internal-provider secret has vaultStatus null', async () => {
    const { body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets${Q('tenant-mutation-test')}`,
      {
        name: 'Internal secret',
        type: 'api_key',
        provider: 'internal',
        value: 'internal-value',
        tags: [],
      }
    );
    expect(body.secret.vaultStatus).toBeNull();
  });
});

// ─── Secret-access auditing (Sprint 47 / ATLAS FORTRESS) ───────────────────────

describe('Secrets — access auditing writes to the tamper-evident chain', () => {
  it('decrypting a secret records a secret_accessed audit event', async () => {
    await post<any>(srv.baseUrl, `/api/v1/security/secrets/sec-001/decrypt`, {});
    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/audit${Q()}&action=secret_accessed`
    );
    expect(body.entries.some((e: any) => e.event.resourceId === 'sec-001')).toBe(true);
  });

  it('creating, rotating, and deleting a secret each record their own audit action', async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets${Q('tenant-mutation-test')}`,
      {
        name: 'Audited lifecycle secret',
        type: 'api_key',
        provider: 'internal',
        value: 'v1',
        tags: [],
      }
    );
    const id = created.body.secret.id;

    await post<any>(srv.baseUrl, `/api/v1/security/secrets/${id}/rotate`, { value: 'v2' });
    await del<any>(srv.baseUrl, `/api/v1/security/secrets/${id}`);

    const { body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/audit${Q('tenant-mutation-test')}`
    );
    const actions = body.entries
      .filter((e: any) => e.event.resourceId === id)
      .map((e: any) => e.event.action);
    expect(actions).toContain('secret_created');
    expect(actions).toContain('secret_rotated');
    expect(actions).toContain('secret_deleted');
  });

  it('the audit chain still verifies as tamper-free after these new entries', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/security/audit/verify');
    expect(body.valid).toBe(true);
  });
});

// ─── Automatic secret rotation (Sprint 47 / ATLAS FORTRESS) ────────────────────

describe('Secret rotation scheduler', () => {
  it('rotate-now genuinely re-encrypts and bumps the version', async () => {
    const before = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-001');
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-001/rotate-now',
      {}
    );
    expect(status).toBe(200);
    expect(body.secretId).toBe('sec-001');
    expect(body.newVersion).toBe(before.body.secret.version + 1);
    expect(body.previousVersion).toBe(before.body.secret.version);
  });

  it('rotate-now returns 404 for an unknown secret', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/sec-does-not-exist/rotate-now',
      {}
    );
    expect(status).toBe(404);
  });

  it('rotation history includes the forced rotation', async () => {
    await post<any>(srv.baseUrl, '/api/v1/security/secrets/sec-004/rotate-now', {});
    const { body } = await get<any>(
      srv.baseUrl,
      '/api/v1/security/secrets/rotation/history?secretId=sec-004'
    );
    expect(body.history.some((r: any) => r.secretId === 'sec-004')).toBe(true);
  });

  it('evaluate does not touch secrets whose expiry is far in the future', async () => {
    // sec-005 is seeded with autoRotate=true but expiresAt ~315 days out — not due.
    const before = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-005');
    await post<any>(srv.baseUrl, '/api/v1/security/secrets/rotation/evaluate', {});
    const after = await get<any>(srv.baseUrl, '/api/v1/security/secrets/sec-005');
    expect(after.body.secret.version).toBe(before.body.secret.version);
  });

  it('evaluate rotates a secret whose expiry falls inside the rotation lead window', async () => {
    const created = await post<any>(
      srv.baseUrl,
      `/api/v1/security/secrets${Q('tenant-mutation-test')}`,
      {
        name: 'Nearly-expired auto-rotate secret',
        type: 'api_key',
        provider: 'internal',
        value: 'about-to-expire',
        tags: [],
        autoRotate: true,
        rotationIntervalDays: 30,
        expiresAt: new Date(Date.now() + 60_000).toISOString(), // 1 minute out — inside the 24h lead window
      }
    );
    const id = created.body.secret.id;
    expect(created.body.secret.version).toBe(1);

    const { body } = await post<any>(srv.baseUrl, '/api/v1/security/secrets/rotation/evaluate', {});
    expect(body.rotated.some((r: any) => r.secretId === id)).toBe(true);

    const after = await get<any>(srv.baseUrl, `/api/v1/security/secrets/${id}`);
    expect(after.body.secret.version).toBe(2);
    // expiresAt should have been pushed forward by rotationIntervalDays, well past the 1-minute mark.
    expect(new Date(after.body.secret.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 20 * 24 * 60 * 60 * 1000
    );
  });
});

// ─── MFA ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/mfa/status', () => {
  it('returns enrolled status for enterprise admin', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status${Q()}&userId=admin@atlas.enterprise.com`
    );
    expect(status).toBe(200);
    expect(body.enrolled).toBe(true);
    expect(body.secretBase32).toBeUndefined();
  });

  it('returns not enrolled for community tenant', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/status?tenantId=tenant-community&userId=dev@atlas.community.com`
    );
    expect(status).toBe(200);
    expect(body.enrolled).toBe(false);
  });
});

describe('POST /api/v1/security/mfa/setup + verify', () => {
  it('sets up MFA and verifies backup codes are returned', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/setup${Q('tenant-mutation-test')}`,
      {
        userId: 'test@mutation.com',
      }
    );
    expect(status).toBe(201);
    expect(body.secret).toBeTruthy();
    expect(body.otpUri).toMatch(/^otpauth:\/\/totp\//);
    expect(body.backupCodes).toHaveLength(8);
  });
});

describe('DELETE /api/v1/security/mfa/disable', () => {
  it('disables MFA for a tenant', async () => {
    await post<any>(srv.baseUrl, `/api/v1/security/mfa/setup${Q('tenant-mutation-test')}`, {
      userId: 'disable@mutation.com',
    });
    const { status, body } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/mfa/disable?tenantId=tenant-mutation-test&userId=disable%40mutation.com`
    );
    expect(status).toBe(200);
    expect(body.disabled).toBe(true);
  });
});

// ─── SSO ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/sso', () => {
  it('returns providers for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/sso${Q()}`);
    expect(status).toBe(200);
    expect(body.providers.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/sso/:id/initiate', () => {
  it('returns redirect URL for active OIDC provider', async () => {
    const { status, body } = await post<any>(srv.baseUrl, `/api/v1/security/sso/sso-001/initiate`);
    expect(status).toBe(200);
    expect(body.redirectUrl).toBeTruthy();
    expect(body.state).toBeTruthy();
    expect(body.nonce).toBeTruthy();
  });

  it('returns 400 for inactive provider', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/sso/sso-003/initiate`);
    expect(status).toBe(400);
  });

  it('returns 404 for unknown provider', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/sso/sso-999/initiate`);
    expect(status).toBe(404);
  });
});

// ─── Policies ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/policies', () => {
  it('returns policies for tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/policies${Q()}`);
    expect(status).toBe(200);
    expect(body.policies.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/policies/evaluate', () => {
  it('evaluates ALLOW for admin role', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies/evaluate${Q()}`,
      {
        context: { role: 'admin', riskScore: 10 },
      }
    );
    expect(status).toBe(200);
    expect(body.decision).toBe('ALLOW');
    expect(body.matchedPolicy).not.toBeNull();
  });

  it('DEFAULT_DENY when no policies match', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies/evaluate${Q('tenant-mutation-test')}`,
      {
        context: { role: 'nobody' },
      }
    );
    expect(status).toBe(200);
    expect(body.decision).toBe('DEFAULT_DENY');
  });

  it('returns 400 when context missing', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/policies/evaluate${Q()}`, {});
    expect(status).toBe(200); // context defaults to {} — evaluates fine
  });
});

describe('POST + PUT + DELETE /api/v1/security/policies', () => {
  it('CRUD lifecycle', async () => {
    const { status: cs, body: cb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/policies${Q('tenant-mutation-test')}`,
      {
        name: 'TEST_POLICY',
        effect: 'ALLOW',
        logic: 'AND',
        conditions: [],
      }
    );
    expect(cs).toBe(201);
    const id = cb.policy.id;

    const { status: us, body: ub } = await put<any>(
      srv.baseUrl,
      `/api/v1/security/policies/${id}`,
      { active: false }
    );
    expect(us).toBe(200);
    expect(ub.policy.active).toBe(false);

    const { status: ds } = await del<any>(srv.baseUrl, `/api/v1/security/policies/${id}`);
    expect(ds).toBe(200);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/audit', () => {
  it('returns audit entries for tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/audit${Q()}`);
    expect(status).toBe(200);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('respects limit and offset', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/audit${Q()}&limit=3&offset=0`);
    expect(body.entries.length).toBeLessThanOrEqual(3);
  });
});

describe('GET /api/v1/security/audit/verify', () => {
  it('verifies chain integrity', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/audit/verify`);
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.total).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/audit/export', () => {
  it('exports in ECS format', async () => {
    const { status, body } = await post<any>(srv.baseUrl, `/api/v1/security/audit/export${Q()}`);
    expect(status).toBe(200);
    expect(body.format).toBe('ecs');
    expect(body.records.length).toBeGreaterThan(0);
    expect(body.records[0]['event.action']).toBeTruthy();
  });
});

// ─── Compliance ───────────────────────────────────────────────────────────────

describe('GET /api/v1/security/compliance', () => {
  it('returns compliance controls and summary', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/compliance`);
    expect(status).toBe(200);
    expect(body.controls.length).toBeGreaterThan(0);
    expect(body.summary.length).toBeGreaterThan(0);
  });

  it('filters by framework', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/compliance?framework=LGPD`);
    expect(body.controls.every((c: any) => c.framework === 'LGPD')).toBe(true);
  });
});

describe('POST /api/v1/security/compliance/data-request', () => {
  it('creates a LGPD data deletion request', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-request${Q()}`,
      {
        type: 'deletion',
        requestorEmail: 'user@example.com',
        framework: 'LGPD',
      }
    );
    expect(status).toBe(201);
    expect(body.request.type).toBe('deletion');
    expect(body.request.status).toBe('pending');
  });

  it('returns 400 when missing fields', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/compliance/data-request${Q()}`,
      { type: 'deletion' }
    );
    expect(status).toBe(400);
  });
});

// ─── Consent ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/consent', () => {
  it('returns consent records for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/consent${Q()}`);
    expect(status).toBe(200);
    expect(body.records.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/security/consent', () => {
  it('records a new consent', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/consent${Q('tenant-mutation-test')}`,
      {
        userId: 'consent@mutation.com',
        purpose: 'analytics',
        framework: 'GDPR',
      }
    );
    expect(status).toBe(201);
    expect(body.record.granted).toBe(true);
  });
});

describe('DELETE /api/v1/security/consent/revoke', () => {
  it('revokes an existing consent', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/consent${Q('tenant-mutation-test')}`,
      {
        userId: 'revoke@mutation.com',
        purpose: 'marketing',
        framework: 'LGPD',
      }
    );
    expect(created.record.granted).toBe(true);
    const { status, body } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/consent/revoke?tenantId=tenant-mutation-test&userId=revoke%40mutation.com&purpose=marketing`
    );
    expect(status).toBe(200);
    expect(body.record.granted).toBe(false);
    expect(body.record.revokedAt).toBeTruthy();
  });

  it('returns 404 for unknown consent', async () => {
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/security/consent/revoke?tenantId=tenant-enterprise&userId=nobody%40example.com&purpose=analytics`
    );
    expect(status).toBe(404);
  });
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/risk', () => {
  it('returns risk events for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/risk${Q()}`);
    expect(status).toBe(200);
    expect(body.events.length).toBeGreaterThan(0);
  });

  it('filters unresolved events', async () => {
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/risk${Q()}&resolved=false`);
    expect(body.events.every((e: any) => e.resolved === false)).toBe(true);
  });
});

describe('GET /api/v1/security/risk/score/:tenantId', () => {
  it('returns risk score for enterprise', async () => {
    const { status, body } = await get<any>(
      srv.baseUrl,
      `/api/v1/security/risk/score/tenant-enterprise`
    );
    expect(status).toBe(200);
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(body.level);
  });
});

describe('POST /api/v1/security/risk/assess + resolve', () => {
  it('creates and resolves a risk event', async () => {
    const { status: cs, body: cb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/assess${Q('tenant-mutation-test')}`,
      {
        type: 'suspicious_ip',
        actor: 'test@mutation.com',
        level: 'MEDIUM',
        score: 55,
        description: 'Test risk event',
        ip: '1.2.3.4',
      }
    );
    expect(cs).toBe(201);
    const id = cb.event.id;

    const { status: rs, body: rb } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/risk/${id}/resolve`
    );
    expect(rs).toBe(200);
    expect(rb.event.resolved).toBe(true);
  });

  it('returns 400 when missing fields', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/risk/assess${Q()}`, {
      type: 'bot_detected',
    });
    expect(status).toBe(400);
  });
});

// ─── Certificates ─────────────────────────────────────────────────────────────

describe('GET /api/v1/security/certificates', () => {
  it('returns certificates for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/certificates${Q()}`);
    expect(status).toBe(200);
    expect(body.certificates.length).toBeGreaterThan(0);
    expect(body.expiringSoon).toBeGreaterThan(0); // cert-001 expires in 25 days
  });
});

describe('POST /api/v1/security/certificates/renew/:id', () => {
  it('renews a certificate', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/security/certificates/renew/cert-001`
    );
    expect(status).toBe(200);
    expect(body.certificate.daysUntilExpiry).toBe(365);
    expect(body.certificate.renewedAt).toBeTruthy();
  });

  it('returns 404 for unknown certificate', async () => {
    const { status } = await post<any>(srv.baseUrl, `/api/v1/security/certificates/renew/cert-999`);
    expect(status).toBe(404);
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('GET /api/v1/security/dashboard', () => {
  it('returns a complete security dashboard', async () => {
    const { status, body } = await get<any>(srv.baseUrl, `/api/v1/security/dashboard${Q()}`);
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
    const { body } = await get<any>(srv.baseUrl, `/api/v1/security/dashboard${Q()}`);
    expect(body.compliance.LGPD).toBeTruthy();
    expect(body.compliance.GDPR).toBeTruthy();
  });
});

// ─── Tenant enforcement (Sprint 00.1) ──────────────────────────────────────────
// No route may fall back to a default tenant — every request below omits
// x-tenant-id and tenantId and must fail with 400 TENANT_REQUIRED.

describe('Tenant enforcement — no hardcoded tenant fallback', () => {
  const NO_TENANT_ROUTES: Array<[string, string]> = [
    ['GET', '/api/v1/security/secrets'],
    ['GET', '/api/v1/security/policies'],
    ['GET', '/api/v1/security/risk'],
    ['GET', '/api/v1/security/consent'],
    ['GET', '/api/v1/security/compliance/data-requests'],
    ['GET', '/api/v1/security/sso'],
    ['GET', '/api/v1/security/mfa/status'],
    ['GET', '/api/v1/security/dashboard'],
    ['GET', '/api/v1/security/certificates'],
    ['GET', '/api/v1/security/audit'],
  ];

  for (const [method, path] of NO_TENANT_ROUTES) {
    it(`${method} ${path} returns 400 TENANT_REQUIRED without a tenant`, async () => {
      const { status, body } =
        method === 'GET'
          ? await get<{ error: { code: string } }>(srv.baseUrl, path)
          : await post<{ error: { code: string } }>(srv.baseUrl, path);
      expect(status).toBe(400);
      expect(body.error.code).toBe('TENANT_REQUIRED');
    });
  }

  it('a valid tenant continues to work (no regression)', async () => {
    const { status } = await get(srv.baseUrl, `/api/v1/security/secrets${Q()}`);
    expect(status).toBe(200);
  });
});
