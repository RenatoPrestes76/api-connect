import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth } from '../canonical-model/helpers.js';
import { loadOrCreateIdentity } from '../../../../agent/src/atlas-runtime-client/identity.js';
import {
  registerRuntime,
  sendHeartbeat,
} from '../../../../agent/src/atlas-runtime-client/client.js';
import {
  LIVENESS_ONLINE_WINDOW_MS,
  LIVENESS_STALE_WINDOW_MS,
} from '../../modules/runtime-registration/liveness.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.25 — Part D/E/F/M: liveness as a real operational signal, not
 * just a pure-function unit (already covered in liveness.test.ts, 46.23).
 *
 *   Part D: a Runtime that stops heartbeating naturally decays
 *           ONLINE -> STALE -> OFFLINE on read, with no scheduler
 *   Part E: heartbeat operational audit (valid, invalid signature,
 *           replay) — cites the exhaustive existing coverage in
 *           runtime-registration-routes.test.ts / real-client-enrollment-
 *           e2e.test.ts rather than duplicating it
 *   Part F/M: a full recovery cycle — ONLINE -> STALE -> OFFLINE ->
 *             ONLINE again — run twice in the same test, using controlled
 *             timestamps (no real sleep), proving the cycle is repeatable
 *             and not a one-shot artifact
 */

async function registerAndActivate(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{
  runtimeId: string;
  identity: { fingerprint: string; publicKeyPem: string; privateKeyPem: string };
}> {
  const orgCode = `${label}${Date.now().toString(36)}`;
  await post(baseUrl, '/api/v1/portal/auth/register', {
    name: `Liveness Op ${orgCode}`,
    razaoSocial: `Liveness Op ${orgCode} LTDA`,
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
  const dir = mkdtempSync(join(tmpdir(), `atlas-liveness-op-${label}-`));
  const identity = loadOrCreateIdentity(dir);
  const registered = await registerRuntime(baseUrl, identity, {
    organizationCode: orgCode,
    activationKey: keyRes.body.activationKey.code,
    runtimeVersion: '1.2.0',
    hostname: `liveness-op-${label}-host`,
    os: 'linux',
  });
  await sendHeartbeat(
    baseUrl,
    { ...identity, runtimeId: registered.runtimeId },
    { version: '1.2.0', memory: 100, cpu: 1 }
  );
  return { runtimeId: registered.runtimeId, identity };
}

describe('ATLAS 46.25 — liveness as an operational signal (Part D/E/F/M)', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  const ORG_PREFIXES = ['LIVOP', 'RECOV'];

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
    for (const prefix of ORG_PREFIXES) {
      await prisma.runtimeRegistration.deleteMany({
        where: { hostname: { startsWith: `liveness-op-${prefix}` } },
      });
      await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
    }
  });

  it('Part D: a Runtime that stops heartbeating decays ONLINE -> STALE -> OFFLINE purely on read, with no background process', async () => {
    const { runtimeId } = await registerAndActivate(baseUrl, auth, 'LIVOP');

    const initial = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}`,
      auth
    );
    expect(initial.body.runtime.liveness).toBe('ONLINE');

    // Controlled timestamp — simulates time passing without a real sleep or
    // any scheduler; the classification is recomputed fresh on this GET.
    await prisma.runtimeRegistration.update({
      where: { id: runtimeId },
      data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_ONLINE_WINDOW_MS + 1_000)) },
    });
    const stale = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}`,
      auth
    );
    expect(stale.body.runtime.liveness).toBe('STALE');

    await prisma.runtimeRegistration.update({
      where: { id: runtimeId },
      data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_STALE_WINDOW_MS + 1_000)) },
    });
    const offline = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}`,
      auth
    );
    expect(offline.body.runtime.liveness).toBe('OFFLINE');
  });

  it('Part E: heartbeat operational audit — valid heartbeat updates state; invalid signature and replay are rejected without corrupting the existing record (both exhaustively covered in runtime-registration-routes.test.ts and real-client-enrollment-e2e.test.ts — this test confirms the operational-read angle, not the protocol itself)', async () => {
    const { runtimeId, identity } = await registerAndActivate(baseUrl, auth, 'LIVOP');
    const before = await prisma.runtimeRegistration.findUnique({ where: { id: runtimeId } });

    // Invalid signature: wrong private key entirely.
    const wrongDir = mkdtempSync(join(tmpdir(), 'atlas-liveness-op-wrongkey-'));
    const wrongIdentity = loadOrCreateIdentity(wrongDir);
    try {
      await expect(
        sendHeartbeat(
          baseUrl,
          { ...wrongIdentity, runtimeId },
          { version: '1.2.0', memory: 999, cpu: 99 }
        )
      ).rejects.toMatchObject({ status: 401, code: 'INVALID_SIGNATURE' });
    } finally {
      rmSync(wrongDir, { recursive: true, force: true });
    }

    // The rejected attempt must not have mutated the previously-good record.
    const afterRejected = await prisma.runtimeRegistration.findUnique({ where: { id: runtimeId } });
    expect(afterRejected?.lastHeartbeat?.getTime()).toBe(before?.lastHeartbeat?.getTime());
    expect(afterRejected?.lastMemoryMb).toBe(before?.lastMemoryMb);

    // A valid heartbeat afterward still works normally.
    const valid = await sendHeartbeat(
      baseUrl,
      { ...identity, runtimeId },
      { version: '1.2.0', memory: 150, cpu: 3 }
    );
    expect(valid.status).toBe('ACTIVE');
    const afterValid = await prisma.runtimeRegistration.findUnique({ where: { id: runtimeId } });
    expect(afterValid?.lastMemoryMb).toBe(150);
  });

  it('Part F/M: a full recovery cycle — ONLINE -> STALE -> OFFLINE -> ONLINE — run twice, with no real sleep', async () => {
    const { runtimeId, identity } = await registerAndActivate(baseUrl, auth, 'RECOV');

    for (let round = 1; round <= 2; round++) {
      const online = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(online.body.runtime.liveness, `round ${round}: expected ONLINE`).toBe('ONLINE');

      await prisma.runtimeRegistration.update({
        where: { id: runtimeId },
        data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_ONLINE_WINDOW_MS + 1_000)) },
      });
      const stale = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(stale.body.runtime.liveness, `round ${round}: expected STALE`).toBe('STALE');

      await prisma.runtimeRegistration.update({
        where: { id: runtimeId },
        data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_STALE_WINDOW_MS + 1_000)) },
      });
      const offline = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(offline.body.runtime.liveness, `round ${round}: expected OFFLINE`).toBe('OFFLINE');

      // Runtime resumes sending real heartbeats -> back to ONLINE.
      const resumed = await sendHeartbeat(
        baseUrl,
        { ...identity, runtimeId },
        { version: '1.2.0', memory: 100, cpu: 1 }
      );
      expect(resumed.status, `round ${round}: expected ACTIVE after resumed heartbeat`).toBe(
        'ACTIVE'
      );
      const backOnline = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(backOnline.body.runtime.liveness, `round ${round}: expected ONLINE again`).toBe(
        'ONLINE'
      );
    }
  });
});
