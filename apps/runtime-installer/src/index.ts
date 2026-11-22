#!/usr/bin/env node
/**
 * ATLAS Runtime Installer
 *
 * Usage:
 *   atlas-install                        # interactive wizard
 *   atlas-install --api-url https://…  # override API base URL
 *   atlas-install --runtime-root /opt/… # override install directory
 *   atlas-install health                 # run health check only
 *   atlas-install --version              # print version and exit
 */

import process from 'node:process';
import { runSetupWizard } from './wizard/setup-wizard.js';
import { detectPlatform } from './utils/platform.js';
import {
  ensureRuntimeDirectories,
  getDefaultRuntimeRoot,
  runtimeDir,
  agentEntrypointPath,
  runtimeNodeExecPath,
  erpConnectionFilePath,
} from './config/directory-setup.js';
import { installAgentBundle, installNodeRuntime } from './agent-bundle.js';
import { writeErpConnection } from './erp-connection/erp-connection-store.js';
import { ServiceManager } from './service/service-manager.js';
import { runHealthCheck } from './health/health-checker.js';
import { Logger } from './logs/logger.js';
import { closeInterface } from './utils/readline-utils.js';

const VERSION = '0.1.0';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const subcommand = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
const flag = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
};
const hasFlag = (name: string): boolean => args.includes(name);

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (hasFlag('--version') || hasFlag('-v')) {
    process.stdout.write(`atlas-install ${VERSION}\n`);
    process.exit(0);
  }

  if (hasFlag('--help') || hasFlag('-h')) {
    printHelp();
    process.exit(0);
  }

  const runtimeRoot = flag('--runtime-root') ?? getDefaultRuntimeRoot();
  const apiBaseUrl = flag('--api-url') ?? process.env['ATLAS_API_URL'];

  if (subcommand === 'health') {
    await runHealthCommand(runtimeRoot, apiBaseUrl ?? 'https://api.seltriva.com');
    return;
  }

  if (subcommand === 'uninstall') {
    await runUninstallCommand(runtimeRoot);
    return;
  }

  await runInstallCommand(runtimeRoot, apiBaseUrl);
}

// ─── Install command ──────────────────────────────────────────────────────────

