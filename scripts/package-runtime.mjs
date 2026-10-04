#!/usr/bin/env node
/**
 * Builds a real, distributable, self-sufficient Atlas Runtime package —
 * Sprint A2 / A2.5.
 *
 * Before this existed, apps/runtime-installer registered a Windows
 * service / systemd unit pointing at a binary (`atlas-runtime.exe`) that
 * no build step anywhere in this repo ever produced (see
 * docs/ATLAS-AUDIT-REPORT.md). This script is that missing build step:
 * it produces a standalone, deployable folder containing the real daemon
 * (apps/agent, built + its production dependencies flattened via `pnpm
 * deploy` — the same mechanism docker/Dockerfile.api already uses for
 * apps/api), the pinned/checksummed Node.js runtime the Windows service
 * actually execs (so the target machine never needs Node pre-installed —
 * Sprint A2.5), and the installer that wires both into place.
 *
 * Usage: node scripts/package-runtime.mjs [outputDir]
 * Output layout:
 *   <outputDir>/
 *     dist/index.js   <- atlas-install entrypoint (run this on the target machine)
 *     agent/           <- the deployed apps/agent bundle (what the installer copies into runtimeRoot)
 *     runtime/node.exe <- the pinned, checksum-verified Node runtime (Windows only; what the installer copies + the service execs)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadNodeRuntime, assertAbiMatches, NODE_RUNTIME_VERSION } from './download-node-runtime.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, process.argv[2] ?? 'dist-runtime-package');
const INSTALLER_DEPLOY_DIR = OUT;
// `pnpm deploy`'s "destination must be empty" check applies only to the
// exact target directory, not its ancestors — deploying the agent
// directly into OUT/agent (created fresh, empty, after the installer
// deploy already populated OUT with dist/+node_modules/) works, and lets
// pnpm's own deploy logic build the node_modules symlink graph in place.
// An earlier version of this script deployed the agent into a separate
// temp dir and `cpSync`'d it in afterward — that broke better-sqlite3 at
// runtime ("Cannot find module 'bindings'"): pnpm's node_modules relies
// on directory symlinks for nested dependency resolution, and a generic
// recursive copy (even with `dereference: true`) does not reliably
// reconstruct that graph.
const AGENT_DEPLOY_DIR = join(INSTALLER_DEPLOY_DIR, 'agent');

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

async function main() {
  // Fail before doing any (slow) build work if this environment's Node
  // isn't ABI-compatible with the pinned runtime — see that function's
  // own doc comment for why this matters specifically for better-sqlite3.
  assertAbiMatches();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  console.log('\n[1/5] Building apps/agent and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/agent');

  console.log('\n[2/5] Building apps/runtime-installer and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/runtime-installer');

  console.log(
    `\n[3/5] Deploying apps/runtime-installer (production deps only) to ${INSTALLER_DEPLOY_DIR}...`
  );
  // Deploys into OUT directly — OUT is still empty at this point, so this
  // is a valid pnpm deploy target.
  run(`pnpm --filter=@seltriva/runtime-installer deploy --prod "${INSTALLER_DEPLOY_DIR}"`);

  console.log(`\n[4/5] Deploying apps/agent (production deps only) to ${AGENT_DEPLOY_DIR}...`);
  // agent-bundle.ts resolves the bundled agent as a sibling of the
  // installer's own deployed root (<installerRoot>/agent) — see
  // apps/runtime-installer/src/agent-bundle.ts's bundledAgentSourceDir().
  // AGENT_DEPLOY_DIR itself doesn't exist yet (pnpm deploy creates it),
  // which is all the "must be empty" check actually requires — OUT
  // having other content already (dist/, node_modules/, ...) is fine.
  run(`pnpm --filter=@seltriva/agent deploy --prod "${AGENT_DEPLOY_DIR}"`);

  console.log(`\n[5/5] Downloading the pinned Node.js v${NODE_RUNTIME_VERSION} runtime (win-x64)...`);
  // bundledNodeRuntimeSourceDir() resolves this as a sibling of the
  // installer's own deployed root too (<installerRoot>/runtime).
  await downloadNodeRuntime(join(INSTALLER_DEPLOY_DIR, 'runtime'));

  if (!existsSync(join(INSTALLER_DEPLOY_DIR, 'dist', 'index.js'))) {
    throw new Error(
      'Packaging finished but dist/index.js is missing — pnpm deploy did not produce the expected layout.'
    );
  }
  if (!existsSync(join(INSTALLER_DEPLOY_DIR, 'runtime', 'node.exe'))) {
    throw new Error('Packaging finished but runtime/node.exe is missing.');
  }

  console.log(`\nDone. Distributable package: ${INSTALLER_DEPLOY_DIR}`);
  console.log('Self-sufficient — Node.js does NOT need to be pre-installed on the target machine.');
  console.log('On the target machine, run:');
  console.log(`  "${join(INSTALLER_DEPLOY_DIR, 'runtime', 'node.exe')}" "${join(INSTALLER_DEPLOY_DIR, 'dist', 'index.js')}"`);
}

main().catch((err) => {
  console.error(`\nPackaging failed: ${err.message}`);
  process.exit(1);
});
