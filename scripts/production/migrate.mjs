#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `production:migrate` — a safety-gated wrapper around
 * `prisma migrate deploy` (never `migrate reset`, `db push --force-reset`,
 * or any other destructive command — this script does not expose those).
 *
 * Usage:
 *   node scripts/production/migrate.mjs --production --yes
 *
 * Requires BOTH flags to actually run:
 *   --production   declares intent — this is not an accidental local run
 *   --yes          explicit confirmation, so a bare invocation can never
 *                  mutate a real database by accident
 *
 * Refuses to run if DATABASE_URL resolves to a local/private address
 * while `--production` is set — the exact same guard `preflight.mjs`
 * uses, applied here because this command actually mutates a database
 * rather than just reporting on one.
 *
 * Never prints DATABASE_URL or any other secret value.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const PRODUCTION = args.includes('--production');
const CONFIRMED = args.includes('--yes');

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

async function main() {
  console.log('\nATLAS PRODUCTION MIGRATE\n');

  if (!PRODUCTION || !CONFIRMED) {
    console.log(
      'Refusing to run: this command requires both --production and --yes, explicitly, ' +
        'every time — there is no default-yes mode for a command that mutates a database.'
    );
    process.exitCode = 1;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('BLOCKED: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    console.log('BLOCKED: DATABASE_URL is not a valid URL (value not printed).');
    process.exitCode = 1;
    return;
  }
  if (isLocalHostname(hostname)) {
    console.log(
      'BLOCKED: --production was passed but DATABASE_URL resolves to a local/private ' +
        'address. Refusing to run production migrations against what looks like a local database.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('Checking migration status before applying anything...');
  try {
    const { stdout: statusBefore } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'status'],
      { cwd: path.join(REPO_ROOT, 'packages/database'), env: process.env, shell: process.platform === 'win32' }
    );
    console.log(statusBefore.trim());
  } catch (err) {
    console.log(`BLOCKED: could not read migration status: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nApplying migrations (prisma migrate deploy — additive/versioned only)...');
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'deploy'],
      { cwd: path.join(REPO_ROOT, 'packages/database'), env: process.env, shell: process.platform === 'win32' }
    );
    const migrationCount = (stdout.match(/Applying migration/g) ?? []).length;
    console.log(stdout.trim());
    console.log(`\nmigration status: applied`);
    console.log(`migration count:  ${migrationCount} applied this run`);
    console.log('migration result: PASS');
    process.exitCode = 0;
  } catch (err) {
    console.log(`\nmigration result: FAIL`);
    console.log(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
