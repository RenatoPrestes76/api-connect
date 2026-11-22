/**
 * Fixes a real packaging bug found during the Sprint A2.6 VM smoke test
 * (docs/ATLAS-SMOKE-TEST.md): `pnpm deploy`'s output relies on NTFS
 * junctions for dependency resolution — EVERY top-level
 * `node_modules/<pkg>` entry is a junction into
 * `node_modules/.pnpm/<pkg>@version/node_modules/<pkg>` (direct
 * dependencies get one automatically from `pnpm deploy` itself;
 * transitive-only ones — e.g. `pg`, needed by
 * `@seltriva/database-sdk`, not directly by the agent — never get a
 * top-level entry at all, only the nested one). Windows'
 * `Compress-Archive`/`Expand-Archive` (the only zip tooling guaranteed
 * present on a bare Windows target machine, per the installer's own
 * self-sufficiency goal) silently DROPS junctions when zipping —
 * confirmed empirically: a package built with Sprint A2.5's original
 * `pnpm deploy`-only pipeline, zipped, and extracted on a clean VM
 * failed with `Cannot find package 'pg'` the instant the installer
 * tried to test an ERP connection, despite working perfectly when run
 * directly from the un-zipped build output on the build machine.
 *
 * The fix, in two passes over this one deploy directory's `node_modules/`:
 *   1. Every top-level entry that's ALREADY a junction (`pg` for the
 *      installer, a direct dependency) gets replaced in place with a
 *      real, ordinary copy of what it points to.
 *   2. Every package that only exists nested under
 *      `node_modules/.pnpm/<pkg>@version/node_modules/<dep>` (a
 *      transitive-only dependency, never given a top-level entry at
 *      all) gets promoted to a new, real, ordinary copy at
 *      `node_modules/<dep>`.
 * Either way, nothing at the top level is ever a junction afterward —
 * nothing left for a zip tool to drop. This is a targeted, one-level
 * fix (not a full recursive dereference of the whole tree): an earlier
 * attempt that dereferenced the ENTIRE tree via `robocopy` instead ran
 * away combinatorially, because several `@seltriva/*` workspace
 * packages reference each other through the SAME shared `.pnpm` store,
 * and a blind "follow every junction, however deep" copy re-explores
 * that shared store from every reachable path into it. Copying just
 * the top-level entries (whether fixing one in place or promoting a
 * missing one) has no such cycle: each one is visited exactly once.
 *
 * Why PowerShell's `Copy-Item`, not `fs.cpSync`: tried `cpSync(src,
 * dest, { recursive: true, dereference: true })` first — it reports
 * success and the result even resolves correctly, but only because it
 * silently copies the JUNCTION itself (still pointing at the original
 * absolute path) rather than dereferencing it, which only surfaces
 * once the package is moved — exactly the zip/extract failure this
 * function exists to prevent. Confirmed empirically with a before/after
 * `(Get-Item ...).Attributes` check: `cpSync`'s copy still had
 * `ReparsePoint` set; PowerShell's `Copy-Item -Recurse` does not have
 * this gap. `dereference` apparently only ever applied to true NTFS
 * symbolic links, not junctions (what pnpm actually creates on
 * Windows, since junctions need no elevated privilege, unlike symlinks).
 */
