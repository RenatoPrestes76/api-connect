#!/usr/bin/env node
/**
 * ATLAS Runtime Installer
 *
 * Usage:
 *   atlas-install                        # interactive wizard
 *   atlas-install --token ATLAS-XXXX-… # skip token prompt
 *   atlas-install --api-url https://…  # override API base URL
 *   atlas-install --runtime-root /opt/… # override install directory
 *   atlas-install health                 # run health check only
 *   atlas-install --version              # print version and exit
 */

import process from 'node:process';
import { runSetupWizard } from './wizard/setup-wizard.js';
import { registerRuntime, RegistrationError } from './activation/registration.js';
import { getMachineId, detectPlatform } from './utils/platform.js';
import {
  ensureRuntimeDirectories,
  getDefaultRuntimeRoot,
  runtimeDir,
} from './config/directory-setup.js';
import { writeRuntimeConfig, runtimeConfigExists } from './config/runtime-config.js';
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
  if (runtimeConfigExists(runtimeRoot)) {
    process.stderr.write(
      `\n  This machine already has an Atlas runtime configured at:\n` +
        `    ${runtimeRoot}\n\n` +
        `  To reinstall, uninstall first: atlas-install uninstall\n\n`
    );
    process.exit(1);
  }

  const wizard = await runSetupWizard({
    token: flag('--token'),
    apiBaseUrl: apiBaseUrl,
  });

  closeInterface();

  ensureRuntimeDirectories(runtimeRoot);

  const logger = new Logger(runtimeDir(runtimeRoot, 'logs'));
  const platform = detectPlatform();
  const machineId = getMachineId();

  // ── Step 1: Register with the control plane ──────────────────────────────
  process.stdout.write('\n  Registering runtime with the Atlas control plane...\n');
  logger.info('installer.log', `Starting registration for machine ${machineId}`);

  let credentials;
  try {
    credentials = await registerRuntime({
      activationToken: wizard.activationToken,
      name: wizard.name,
      hostname: wizard.hostname,
      machineId,
      version: VERSION,
      connectorType: wizard.connectorType,
      apiBaseUrl: wizard.apiBaseUrl,
    });
  } catch (err) {
    const message = err instanceof RegistrationError ? err.message : String(err);
    process.stderr.write(`\n  Registration failed: ${message}\n\n`);
    logger.error('installer.log', `Registration failed: ${message}`);
    process.exit(1);
  }

  // ── Step 2: Write runtime.json ───────────────────────────────────────────
  process.stdout.write('  Writing runtime configuration...\n');
  writeRuntimeConfig(runtimeRoot, credentials, {
    apiBaseUrl: wizard.apiBaseUrl,
    name: wizard.name,
    hostname: wizard.hostname,
    machineId,
    version: VERSION,
    connectorType: wizard.connectorType,
  });
  logger.info('installer.log', `Runtime config written to ${runtimeRoot}/config/runtime.json`);

  // ── Step 3: Install service ──────────────────────────────────────────────
  if (wizard.installService) {
    process.stdout.write('  Installing system service...\n');
    const svc = new ServiceManager(platform);
    try {
      svc.install({ runtimeRoot, autoStart: wizard.autoStart });
      logger.info('installer.log', 'Service installed successfully');
      if (wizard.autoStart) {
        svc.start();
        logger.info('installer.log', 'Service started');
      }
    } catch (err) {
      const message = (err as Error).message;
      process.stderr.write(`\n  Warning: Could not install service: ${message}\n`);
      process.stderr.write(`  You can start the runtime manually from: ${runtimeRoot}\n\n`);
      logger.warn('installer.log', `Service installation failed: ${message}`);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  process.stdout.write('\n');
  process.stdout.write('  Installation complete!\n');
  process.stdout.write('  ─────────────────────────────────────\n');
  process.stdout.write(`  Runtime ID:  ${credentials.runtimeId}\n`);
  process.stdout.write(`  Company ID:  ${credentials.companyId}\n`);
  process.stdout.write(`  Environment: ${credentials.environment}\n`);
  process.stdout.write(`  Config:      ${runtimeRoot}/config/runtime.json\n`);
  process.stdout.write('  ─────────────────────────────────────\n\n');

  logger.info('installer.log', `Installation complete. runtimeId=${credentials.runtimeId}`);
  logger.close();
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
      svc.uninstall();
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
  --token <token>         Activation token (ATLAS-XXXX-XXXX-XXXX)
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
