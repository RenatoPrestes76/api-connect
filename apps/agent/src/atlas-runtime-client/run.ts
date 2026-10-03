/**
 * Orchestrates the Atlas runtime-registration protocol:
 *
 *   load/create identity -> register (if not already) -> heartbeat
 *   -> obtain access token -> poll jobs -> execute + submit each job
 *
 * This is the module apps/agent's bootstrap (Phase 7) calls, and the same
 * module the real E2E test drives directly — no logic is duplicated
 * between "real usage" and "test proof".
 *
 * Sprint A2 split the single pass (`runAtlasRuntimeClient`, kept below
 * unchanged for existing callers — bootstrapper.ts's Phase 7,
 * cli-run-once.ts, and the E2E test) into three independently-callable
 * pieces (`ensureRegistered`, `runHeartbeatCycle`, `runSyncCycle`) so
 * `daemon.ts`'s scheduler can run heartbeat and sync on their own,
 * different schedules instead of only ever together, once.
 */
import { loadavg } from 'node:os';
import { loadOrCreateIdentity, persistIdentity, type AtlasRuntimeIdentity } from './identity.js';
import {
  registerRuntime,
  sendHeartbeat,
  obtainAccessToken,
  pollJobs,
  submitResult,
  AtlasApiError,
  type HeartbeatResult,
  type SubmitResultInput,
} from './client.js';
import { executeDiscoveryScan, type ScanTargetConfig } from './executor.js';
import type { OfflineQueue } from './offline-queue.js';

export interface AtlasRuntimeClientConfig {
  apiUrl: string;
  organizationCode: string;
  activationKey: string;
  dataDir: string;
  runtimeVersion: string;
  hostname: string;
  os: string;
  architecture?: string;
  capabilities?: string[];
  scanTarget?: ScanTargetConfig;
}

export interface AtlasRuntimeClientResult {
  identity: AtlasRuntimeIdentity;
  registered: boolean;
  heartbeatStatus: string;
  jobsProcessed: number;
  jobsSucceeded: number;
}

function currentMetrics(): { memory: number; cpu: number } {
  const memMb = process.memoryUsage().rss / (1024 * 1024);
  // A real, if coarse, system signal — not fabricated — 1-minute load
  // average. Windows always reports 0 here (Node has no loadavg support on
  // win32); that's an honest platform limitation, not a bug in this client.
  const cpu = loadavg()[0];
  return { memory: Math.round(memMb * 10) / 10, cpu };
}

/** Loads the persisted identity, registering with Atlas first if this Runtime never has before. Safe to call repeatedly — a no-op past the first successful registration. */
export async function ensureRegistered(
  config: AtlasRuntimeClientConfig
): Promise<{ identity: AtlasRuntimeIdentity; registered: boolean }> {
  let identity = loadOrCreateIdentity(config.dataDir);
  let registered = false;

  if (!identity.runtimeId) {
    const result = await registerRuntime(config.apiUrl, identity, {
      organizationCode: config.organizationCode,
      activationKey: config.activationKey,
      runtimeVersion: config.runtimeVersion,
      hostname: config.hostname,
      os: config.os,
      architecture: config.architecture,
      capabilities: config.capabilities,
    });
    identity = { ...identity, runtimeId: result.runtimeId };
    persistIdentity(config.dataDir, identity);
    registered = true;
  }

  return { identity, registered };
}

/** One heartbeat. Callers on a schedule should call this directly — a failed heartbeat is never queued/resent, the next scheduled one supersedes it (a heartbeat is a liveness signal, not data to replay). */
export async function runHeartbeatCycle(
  config: AtlasRuntimeClientConfig,
  identity: AtlasRuntimeIdentity
): Promise<HeartbeatResult> {
  const metrics = currentMetrics();
  return sendHeartbeat(config.apiUrl, identity, {
    version: config.runtimeVersion,
    memory: metrics.memory,
    cpu: metrics.cpu,
    uptimeSeconds: Math.floor(process.uptime()),
    capabilities: config.capabilities,
  });
}

export interface SyncCycleResult {
  jobsProcessed: number;
  jobsSucceeded: number;
  flushedFromQueue: number;
}

/**
 * Resends every result still sitting in `queue` (from a previous cycle
 * that couldn't reach the cloud) before polling for new jobs — a resend
 * is safe, not a duplicate: enqueueing is idempotent per `requestId`
 * (see offline-queue.ts), and apps/api's `erp-metadata-store.ts` is
 * independently idempotent per `requestId` too.
 */
