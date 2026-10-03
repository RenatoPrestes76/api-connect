import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureRegistered,
  runHeartbeatCycle,
  runSyncCycle,
  type AtlasRuntimeClientConfig,
} from '../run.js';
import { OfflineQueue } from '../offline-queue.js';
import type { AtlasRuntimeIdentity } from '../identity.js';

const API_URL = 'https://atlas.test';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-run-test-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function baseConfig(dataDir: string): AtlasRuntimeClientConfig {
  return {
    apiUrl: API_URL,
    organizationCode: 'ORG-1',
    activationKey: 'key-123',
    dataDir,
    runtimeVersion: '1.0.0',
    hostname: 'test-host',
    os: 'linux',
  };
}

const FAKE_IDENTITY: AtlasRuntimeIdentity = {
  runtimeId: 'rt_abc',
  publicKeyPem: 'pub',
  privateKeyPem:
    '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEINPZ9wsBdFhu5RSHGUwRqI9LTVZfSOuNVzJZ8hJLnC+e\n-----END PRIVATE KEY-----',
  fingerprint: 'fp-1',
};

describe('ensureRegistered', () => {
  it('skips calling /runtime/register when the identity already has a runtimeId', async () => {
    const dir = tempDir();
    const { persistIdentity } = await import('../identity.js');
    persistIdentity(dir, FAKE_IDENTITY);

    const fetchSpy = vi.spyOn(global, 'fetch');
    const { identity, registered } = await ensureRegistered(baseConfig(dir));

    expect(registered).toBe(false);
    expect(identity.runtimeId).toBe('rt_abc');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('registers when the identity has never been enrolled', async () => {
    const dir = tempDir();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          runtimeId: 'rt_new',
          certificate: 'cert',
          organizationId: 'org_1',
          capabilities: [],
          pollingInterval: 30,
          heartbeatInterval: 30,
        },
      })
    );

    const { identity, registered } = await ensureRegistered(baseConfig(dir));
    expect(registered).toBe(true);
    expect(identity.runtimeId).toBe('rt_new');
  });
});

describe('runHeartbeatCycle', () => {
  it('sends one heartbeat and returns its status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
      })
    );
    const result = await runHeartbeatCycle(baseConfig(tempDir()), FAKE_IDENTITY);
    expect(result.status).toBe('ACTIVE');
  });
});

describe('runSyncCycle', () => {
  it('flushes a previously-queued pending result before polling for new jobs', async () => {
    const dir = tempDir();
    const queue = new OfflineQueue(join(dir, 'queue.sqlite'));
    queue.enqueue({ requestId: 'req_old', runtimeId: 'rt_abc', success: true, schema: {} });

    const calls: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/runtime/auth/token')) {
        return jsonResponse({ data: { accessToken: 'tok', refreshToken: 'r', expiresIn: 3600 } });
      }
      if (url.includes('/erp-metadata/runtime/result')) {
        return jsonResponse({
          data: { request: { id: 'req_old', status: 'COMPLETED' }, reused: false },
        });
      }
      if (url.includes('/erp-metadata/runtime/jobs')) {
        return jsonResponse({ data: { total: 0, requests: [] } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSyncCycle(baseConfig(dir), FAKE_IDENTITY, queue);

    expect(result.flushedFromQueue).toBe(1);
    expect(queue.size()).toBe(0); // delivered, removed from the queue
    // The flush must happen before polling for new jobs.
    const resultIdx = calls.findIndex((u) => u.includes('/erp-metadata/runtime/result'));
    const jobsIdx = calls.findIndex((u) => u.includes('/erp-metadata/runtime/jobs'));
    expect(resultIdx).toBeLessThan(jobsIdx);
    queue.close();
  });

  it('enqueues a job result that fails to submit instead of losing it', async () => {
    const dir = tempDir();
    const queue = new OfflineQueue(join(dir, 'queue.sqlite'));

    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/runtime/auth/token')) {
        return jsonResponse({ data: { accessToken: 'tok', refreshToken: 'r', expiresIn: 3600 } });
      }
      if (url.includes('/erp-metadata/runtime/jobs')) {
        return jsonResponse({
          data: {
            total: 1,
            requests: [
              {
                id: 'req_new',
                runtimeId: 'rt_abc',
                organizationId: 'o',
                profileId: 'p',
                status: 'PENDING',
              },
            ],
          },
        });
      }
      if (url.includes('/erp-metadata/runtime/result')) {
        // Simulate the cloud being unreachable for this submission.
        throw new TypeError('fetch failed');
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSyncCycle({ ...baseConfig(dir) }, FAKE_IDENTITY, queue);

    expect(result.jobsProcessed).toBe(1);
    expect(result.jobsSucceeded).toBe(0);
    expect(queue.size()).toBe(1);
    expect(queue.listPending()[0]!.requestId).toBe('req_new');
    queue.close();
  });

  it('a pending entry that still fails to resend stays queued, with the failure recorded', async () => {
    const dir = tempDir();
    const queue = new OfflineQueue(join(dir, 'queue.sqlite'));
    queue.enqueue({ requestId: 'req_old', runtimeId: 'rt_abc', success: true, schema: {} });

    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/runtime/auth/token')) {
        return jsonResponse({ data: { accessToken: 'tok', refreshToken: 'r', expiresIn: 3600 } });
      }
      if (url.includes('/erp-metadata/runtime/result')) {
        throw new TypeError('still unreachable');
      }
      if (url.includes('/erp-metadata/runtime/jobs')) {
        return jsonResponse({ data: { total: 0, requests: [] } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSyncCycle(baseConfig(dir), FAKE_IDENTITY, queue);

    expect(result.flushedFromQueue).toBe(0);
    expect(queue.size()).toBe(1);
    expect(queue.listPending()[0]!.lastError).toContain('unreachable');
    expect(queue.listPending()[0]!.attempts).toBe(1);
    queue.close();
  });
});
