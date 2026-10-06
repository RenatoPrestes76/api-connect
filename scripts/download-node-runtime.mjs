#!/usr/bin/env node
/**
 * Downloads a pinned Node.js Windows x64 build, checksum-verified against
 * the official SHASUMS256.txt — Sprint A2.5. This is what makes the
 * installer self-sufficient on a clean Windows machine with no Node.js
 * pre-installed: the service runs the bundled `node.exe`, not whatever
 * (if anything) happens to be on the target machine's PATH.
 *
 * Pinned to the Node 24 "Krypton" LTS line — matching the rest of this
 * repo (root package.json `engines.node: "24.x"`, apps/api's
 * `docker/Dockerfile.api` (`node:24-alpine`), and CI). Node 20 reaches
 * end-of-life 2026-04-30; this bundled runtime must move in lockstep with
 * that, not lag behind it.
 *
 * `better-sqlite3` ships a prebuilt native addon tied to an exact Node
 * ABI version (NODE_MODULE_VERSION) — it is NOT an N-API module — so the
 * bundled `node.exe`'s ABI must match whatever `better-sqlite3` binary
 * `pnpm deploy` carries into the agent bundle, which in turn is whatever
 * ABI the machine RUNNING pnpm resolves against. `assertAbiMatches`
 * below fails the build fast if this machine's active Node isn't the
 * pinned runtime's ABI (fix: `nvm use` the matching Node line before
 * packaging). `verifyBetterSqlite3UnderRuntime` is the actual end-to-end
 * proof — it `require()`s the deployed addon under the bundled
 * `node.exe` itself, not this build machine's Node.
 */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import https from 'node:https';

export const NODE_RUNTIME_VERSION = '24.21.0';
/** NODE_MODULE_VERSION for Node 24.x — see https://nodejs.org/api/n-api.html#node-api-version-matrix and `process.versions.modules`. Confirmed empirically: prebuild-install resolves better-sqlite3's Node-24/win32-x64 prebuild asset as `*-node-v137-win32-x64.tar.gz`. */
export const NODE_RUNTIME_ABI = 137;

function fetchBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          fetchBuffer(res.headers.location, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function fetchText(url) {
  return (await fetchBuffer(url)).toString('utf-8');
}

/**
 * Downloads the pinned win-x64 `node.exe` into `destDir/node.exe`,
 * verifying its SHA-256 against Node.js's own published checksums before
 * writing anything to disk. Throws on any mismatch rather than silently
 * shipping an unverified executable.
 */
export async function downloadNodeRuntime(destDir) {
  const base = `https://nodejs.org/dist/v${NODE_RUNTIME_VERSION}`;
  const exeUrl = `${base}/win-x64/node.exe`;
  const shaUrl = `${base}/SHASUMS256.txt`;

  console.log(`Downloading ${exeUrl} ...`);
  const [exeBuffer, shaText] = await Promise.all([fetchBuffer(exeUrl), fetchText(shaUrl)]);

  const expectedLine = shaText.split('\n').find((line) => line.trim().endsWith('win-x64/node.exe'));
  if (!expectedLine) {
    throw new Error(`Could not find a win-x64/node.exe entry in ${shaUrl}`);
  }
  const expectedSha = expectedLine.trim().split(/\s+/)[0].toLowerCase();
  const actualSha = createHash('sha256').update(exeBuffer).digest('hex');
  if (actualSha !== expectedSha) {
    throw new Error(
      `node.exe checksum mismatch for v${NODE_RUNTIME_VERSION} — expected ${expectedSha}, got ${actualSha}. Refusing to ship an unverified executable.`
    );
  }
  console.log(`Checksum verified (sha256 ${actualSha}).`);

  mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, 'node.exe');
  writeFileSync(destPath, exeBuffer);
  try {
    chmodSync(destPath, 0o755);
  } catch {
    // best-effort — irrelevant on Windows, harmless elsewhere
  }
  return destPath;
}

/**
 * Fails loudly, before any (slow) build work, if this build machine's
 * active Node ABI doesn't match the pinned bundled runtime's ABI. A
 * silent mismatch here would only surface later as the deployed service
 * crashing on `require('better_sqlite3.node')` with "was compiled
 * against a different Node.js version" on a customer's machine — far
 * worse than failing the build. Fix on mismatch: `nvm use <the pinned
 * major>` (or install it) before running scripts/package-runtime.mjs.
 */
export function assertAbiMatches() {
  const actual = Number(process.versions.modules);
  if (actual !== NODE_RUNTIME_ABI) {
    throw new Error(
      `Node ABI mismatch: this build machine is running Node ABI ${actual} (${process.version}), ` +
        `but the pinned runtime (v${NODE_RUNTIME_VERSION}) is ABI ${NODE_RUNTIME_ABI}. ` +
        `better-sqlite3's prebuilt native addon is tied to the exact ABI pnpm resolves it against — ` +
        `switch this machine's active Node to match (e.g. nvm use) before packaging.`
    );
  }
}

/**
 * The actual proof that `installBetterSqlite3PrebuildForRuntime` worked:
 * spawns the bundled `node.exe` itself (not this build machine's Node)
 * and has it `require()` the addon for real, open a real on-disk
 * database, and set WAL mode — exactly what the agent daemon does at
 * startup (apps/agent/src/atlas-runtime-client/offline-queue.ts). Throws
 * with the child's stderr on any failure instead of letting a broken
 * package reach a customer's machine.
 */
export function verifyBetterSqlite3UnderRuntime(nodeExePath, agentDeployDir, tmpDbPath) {
  const betterSqlite3Dir = join(agentDeployDir, 'node_modules', 'better-sqlite3');
  const script = `
    const db = require(${JSON.stringify(betterSqlite3Dir)})(${JSON.stringify(tmpDbPath)});
    const journalMode = db.pragma('journal_mode = WAL', { simple: true });
    db.close();
    const actualAbi = Number(process.versions.modules);
    if (actualAbi !== ${NODE_RUNTIME_ABI}) {
      console.error('ABI mismatch: runtime reports ' + actualAbi + ', expected ${NODE_RUNTIME_ABI}');
      process.exit(1);
    }
    if (journalMode !== 'wal') {
      console.error('journal_mode did not switch to wal, got: ' + journalMode);
      process.exit(1);
    }
    console.log('OK abi=' + actualAbi + ' journal=' + journalMode);
  `;
  const output = execFileSync(nodeExePath, ['-e', script], { encoding: 'utf-8' });
  console.log(output.trim());
}

// Allow running standalone: `node scripts/download-node-runtime.mjs [destDir]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const destDir = process.argv[2] ?? join(process.cwd(), 'node-runtime');
  downloadNodeRuntime(destDir)
    .then((p) => console.log(`Saved to ${p}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