async function flushOfflineQueue(
  apiUrl: string,
  accessToken: string,
  queue: OfflineQueue
): Promise<number> {
  let flushed = 0;
  for (const entry of queue.listPending()) {
    try {
      await submitResult(apiUrl, accessToken, entry.payload);
      queue.markDelivered(entry.requestId);
      flushed++;
    } catch (err) {
      const message = err instanceof AtlasApiError ? err.message : String(err);
      queue.recordFailure(entry.requestId, message);
    }
  }
  return flushed;
}

/**
 * Polls for and executes any assigned discovery jobs. A `submitResult`
 * failure (network down, cloud unreachable — `client.ts`'s own retry/
 * backoff already exhausted) enqueues the result into `queue` instead of
 * losing it; the next sync cycle resends it before touching new jobs.
 */
export async function runSyncCycle(
  config: AtlasRuntimeClientConfig,
  identity: AtlasRuntimeIdentity,
  queue: OfflineQueue
): Promise<SyncCycleResult> {
  const { accessToken } = await obtainAccessToken(
    config.apiUrl,
    identity.runtimeId as string,
    identity.privateKeyPem
  );

  const flushedFromQueue = await flushOfflineQueue(config.apiUrl, accessToken, queue);

  const jobs = await pollJobs(config.apiUrl, accessToken);

  let jobsSucceeded = 0;
  for (const job of jobs) {
    let result: SubmitResultInput;
    if (!config.scanTarget) {
      result = {
        requestId: job.id,
        runtimeId: identity.runtimeId as string,
        success: false,
        error: 'No scan target configured on this Runtime',
      };
    } else {
      try {
        const schema = await executeDiscoveryScan(config.scanTarget);
        result = {
          requestId: job.id,
          runtimeId: identity.runtimeId as string,
          success: true,
          schema,
        };
      } catch (err) {
        const message = err instanceof AtlasApiError ? err.message : String(err);
        result = {
          requestId: job.id,
          runtimeId: identity.runtimeId as string,
          success: false,
          error: message,
        };
      }
    }

    try {
      await submitResult(config.apiUrl, accessToken, result);
      if (result.success) jobsSucceeded++;
    } catch (err) {
      // The cloud never got this job's outcome — queue it instead of
      // losing it, rather than the old best-effort .catch(() => undefined).
      queue.enqueue(result);
      const message = err instanceof AtlasApiError ? err.message : String(err);
      queue.recordFailure(job.id, message);
    }
  }

  return { jobsProcessed: jobs.length, jobsSucceeded, flushedFromQueue };
}

/**
 * Runs one full enrollment + heartbeat + discovery pass. Safe to call
 * repeatedly (idempotent registration, fresh signature every call). Kept
 * for existing callers (bootstrapper.ts Phase 7, cli-run-once.ts, the E2E
 * test) with its exact pre-A2 behavior, including a failed submitResult
 * being swallowed rather than queued — a one-shot caller has no
 * persistent queue of its own to later flush, so queueing here would
 * create a SQLite file nobody ever reads again. `daemon.ts` calls
 * `ensureRegistered`/`runHeartbeatCycle`/`runSyncCycle` directly instead,
 * on separate schedules, backed by a real, long-lived `OfflineQueue`.
 */
export async function runAtlasRuntimeClient(
  config: AtlasRuntimeClientConfig
): Promise<AtlasRuntimeClientResult> {
  const { identity, registered } = await ensureRegistered(config);
  const heartbeat = await runHeartbeatCycle(config, identity);

  const { accessToken } = await obtainAccessToken(
    config.apiUrl,
    identity.runtimeId as string,
    identity.privateKeyPem
  );
  const jobs = await pollJobs(config.apiUrl, accessToken);

  let jobsSucceeded = 0;
  for (const job of jobs) {
    try {
      if (!config.scanTarget) {
        await submitResult(config.apiUrl, accessToken, {
          requestId: job.id,
          runtimeId: identity.runtimeId as string,
          success: false,
          error: 'No scan target configured on this Runtime',
        });
        continue;
      }
      const schema = await executeDiscoveryScan(config.scanTarget);
      await submitResult(config.apiUrl, accessToken, {
        requestId: job.id,
        runtimeId: identity.runtimeId as string,
        success: true,
        schema,
      });
      jobsSucceeded++;
    } catch (err) {
      const message = err instanceof AtlasApiError ? err.message : String(err);
      await submitResult(config.apiUrl, accessToken, {
        requestId: job.id,
        runtimeId: identity.runtimeId as string,
        success: false,
        error: message,
      }).catch(() => undefined); // best-effort — the job's own error is more important than a failure to report it
    }
  }

  return {
    identity,
    registered,
    heartbeatStatus: heartbeat.status,
    jobsProcessed: jobs.length,
    jobsSucceeded,
  };
}
