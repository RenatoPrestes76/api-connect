import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { post, superAdminAuth } from '../canonical-model/helpers.js';
import { loadOrCreateIdentity } from '../../../../agent/src/atlas-runtime-client/identity.js';
import {
  registerRuntime,
  AtlasApiError,
} from '../../../../agent/src/atlas-runtime-client/client.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.22 — Fase 7: registration-time identity uniqueness, now enforced
 * by real Postgres unique constraints (RuntimeRegistration.machineFingerprintHash
 * and .publicKey — see the migration and runtime-registration.repository.ts),
 * not just an in-memory linear scan. Every case here is a deliberate,
 * documented decision (see docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md /
 * docs/ATLAS-RUNTIME-CLIENT.md), never a silent choice:
 *
 *   - same fingerprint (regardless of key) -> FINGERPRINT_DUPLICATE, rejected
 *   - same public key under a different fingerprint -> PUBLIC_KEY_ALREADY_REGISTERED, rejected
 *   - "keyId" as a concept distinct from runtimeId/publicKey does not exist
 *     in this protocol (see docs/ATLAS-RUNTIME-ONBOARDING-MATRIX.md) — there
 *     is no "register with an existing runtimeId" path, so "same runtimeId,
 *     different key" is structurally impossible, not tested here.
 */

async function issueActivationKey(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{ organizationCode: string; activationKey: string }> {
  const orgCode = `${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  await post(baseUrl, '/api/v1/portal/auth/register', {
    name: `Idempotency ${orgCode}`,
    razaoSocial: `Idempotency ${orgCode} LTDA`,
    cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
    internalCode: orgCode,
    plan: 'professional',
    owner: {
      name: 'Owner',
      email: `owner-${orgCode.toLowerCase()}@example.com`,
      password: 'S3nhaDoOwner123!',
    },
  });
  const keyRes = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode: orgCode },
    auth
  );
  return { organizationCode: orgCode, activationKey: keyRes.body.activationKey.code };
}

describe('ATLAS 46.22 — registration idempotency and identity uniqueness', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = await superAdminAuth(baseUrl);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    await prisma.organization.deleteMany({ where: { slug: { startsWith: 'IDEM' } } });
  });

  it('the same fingerprint cannot register twice, even with a brand-new key each time', async () => {
    const first = await issueActivationKey(baseUrl, auth, 'IDEMA');
    const dir1 = mkdtempSync(join(tmpdir(), 'atlas-idem-fp-1-'));
    const identity1 = loadOrCreateIdentity(dir1);
    const fingerprint = identity1.fingerprint;

    try {
      await registerRuntime(baseUrl, identity1, {
        organizationCode: first.organizationCode,
        activationKey: first.activationKey,
        runtimeVersion: '1.2.0',
        hostname: 'idem-fp-host-1',
        os: 'linux',
      });

      // A second identity, deliberately forced to share the first
      // fingerprint (a real second key, distinct from the first) — this is
      // the "same fingerprint, different key" case from Fase 7.
      const second = await issueActivationKey(baseUrl, auth, 'IDEMB');
      const dir2 = mkdtempSync(join(tmpdir(), 'atlas-idem-fp-2-'));
      try {
        const identity2 = loadOrCreateIdentity(dir2);
        identity2.fingerprint = fingerprint; // same fingerprint, different Ed25519 keypair
        await expect(
          registerRuntime(baseUrl, identity2, {
            organizationCode: second.organizationCode,
            activationKey: second.activationKey,
            runtimeVersion: '1.2.0',
            hostname: 'idem-fp-host-2',
            os: 'linux',
          })
        ).rejects.toMatchObject({ status: 409, code: 'FINGERPRINT_DUPLICATE' });
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir1, { recursive: true, force: true });
    }
  });

  it('the same Ed25519 public key cannot register under a second, different fingerprint', async () => {
    const first = await issueActivationKey(baseUrl, auth, 'IDEMC');
    const dir1 = mkdtempSync(join(tmpdir(), 'atlas-idem-pk-1-'));
    const identity1 = loadOrCreateIdentity(dir1);

    try {
      await registerRuntime(baseUrl, identity1, {
        organizationCode: first.organizationCode,
        activationKey: first.activationKey,
        runtimeVersion: '1.2.0',
        hostname: 'idem-pk-host-1',
        os: 'linux',
      });

      const second = await issueActivationKey(baseUrl, auth, 'IDEMD');
      const dir2 = mkdtempSync(join(tmpdir(), 'atlas-idem-pk-2-'));
      try {
        const identity2 = loadOrCreateIdentity(dir2);
        // Same public/private keypair, genuinely different fingerprint —
        // proves the uniqueness check is on the key itself, independent of
        // the fingerprint check above.
        identity2.publicKeyPem = identity1.publicKeyPem;
        await expect(
          registerRuntime(baseUrl, identity2, {
            organizationCode: second.organizationCode,
            activationKey: second.activationKey,
            runtimeVersion: '1.2.0',
            hostname: 'idem-pk-host-2',
            os: 'linux',
          })
        ).rejects.toMatchObject({ status: 409, code: 'PUBLIC_KEY_ALREADY_REGISTERED' });
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir1, { recursive: true, force: true });
    }
  });

  it('two concurrent registrations racing the exact same fingerprint: exactly one succeeds, the database-level unique constraint is the real guard', async () => {
    const orgA = await issueActivationKey(baseUrl, auth, 'IDEME');
    const orgB = await issueActivationKey(baseUrl, auth, 'IDEMF');
    const dir1 = mkdtempSync(join(tmpdir(), 'atlas-idem-race-1-'));
    const dir2 = mkdtempSync(join(tmpdir(), 'atlas-idem-race-2-'));
    try {
      const identity1 = loadOrCreateIdentity(dir1);
      const identity2 = loadOrCreateIdentity(dir2);
      const sharedFingerprint = identity1.fingerprint;
      identity2.fingerprint = sharedFingerprint;

      const results = await Promise.allSettled([
        registerRuntime(baseUrl, identity1, {
          organizationCode: orgA.organizationCode,
          activationKey: orgA.activationKey,
          runtimeVersion: '1.2.0',
          hostname: 'idem-race-host-1',
          os: 'linux',
        }),
        registerRuntime(baseUrl, identity2, {
          organizationCode: orgB.organizationCode,
          activationKey: orgB.activationKey,
          runtimeVersion: '1.2.0',
          hostname: 'idem-race-host-2',
          os: 'linux',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(AtlasApiError);
        expect((rejected[0].reason as AtlasApiError).code).toBe('FINGERPRINT_DUPLICATE');
      }

      const rowCount = await prisma.runtimeRegistration.count({
        where: { machineFingerprintHash: { not: '' }, hostname: { startsWith: 'idem-race-host-' } },
      });
      expect(rowCount).toBe(1);
    } finally {
      rmSync(dir1, { recursive: true, force: true });
      rmSync(dir2, { recursive: true, force: true });
      await prisma.runtimeRegistration.deleteMany({
        where: { hostname: { startsWith: 'idem-race-host-' } },
      });
    }
  });
});