import { readdirSync, statSync, lstatSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * @param {string} root - a `pnpm deploy` output directory (contains its own `node_modules/`).
 * @returns {number} how many packages were fixed-in-place or hoisted.
 */
export function hoistPnpmDeps(root) {
  const topNodeModules = join(root, 'node_modules');
  const pnpmDir = join(topNodeModules, '.pnpm');
  if (!existsSync(pnpmDir)) return 0;

  /** @type {Array<{src: string, dest: string, replaceJunction: boolean}>} */
  const copies = [];

  // Pass 1: fix every top-level entry that's already a junction (direct deps).
  for (const entry of readdirSync(topNodeModules)) {
    if (entry === '.pnpm' || entry === '.bin' || entry === '.modules.yaml') continue;
    const entryPath = join(topNodeModules, entry);

    if (entry.startsWith('@')) {
      for (const scopedEntry of readdirSync(entryPath)) {
        const scopedPath = join(entryPath, scopedEntry);
        if (lstatSync(scopedPath).isSymbolicLink()) {
          copies.push({ src: scopedPath, dest: scopedPath, replaceJunction: true });
        }
      }
    } else if (lstatSync(entryPath).isSymbolicLink()) {
      copies.push({ src: entryPath, dest: entryPath, replaceJunction: true });
    }
  }

  // Pass 2: promote every transitive-only package that has no top-level entry at all.
  for (const versionedPkg of readdirSync(pnpmDir)) {
    const nestedNodeModules = join(pnpmDir, versionedPkg, 'node_modules');
    if (!existsSync(nestedNodeModules) || !statSync(nestedNodeModules).isDirectory()) continue;

    for (const entry of readdirSync(nestedNodeModules)) {
      if (entry === '.bin' || entry === '.modules.yaml') continue;
      const srcTop = join(nestedNodeModules, entry);
      if (!statSync(srcTop).isDirectory()) continue;

      if (entry.startsWith('@')) {
        for (const scopedEntry of readdirSync(srcTop)) {
          const dest = join(topNodeModules, entry, scopedEntry);
          if (existsSync(dest)) continue; // already real (pass 1) or already hoisted
          copies.push({ src: join(srcTop, scopedEntry), dest, replaceJunction: false });
        }
      } else {
        const dest = join(topNodeModules, entry);
        if (existsSync(dest)) continue;
        copies.push({ src: srcTop, dest, replaceJunction: false });
      }
    }
  }

  if (copies.length === 0) return 0;
  runCopiesViaPowerShell(copies);
  return copies.length;
}

/**
 * One PowerShell invocation for the whole batch (spawning one process per
 * package — there can be hundreds — would be far slower).
 *
 * `replaceJunction` entries have `src === dest` (fixing a junction in
 * place), so the copy must land somewhere else first, then the
 * original junction gets removed (removing a junction/symlink removes
 * just the link, not its target — standard Windows/NTFS behavior), then
 * the real copy is moved into the now-empty final path. Plain hoist
 * entries (`replaceJunction: false`) have a `dest` that doesn't exist
 * yet, and `Copy-Item` just needs its parent directory created first
 * (for scoped packages, `node_modules/@scope/` may not exist yet).
 */
function runCopiesViaPowerShell(copies) {
  const lines = ["$ErrorActionPreference = 'Stop'"];
  for (const { src, dest, replaceJunction } of copies) {
    if (replaceJunction) {
      const tempDest = `${dest}.hoisttmp`;
      // Remove-Item on a reparse-point directory prompts for confirmation
      // in Windows PowerShell 5.1 even with -Force -Confirm:$false (a
      // known quirk of its FileSystemProvider) — [IO.Directory]::Delete
      // bypasses the cmdlet's confirmation machinery entirely. `false`
      // (non-recursive) is exactly right for a junction/symlink: it
      // removes the link itself, never touches whatever it points to.
      lines.push(
        `if (Test-Path -LiteralPath ${psQuote(tempDest)}) { [System.IO.Directory]::Delete(${psQuote(tempDest)}, $true) }`
      );
      lines.push(`Copy-Item -LiteralPath ${psQuote(src)} -Destination ${psQuote(tempDest)} -Recurse -Force`);
      lines.push(`[System.IO.Directory]::Delete(${psQuote(dest)}, $false)`);
      lines.push(`Move-Item -LiteralPath ${psQuote(tempDest)} -Destination ${psQuote(dest)}`);
    } else {
      lines.push(`New-Item -ItemType Directory -Force -Path ${psQuote(dirname(dest))} | Out-Null`);
      lines.push(`Copy-Item -LiteralPath ${psQuote(src)} -Destination ${psQuote(dest)} -Recurse -Force`);
    }
  }
  const scriptPath = join(mkdtempSync(join(tmpdir(), 'hoist-')), 'hoist.ps1');
  writeFileSync(scriptPath, lines.join('\n'), 'utf8');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    rmSync(dirname(scriptPath), { recursive: true, force: true });
  }
}

function psQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