async function runInstallCommand(runtimeRoot: string, apiBaseUrl?: string): Promise<void> {
  const platform = detectPlatform();
  const svc = new ServiceManager(platform);

  if (svc.exists()) {
    process.stderr.write(
      `\n  This machine already has an Atlas runtime service installed.\n\n` +
        `  To reinstall, uninstall first: atlas-install uninstall\n\n`
    );
    process.exit(1);
  }

  const wizard = await runSetupWizard({ apiBaseUrl });

  closeInterface();

  ensureRuntimeDirectories(runtimeRoot);

  const logger = new Logger(runtimeDir(runtimeRoot, 'logs'));

  // ── Step 1: Copy the agent bundle ────────────────────────────────────────
  if (wizard.installService) {
    process.stdout.write('\n  Copying the Atlas runtime agent...\n');
    try {
      installAgentBundle(runtimeRoot);
    } catch (err) {
      const message = (err as Error).message;
      process.stderr.write(`\n  Could not install the agent bundle: ${message}\n\n`);
      logger.error('installer.log', `Agent bundle install failed: ${message}`);
      process.exit(1);
    }

    // Windows only — makes the service self-sufficient: it runs the
    // bundled, checksum-verified node.exe (scripts/download-node-
    // runtime.mjs), never whatever (if anything) is on the target
    // machine's own PATH. Linux keeps using the system `node` that ran
    // this installer (process.execPath, via linux-service.ts).
    let execPath: string | undefined;
    if (platform === 'windows') {
      process.stdout.write('  Copying the bundled Node.js runtime...\n');
      try {
        installNodeRuntime(runtimeRoot);
        execPath = runtimeNodeExecPath(runtimeRoot);
      } catch (err) {
        const message = (err as Error).message;
        process.stderr.write(`\n  Could not install the bundled Node runtime: ${message}\n\n`);
        logger.error('installer.log', `Node runtime install failed: ${message}`);
        process.exit(1);
      }
    }

    // ── Step 1.5: Persist the ERP connection, encrypted ─────────────────────
    // The password is encrypted (DPAPI LocalMachine) and the file
    // ACL-restricted — see erp-connection-store.ts. Only the FILE PATH
    // goes into the service's env (ATLAS_ERP_CONNECTION_FILE); unlike
    // the old ATLAS_SCAN_DB_* approach, no secret ever touches the
    // WinSW-generated XML (see docs/ATLAS-RUNTIME-CLIENT.md).
    const erpConnectionFile = erpConnectionFilePath(runtimeRoot);
    if (wizard.erpConnection) {
      try {
        writeErpConnection(erpConnectionFile, wizard.erpConnection);
        logger.info('installer.log', `ERP connection stored at ${erpConnectionFile}`);
      } catch (err) {
        const message = (err as Error).message;
        process.stderr.write(`\n  Could not store the ERP connection: ${message}\n\n`);
        logger.error('installer.log', `ERP connection store failed: ${message}`);
        process.exit(1);
      }
    }

    // ── Step 2: Install service ────────────────────────────────────────────
    process.stdout.write('  Installing system service...\n');
    const scriptPath = agentEntrypointPath(runtimeRoot);
    try {
      await svc.install({
        runtimeRoot,
        autoStart: wizard.autoStart,
        scriptPath,
        execPath,
        env: {
          ATLAS_API_URL: wizard.apiBaseUrl,
          ATLAS_ORGANIZATION_CODE: wizard.organizationCode,
          ATLAS_ACTIVATION_KEY: wizard.atlasActivationKey,
          ATLAS_RUNTIME_DATA_DIR: runtimeDir(runtimeRoot, 'agent-data'),
          ...(wizard.erpConnection ? { ATLAS_ERP_CONNECTION_FILE: erpConnectionFile } : {}),
        },
      });
      logger.info('installer.log', 'Service installed successfully');
      if (wizard.autoStart) {
        try {
          // svc.install() (above) only returns once the Windows Service
          // Control Manager has genuinely finished registering the
          // service (see windows-service.ts's waitForServiceRegistration
          // doc comment) — so starting it here, in this same process,
          // right away, is expected to just work. No manual step.
          await svc.start();
          logger.info('installer.log', 'Service started');
        } catch (startErr) {
          const message = (startErr as Error).message;
          process.stderr.write(
            `\n  Warning: Service installed, but could not start it: ${message}\n`
          );
          process.stderr.write(`  Check the logs and try: sc.exe start atlasruntime.exe\n\n`);
          logger.warn('installer.log', `Service start failed: ${message}`);
        }
      }
    } catch (err) {
      const message = (err as Error).message;
      process.stderr.write(`\n  Warning: Could not install service: ${message}\n`);
      process.stderr.write(`  You can start the runtime manually from: ${runtimeRoot}\n\n`);
      logger.warn('installer.log', `Service installation failed: ${message}`);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  // There is no runtimeId to report here — registration with Atlas (the
  // real Ed25519 protocol, apps/agent/src/atlas-runtime-client/) happens
  // lazily on the daemon's first start, not synchronously during install.
  process.stdout.write('\n');
  process.stdout.write('  Installation complete!\n');
  process.stdout.write('  ─────────────────────────────────────\n');
  process.stdout.write(`  Name:        ${wizard.name}\n`);
  process.stdout.write(`  Hostname:    ${wizard.hostname}\n`);
  process.stdout.write(`  Environment: ${wizard.environment}\n`);
  process.stdout.write(`  Runtime root: ${runtimeRoot}\n`);
  process.stdout.write('  ─────────────────────────────────────\n\n');

  logger.info('installer.log', `Installation complete at ${runtimeRoot}`);
  await logger.close();
}

// ─── Health command ───────────────────────────────────────────────────────────

async function runHealthCommand(runtimeRoot: string, apiBaseUrl: string): Promise<void> {
  process.stdout.write('\n  ATLAS Runtime Health Check\n');
  process.stdout.write('  ─────────────────────────────────────\n');

  const report = await runHealthCheck({ runtimeRoot, apiBaseUrl });

  for (const check of report.checks) {
    const icon = check.ok ? '[OK]' : '[FAIL]';
    process.stdout.write(`  ${icon.padEnd(7)} ${check.name.padEnd(14)} ${check.message}\n`);
  }

  process.stdout.write('  ─────────────────────────────────────\n');
  process.stdout.write(`  Overall: ${report.ok ? 'HEALTHY' : 'UNHEALTHY'}\n\n`);

  if (!report.ok) process.exit(1);
}

// ─── Uninstall command ────────────────────────────────────────────────────────

async function runUninstallCommand(runtimeRoot: string): Promise<void> {
  process.stdout.write('\n  Uninstalling Atlas Runtime...\n');
  const platform = detectPlatform();
  const svc = new ServiceManager(platform);

  if (svc.exists()) {
    try {
      await svc.uninstall({ scriptPath: agentEntrypointPath(runtimeRoot) });
      process.stdout.write('  Service removed.\n');
    } catch (err) {
      process.stderr.write(`  Warning: ${(err as Error).message}\n`);
    }
  }

  process.stdout.write(`  Configuration left at: ${runtimeRoot}\n`);
  process.stdout.write('  Remove that directory manually to fully clean up.\n\n');
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stdout.write(`
atlas-install v${VERSION}

Usage:
  atlas-install [options]          Interactive installation wizard
  atlas-install health [options]   Run health checks
  atlas-install uninstall          Remove the system service

Options:
  --api-url <url>         API base URL (default: https://api.seltriva.com)
  --runtime-root <path>   Installation directory
  --version               Print version
  --help                  Show this help

Environment variables:
  ATLAS_API_URL           Override API base URL
  NODE_ENV=development    Allow self-signed TLS certificates

`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  process.stderr.write(`\n  Unexpected error: ${(err as Error).message}\n\n`);
  process.exit(1);
});
