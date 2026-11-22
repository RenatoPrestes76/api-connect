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
import {
  downloadNodeRuntime,
  assertAbiMatches,
  verifyBetterSqlite3UnderRuntime,
  verifyDatabaseDriversResolve,
  NODE_RUNTIME_VERSION,
} from './download-node-runtime.mjs';
import { hoistPnpmDeps } from './hoist-pnpm-deps.mjs';

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
  // Fail before any (slow) build work if this build machine's Node isn't
  // ABI-compatible with the pinned bundled runtime — see that function's
  // own doc comment for why this matters specifically for better-sqlite3.
  assertAbiMatches();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Plain `tsc` never deletes a dist/*.js file whose source .ts was
  // removed, and turbo's cache then happily replays that stale dist/
  // forever (the input hash doesn't change just because we deleted a
  // leftover file by hand once) — this bit us for real: a package built
  // right after removing apps/runtime-installer/src/activation/ still
  // shipped the old compiled activation/*.js. Deleting dist/ ourselves
  // first (not relying on tsc or turbo to do it) and forcing past the
  // cache closes both paths to a stale build leaking into the package.
  rmSync(join(ROOT, 'apps/agent/dist'), { recursive: true, force: true });
  rmSync(join(ROOT, 'apps/runtime-installer/dist'), { recursive: true, force: true });

  console.log('\n[1/7] Building apps/agent and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/agent --force');

  console.log('\n[2/7] Building apps/runtime-installer and its workspace dependencies...');
  run('npx turbo run build --filter=@seltriva/runtime-installer --force');

  console.log(
    `\n[3/7] Deploying apps/runtime-installer (production deps only) to ${INSTALLER_DEPLOY_DIR}...`
  );
  // Deploys into OUT directly — OUT is still empty at this point, so this
  // is a valid pnpm deploy target.
  run(`pnpm --filter=@seltriva/runtime-installer deploy --prod "${INSTALLER_DEPLOY_DIR}"`);

  console.log(`\n[4/7] Deploying apps/agent (production deps only) to ${AGENT_DEPLOY_DIR}...`);
  // agent-bundle.ts resolves the bundled agent as a sibling of the
  // installer's own deployed root (<installerRoot>/agent) — see
  // apps/runtime-installer/src/agent-bundle.ts's bundledAgentSourceDir().
  // AGENT_DEPLOY_DIR itself doesn't exist yet (pnpm deploy creates it),
  // which is all the "must be empty" check actually requires — OUT
  // having other content already (dist/, node_modules/, ...) is fine.
  run(`pnpm --filter=@seltriva/agent deploy --prod "${AGENT_DEPLOY_DIR}"`);

  // ATLAS smoke test (docs/ATLAS-SMOKE-TEST.md) caught this for real:
  // `pnpm deploy`'s node_modules relies on NTFS junctions for nested
  // (transitive-only) dependencies like `pg`/`mysql2` — Compress-Archive
  // silently drops those junctions when zipping this folder for
  // distribution, so a package that worked perfectly un-zipped on the
  // build machine failed with "Cannot find package 'pg'" the instant it
  // was extracted anywhere else. See hoist-pnpm-deps.mjs's own doc
  // comment for why this is a flat, one-level hoist and not a full
  // recursive dereference of the tree.
  console.log('\n[5/7] Hoisting transitive pnpm dependencies to the top level (zip-safe)...');
  const installerHoisted = hoistPnpmDeps(INSTALLER_DEPLOY_DIR);
  const agentHoisted = hoistPnpmDeps(AGENT_DEPLOY_DIR);
  console.log(`  hoisted ${installerHoisted} package(s) in the installer, ${agentHoisted} in the agent`);

  console.log(`\n[6/7] Downloading the pinned Node.js v${NODE_RUNTIME_VERSION} runtime (win-x64)...`);
  // bundledNodeRuntimeSourceDir() resolves this as a sibling of the
  // installer's own deployed root too (<installerRoot>/runtime).
  const nodeExePath = await downloadNodeRuntime(join(INSTALLER_DEPLOY_DIR, 'runtime'));

  // `assertAbiMatches()` above already guaranteed this build machine's
  // Node is ABI-compatible with the bundled runtime, so `pnpm deploy`
  // resolved the right better-sqlite3 binary — this is the actual proof,
  // require()-ing it under the bundled node.exe itself, not this
  // machine's Node.
  console.log(`\n[7/7] Verifying better-sqlite3 and every database driver under the bundled Node ${NODE_RUNTIME_VERSION} runtime...`);
  verifyBetterSqlite3UnderRuntime(
    nodeExePath,
    AGENT_DEPLOY_DIR,
    join(OUT, '.better-sqlite3-verify.sqlite')
  );
  rmSync(join(OUT, '.better-sqlite3-verify.sqlite'), { force: true });
  rmSync(join(OUT, '.better-sqlite3-verify.sqlite-wal'), { force: true });
  rmSync(join(OUT, '.better-sqlite3-verify.sqlite-shm'), { force: true });
  verifyDatabaseDriversResolve(nodeExePath, INSTALLER_DEPLOY_DIR, AGENT_DEPLOY_DIR);

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
