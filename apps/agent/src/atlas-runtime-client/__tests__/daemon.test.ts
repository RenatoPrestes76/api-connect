import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// See run.test.ts's identical mock for why: the real icacls restriction
// (proven separately, for real, in security/__tests__/credential-
// encryption.test.ts) locks this file to SYSTEM + Administrators, which
// in production is never a problem (the daemon always runs as one
// consistent account, LocalSystem by default) but would block even a
// plain re-read of an already-persisted identity under vitest's
// unprivileged/UAC-filtered test account. This test is about daemon
// scheduling, not ACL enforcement.
vi.mock('../../security/credential-encryption.js', async () => {
  const actual = await vi.importActual<typeof import('../../security/credential-encryption.js')>(
    '../../security/credential-encryption.js'
  );
  return { ...actual, restrictToSystemAndAdministrators: () => {} };
});

import { startDaemon, type DaemonConfig, type DaemonLogger } from '../daemon.js';
import { persistIdentity, type AtlasRuntimeIdentity } from '../identity.js';
import type { schedule as cronSchedule, ScheduledTask } from 'node-cron';

const API_URL = 'https://atlas.test';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FAKE_IDENTITY: AtlasRuntimeIdentity = {
  runtimeId: 'rt_abc',
  publicKeyPem: 'pub',
  privateKeyPem:
    '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEINPZ9wsBdFhu5RSHGUwRqI9LTVZfSOuNVzJZ8hJLnC+e\n-----END PRIVATE KEY-----',
  fingerprint: 'fp-1',
};

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-daemon-test-'));
  dirs.push(dir);
  return dir;
}

function baseConfig(dataDir: string): DaemonConfig {
  return {
    apiUrl: API_URL,
    organizationCode: 'ORG-1',
    activationKey: 'key-123',
    dataDir,
    runtimeVersion: '1.0.0',
    hostname: 'test-host',
    os: 'linux',
    heartbeatIntervalMs: 1_000,
  };
}

/** Captures the cron callback instead of waiting on real cron timing — the test triggers it manually. */
function fakeCronSchedule(): {
  scheduleCron: typeof cronSchedule;
  stop: ReturnType<typeof vi.fn>;
  trigger: () => void;
} {
  let captured: (() => void) | null = null;
  const stop = vi.fn();
  const scheduleCron = ((_expr: string, fn: () => void) => {
    captured = fn;
    return { stop } as unknown as ScheduledTask;
  }) as typeof cronSchedule;
  return { scheduleCron, stop, trigger: () => captured?.() };
}

const logs: Array<{ level: string; message: string }> = [];
const testLogger: DaemonLogger = (level, message) => logs.push({ level, message });

beforeEach(() => {
  logs.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('startDaemon', () => {
  it('registers once at startup and does not re-register on later heartbeats', async () => {
    const dir = tempDir();
    persistIdentity(dir, FAKE_IDENTITY);
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
      })
    );
    const { scheduleCron, trigger } = fakeCronSchedule();

    const handle = await startDaemon(baseConfig(dir), { scheduleCron, logger: testLogger });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/runtime/register'),
      expect.anything()
    );

    trigger(); // one sync tick, should not re-register either
    await new Promise((r) => setTimeout(r, 10));

    await handle.stop();
  });

  it('fires the heartbeat on its own interval, independent of sync', async () => {
    vi.useFakeTimers();
    const dir = tempDir();
    persistIdentity(dir, FAKE_IDENTITY);
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/runtime/heartbeat')) {
        return jsonResponse({
          data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
        });
      }
      throw new Error(`unexpected fetch in heartbeat-only test: ${url}`);
    });
    const { scheduleCron } = fakeCronSchedule();

    const handle = await startDaemon(baseConfig(dir), { scheduleCron, logger: testLogger });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    const heartbeatLogs = logs.filter((l) => l.message.includes('heartbeat ok'));
    expect(heartbeatLogs.length).toBe(3);

    await handle.stop();
  });

  it('stop() halts the heartbeat — no further calls after stopping', async () => {
    vi.useFakeTimers();
    const dir = tempDir();
    persistIdentity(dir, FAKE_IDENTITY);
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
      })
    );
    const { scheduleCron, stop: cronStop } = fakeCronSchedule();

    const handle = await startDaemon(baseConfig(dir), { scheduleCron, logger: testLogger });
    await vi.advanceTimersByTimeAsync(1_000);
    const countBeforeStop = logs.filter((l) => l.message.includes('heartbeat ok')).length;
    expect(countBeforeStop).toBeGreaterThan(0);

    await handle.stop();
    expect(cronStop).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    const countAfterStop = logs.filter((l) => l.message.includes('heartbeat ok')).length;
    expect(countAfterStop).toBe(countBeforeStop); // no new heartbeats fired after stop()
  });

  it('a sync tick runs runSyncCycle via the injected cron trigger', async () => {
    const dir = tempDir();
    persistIdentity(dir, FAKE_IDENTITY);
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/runtime/heartbeat')) {
        return jsonResponse({
          data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
        });
      }
      if (url.includes('/runtime/auth/token')) {
        return jsonResponse({ data: { accessToken: 'tok', refreshToken: 'r', expiresIn: 3600 } });
      }
      if (url.includes('/erp-metadata/runtime/jobs')) {
        return jsonResponse({ data: { total: 0, requests: [] } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const { scheduleCron, trigger } = fakeCronSchedule();

    const handle = await startDaemon(
      { ...baseConfig(dir), heartbeatIntervalMs: 60_000 },
      { scheduleCron, logger: testLogger }
    );

    trigger();
    await new Promise((r) => setTimeout(r, 20));

    expect(logs.some((l) => l.message.includes('sync ok'))).toBe(true);
    await handle.stop();
  });

  it('does not overlap a slow heartbeat with the next scheduled tick', async () => {
    vi.useFakeTimers();
    const dir = tempDir();
    persistIdentity(dir, FAKE_IDENTITY);
    let inFlight = 0;
    let maxConcurrent = 0;
    const resolveFirstBox: { current: (() => void) | null } = { current: null };
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (!url.includes('/runtime/heartbeat')) throw new Error(`unexpected fetch: ${url}`);
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      if (!resolveFirstBox.current) {
        // First call hangs until the test explicitly resolves it.
        await new Promise<void>((resolve) => {
          resolveFirstBox.current = () => resolve();
        });
      }
      inFlight--;
      return jsonResponse({
        data: { runtimeId: 'rt_abc', status: 'ACTIVE', capabilities: [], lastHeartbeat: null },
      });
    });
    const { scheduleCron } = fakeCronSchedule();

    const handle = await startDaemon(baseConfig(dir), { scheduleCron, logger: testLogger });

    await vi.advanceTimersByTimeAsync(1_000); // tick 1 starts, hangs
    await vi.advanceTimersByTimeAsync(1_000); // tick 2 fires — must be skipped, not start a second concurrent call
    await vi.advanceTimersByTimeAsync(1_000); // tick 3 fires — also skipped, first call still in flight

    expect(maxConcurrent).toBe(1);
    resolveFirstBox.current?.();
    await vi.advanceTimersByTimeAsync(0);

    await handle.stop();
  });
});
