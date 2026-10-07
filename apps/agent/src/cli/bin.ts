#!/usr/bin/env node
/**
 * Real entrypoint for the long-running Atlas Runtime daemon — Sprint A2.
 * This is what `package.json`'s `bin` field and apps/runtime-installer's
 * Windows service / systemd unit actually exec (`node dist/cli/bin.js`),
 * closing the gap docs/ATLAS-AUDIT-REPORT.md found: the package declared
 * this exact path as its `bin` entry, but no file existed here at all.
 *
 * Required env vars: ATLAS_API_URL, ATLAS_ORGANIZATION_CODE,
 * ATLAS_ACTIVATION_KEY. Optional: ATLAS_RUNTIME_DATA_DIR,
 * ATLAS_HEARTBEAT_INTERVAL_MS, ATLAS_SYNC_CRON_EXPRESSION,
 * ATLAS_ERP_CONNECTION_FILE (path to the encrypted ERP connection the
 * installer wrote — see atlas-runtime-client/erp-connection-store.ts;
 * Sprint A2.6 replaced the old ATLAS_SCAN_DB_* env vars, which put the
 * ERP password in plain text in the Windows service's env block).
 *
 * Never logs the activation key, private key, ERP password, or any
 * other secret — only the Runtime's own public-facing id and cycle
 * outcomes.
 */
import { hostname, platform, arch } from 'node:os';
import { join } from 'node:path';
import { startDaemon, type DaemonConfig } from '../atlas-runtime-client/daemon.js';
import { loadErpScanTarget } from '../atlas-runtime-client/erp-connection-store.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[atlas-runtime] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function buildConfig(): DaemonConfig {
  const apiUrl = requiredEnv('ATLAS_API_URL');
  const organizationCode = requiredEnv('ATLAS_ORGANIZATION_CODE');
  const activationKey = requiredEnv('ATLAS_ACTIVATION_KEY');
  const dataDir = process.env['ATLAS_RUNTIME_DATA_DIR'] ?? join(process.cwd(), '.atlas-runtime');

  const erpConnectionFile = process.env['ATLAS_ERP_CONNECTION_FILE'];
  const scanTarget = erpConnectionFile ? loadErpScanTarget(erpConnectionFile) : undefined;

  return {
    apiUrl,
    organizationCode,
    activationKey,
    dataDir,
    runtimeVersion: process.env['ATLAS_RUNTIME_VERSION'] ?? '1.0.0',
    hostname: hostname(),
    os: platform(),
    architecture: arch(),
    scanTarget,
    heartbeatIntervalMs: process.env['ATLAS_HEARTBEAT_INTERVAL_MS']
      ? Number(process.env['ATLAS_HEARTBEAT_INTERVAL_MS'])
      : undefined,
    syncCronExpression: process.env['ATLAS_SYNC_CRON_EXPRESSION'],
  };
}

async function main(): Promise<void> {
  const config = buildConfig();
  console.log(`[atlas-runtime] Starting — api=${config.apiUrl} host=${config.hostname}`);

  const handle = await startDaemon(config);
  console.log('[atlas-runtime] Daemon started — heartbeat and sync are now scheduled.');

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[atlas-runtime] Received ${signal} — shutting down gracefully.`);
    handle
      .stop()
      .then(() => {
        console.log('[atlas-runtime] Stopped cleanly.');
        process.exit(0);
      })
      .catch((err) => {
        console.error(
          `[atlas-runtime] Error during shutdown: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(
    `[atlas-runtime] Fatal startup error: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
});
