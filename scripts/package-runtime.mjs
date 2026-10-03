#!/usr/bin/env node
/**
 * Builds a real, distributable Atlas Runtime package — Sprint A2.
 *
 * Before this existed, apps/runtime-installer registered a Windows
 * service / systemd unit pointing at a binary (`atlas-runtime.exe`) that
 * no build step anywhere in this repo ever produced (see
 * docs/ATLAS-AUDIT-REPORT.md). This script is that missing build step:
 * it produces a standalone, deployable folder containing the real daemon
 * (apps/agent, built + its production dependencies flattened via `pnpm
 * deploy` — the same mechanism docker/Dockerfile.api already uses for
 * apps/api) plus the installer that knows how to copy it into place and
 * register it as a service (see apps/runtime-installer/src/agent-bundle.ts).
 *
 * Usage: node scripts/package-runtime.mjs [outputDir]
 * Output layout:
 *   <outputDir>/
 *     dist/index.js   <- atlas-install entrypoint (run this on the target machine)
 *     agent/           <- the deployed apps/agent bundle (what the installer copies into runtimeRoot)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, process.argv[2] ?? 'dist-runtime-package');
const AGENT_DEPLOY_DIR = join(OUT, '.agent-deploy-tmp');
const INSTALLER_DEPLOY_DIR = OUT;

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  console.log('\n[1/4] Building apps/agent and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/agent');

  console.log('\n[2/4] Building apps/runtime-installer and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/runtime-installer');

  console.log(`\n[3/4] Deploying apps/agent (production deps only) to ${AGENT_DEPLOY_DIR}...`);
  run(`pnpm --filter=@seltriva/agent deploy --prod "${AGENT_DEPLOY_DIR}"`);

  console.log(`\n[4/4] Deploying apps/runtime-installer (production deps only) to ${INSTALLER_DEPLOY_DIR}...`);
  // Deploys into OUT directly — OUT already has no 'dist'/'node_modules'
  // of its own yet, so this is the installer's deploy root.
  run(`pnpm --filter=@seltriva/runtime-installer deploy --prod "${INSTALLER_DEPLOY_DIR}"`);

  // agent-bundle.ts resolves the bundled agent as a sibling of the
  // installer's own deployed root (<installerRoot>/agent) — see
  // apps/runtime-installer/src/agent-bundle.ts's bundledAgentSourceDir().
  const agentDestInsideInstaller = join(INSTALLER_DEPLOY_DIR, 'agent');
  cpSync(AGENT_DEPLOY_DIR, agentDestInsideInstaller, { recursive: true });
  rmSync(AGENT_DEPLOY_DIR, { recursive: true, force: true });

  if (!existsSync(join(INSTALLER_DEPLOY_DIR, 'dist', 'index.js'))) {
    throw new Error('Packaging finished but dist/index.js is missing — pnpm deploy did not produce the expected layout.');
  }

  console.log(`\nDone. Distributable package: ${INSTALLER_DEPLOY_DIR}`);
  console.log('On the target machine (Node.js already installed), run:');
  console.log(`  node "${join(INSTALLER_DEPLOY_DIR, 'dist', 'index.js')}"`);
}

main();
