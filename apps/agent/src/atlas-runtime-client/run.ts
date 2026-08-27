/**
 * Orchestrates one full pass of the Atlas runtime-registration protocol:
 *
 *   load/create identity -> register (if not already) -> heartbeat
 *   -> obtain access token -> poll jobs -> execute + submit each job
 *
 * This is the module apps/agent's bootstrap (Phase 7) calls, and the same
 * module the real E2E test drives directly — no logic is duplicated
 * between "real usage" and "test proof".
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
} from './client.js';
import { executeDiscoveryScan, type ScanTargetConfig } from './executor.js';

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

/** Runs one full enrollment + discovery pass. Safe to call repeatedly (idempotent registration, fresh signature every call). */
export async function runAtlasRuntimeClient(
  config: AtlasRuntimeClientConfig
): Promise<AtlasRuntimeClientResult> {
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

  const metrics = currentMetrics();
  const heartbeat = await sendHeartbeat(config.apiUrl, identity, {
    version: config.runtimeVersion,
    memory: metrics.memory,
    cpu: metrics.cpu,
    uptimeSeconds: Math.floor(process.uptime()),
    capabilities: config.capabilities,
  });

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
