/**
 * ATLAS 46.38 — Production Infrastructure Handoff & Go-Live Lock.
 *
 * Shared, read-only `prisma migrate status` check, extracted so both
 * `production:migrate` (which applies migrations, gated behind
 * --production --yes) and `production:deploy` (which only ever needs to
 * VERIFY status, never apply) call the exact same real check instead of
 * one of them settling for a static comment. Never runs `migrate deploy`,
 * `migrate reset`, or any mutating command — status only.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * @param {string} repoRoot
 * @returns {Promise<{state: 'PASS' | 'FAIL', detail: string, pendingMigrations: boolean | null}>}
 */
export async function checkMigrationStatus(repoRoot) {
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'status'],
      {
        cwd: path.join(repoRoot, 'packages/database'),
        env: process.env,
        shell: process.platform === 'win32',
      }
    );
    const text = stdout.trim();
    const pendingMigrations = /have not yet been applied/i.test(text);
    return { state: 'PASS', detail: text, pendingMigrations };
  } catch (err) {
    return {
      state: 'FAIL',
      detail: err instanceof Error ? err.message : String(err),
      pendingMigrations: null,
    };
  }
}
