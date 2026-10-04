#!/usr/bin/env node
/**
 * Downloads a pinned Node.js Windows x64 build, checksum-verified against
 * the official SHASUMS256.txt — Sprint A2.5. This is what makes the
 * installer self-sufficient on a clean Windows machine with no Node.js
 * pre-installed: the service runs the bundled `node.exe`, not whatever
 * (if anything) happens to be on the target machine's PATH.
 *
 * The version is pinned, not "latest", for one specific reason:
 * `better-sqlite3` ships a prebuilt native addon tied to a Node ABI
 * version (NODE_MODULE_VERSION) — it is NOT an N-API module, so the
 * bundled `node.exe` MUST be ABI-compatible with whatever
 * `better-sqlite3` binary `pnpm deploy` carries into the agent bundle.
 * This pinned version matches the ABI this repo's own dev/build
 * environment resolves `better-sqlite3` against (verified by
 * `assertAbiMatches` below, called from scripts/package-runtime.mjs).
 */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import https from 'node:https';

export const NODE_RUNTIME_VERSION = '20.20.2';
/** NODE_MODULE_VERSION for Node 20.x — see https://nodejs.org/api/n-api.html#node-api-version-matrix and `process.versions.modules`. */
export const NODE_RUNTIME_ABI = 115;

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
 * Fails loudly if the current build environment's Node ABI doesn't match
 * the pinned runtime's ABI — a silent mismatch here would only surface
 * later as the deployed service crashing on `require('better_sqlite3.node')`
 * with "was compiled against a different Node.js version" on the
 * customer's machine, which is much worse than failing the build.
 */
export function assertAbiMatches() {
  const actual = Number(process.versions.modules);
  if (actual !== NODE_RUNTIME_ABI) {
    throw new Error(
      `Node ABI mismatch: this build environment is running Node ABI ${actual} (${process.version}), ` +
        `but the pinned runtime (v${NODE_RUNTIME_VERSION}) is ABI ${NODE_RUNTIME_ABI}. ` +
        `better-sqlite3's prebuilt native addon is tied to the exact ABI it was resolved against — ` +
        `update NODE_RUNTIME_VERSION/NODE_RUNTIME_ABI in scripts/download-node-runtime.mjs to match, ` +
        `or rebuild this environment's Node to the pinned version, before packaging.`
    );
  }
}

// Allow running standalone: `node scripts/download-node-runtime.mjs [destDir]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertAbiMatches();
  const destDir = process.argv[2] ?? join(process.cwd(), 'node-runtime');
  downloadNodeRuntime(destDir)
    .then((p) => console.log(`Saved to ${p}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
