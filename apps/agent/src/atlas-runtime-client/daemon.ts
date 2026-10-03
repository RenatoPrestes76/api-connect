/**
 * The real, long-running daemon loop — Sprint A2. Before this existed,
 * `runAtlasRuntimeClient` only ever ran once per manual CLI invocation:
 * the heartbeat protocol was real but never scheduled, so Atlas had no
 * reliable way to know the Runtime was still alive between runs (see
 * docs/ATLAS-AUDIT-REPORT.md's Fase 3, item 8). This is what
 * `cli/bin.ts` starts, and what apps/runtime-installer's Windows service /
 * systemd unit actually execs long-term.
 *
 * Heartbeat and sync run on independent schedules — a 30s heartbeat and a
 * 5-minute discovery-job sync are different cadences for different
 * reasons (liveness vs. actual work), not one combined loop running at
 * whichever interval is shortest.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { join } from 'node:path';
import {
  ensureRegistered,
  runHeartbeatCycle,
  runSyncCycle,
  type AtlasRuntimeClientConfig,
} from './run.js';
import { OfflineQueue } from './offline-queue.js';

export interface DaemonConfig extends AtlasRuntimeClientConfig {
  /** Default 30s — matches the interval apps/api's registration response already suggests (see client.ts's RegisterResult.heartbeatInterval). */
  heartbeatIntervalMs?: number;
  /** node-cron expression. Default every 5 minutes. */
  syncCronExpression?: string;
  /** Pending offline-queue entries older than this are dropped (operator-visible via logs, not retried forever). Default 24h. */
  queueMaxAgeMs?: number;
}

export type DaemonLogLevel = 'info' | 'warn' | 'error';
export type DaemonLogger = (level: DaemonLogLevel, message: string) => void;

export interface DaemonHandle {
  stop(): Promise<void>;
}

/** Injectable for tests — a fake can capture the cron callback instead of waiting on real cron timing. */
export interface DaemonDeps {
  scheduleCron?: typeof cron.schedule;
  logger?: DaemonLogger;
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_SYNC_CRON = '*/5 * * * *';
const DEFAULT_QUEUE_MAX_AGE_MS = 24 * 60 * 60_000;

function defaultLogger(level: DaemonLogLevel, message: string): void {
  const line = `[atlas-daemon] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Registers (if needed) and starts the heartbeat + sync schedules.
 * Returns a handle whose `stop()` cleanly tears both down — callers (the
 * Windows service wrapper, or a SIGTERM handler) must call it before
 * exiting, not just kill the process, so the next start doesn't have to
 * guess at partial state.
 */
export async function startDaemon(
  config: DaemonConfig,
  deps: DaemonDeps = {}
): Promise<DaemonHandle> {
  const log = deps.logger ?? defaultLogger;
  const scheduleCron = deps.scheduleCron ?? cron.schedule;

  const { identity, registered } = await ensureRegistered(config);
  log('info', `Runtime ${identity.runtimeId} ${registered ? 'registered' : 'loaded'}`);

  const queue = new OfflineQueue(join(config.dataDir, 'atlas-runtime-queue.sqlite'));

  let heartbeatInFlight = false;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight) return; // never overlap — a slow call must not pile up concurrent ones
    heartbeatInFlight = true;
    runHeartbeatCycle(config, identity)
      .then((r) => log('info', `heartbeat ok — status=${r.status}`))
      .catch((err) => log('warn', `heartbeat failed: ${errorMessage(err)}`))
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);

  let syncInFlight = false;
  const syncTask: ScheduledTask = scheduleCron(
    config.syncCronExpression ?? DEFAULT_SYNC_CRON,
    () => {
      if (syncInFlight) return;
      syncInFlight = true;
      runSyncCycle(config, identity, queue)
        .then((r) =>
          log(
            'info',
            `sync ok — jobs=${r.jobsSucceeded}/${r.jobsProcessed}, flushedFromQueue=${r.flushedFromQueue}`
          )
        )
        .catch((err) => log('warn', `sync failed: ${errorMessage(err)}`))
        .finally(() => {
          syncInFlight = false;
          queue.pruneOlderThan(config.queueMaxAgeMs ?? DEFAULT_QUEUE_MAX_AGE_MS);
        });
    }
  );

  return {
    async stop() {
      clearInterval(heartbeatTimer);
      syncTask.stop();
      queue.close();
    },
  };
}
