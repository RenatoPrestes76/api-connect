#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `production:preflight` — checks whether this repository + the current
 * environment actually have what a real production deployment needs,
 * before any deploy/migrate command runs. Fail-loud by design: a missing
 * critical requirement is reported as `FAIL` or `BLOCKED`, never silently
 * treated as `PASS`. A requirement that depends on infrastructure this
 * repository cannot provision itself (a hosting account, a real domain,
 * managed backups) is `EXTERNAL/DEFERRED` — a distinct, honest state,
 * never collapsed into `PASS`.
 *
 * Usage:
 *   node scripts/production/preflight.mjs [--production] [--base-url=<url>]
 *
 * `--production` means "treat this as a real production attempt" — it
 * turns on the one check that only matters when someone claims to be
 * deploying for real: refusing a DATABASE_URL or --base-url that points
 * at localhost/127.0.0.1/a private network address. Without it, this is
 * an informational check only (e.g. "how close are we?").
 *
 * Never prints a secret value — only whether a required one is present.
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOfficialDomains } from './domain.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const PRODUCTION_MODE = args.includes('--production');
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const BASE_URL = baseUrlArg
  ? baseUrlArg.slice('--base-url='.length)
  : (process.env.ATLAS_BASE_URL ?? null);

/** @type {{name: string, status: 'PASS'|'FAIL'|'DEFERRED', detail: string}[]} */
const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  const tag = { PASS: '[PASS]', FAIL: '[FAIL]', DEFERRED: '[DEFERRED]' }[status];
  console.log(`${tag} ${name} — ${detail}`);
}

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

// ─── Repository ──────────────────────────────────────────────────────────
async function checkRepository() {
  try {
    const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: REPO_ROOT,
    });
    const { stdout: head } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
    });
    const distEntry = path.join(REPO_ROOT, 'apps/api/dist/index.js');
    const buildOk = existsSync(distEntry);
    record(
      'Repository',
      buildOk ? 'PASS' : 'FAIL',
      `branch=${branch.trim()} commit=${head.trim().slice(0, 12)} build=${buildOk ? 'present' : `missing (${distEntry}) — run pnpm build`}`
    );
  } catch (err) {
    record('Repository', 'FAIL', err instanceof Error ? err.message : String(err));
  }
}

// ─── Environment (secrets: presence only, never values) ─────────────────
function checkEnvironment() {
  const requiredAlways = ['DATABASE_URL', 'API_SECRET_KEY'];
  const requiredInProduction = [
    'ADMIN_JWT_SECRET',
    'PORTAL_JWT_SECRET',
    'RUNTIME_JWT_SECRET',
    'RUNTIME_CERT_SECRET',
    'CONNECTOR_PACKAGE_SECRET',
    'MESSAGE_DELIVERY_SECRET',
    'SUPABASE_JWT_SECRET',
    'ATLAS_MASTER_KEY',
    'CORS_ALLOWED_ORIGINS',
  ];

  const missingAlways = requiredAlways.filter((k) => !process.env[k]);
  const missingProd = requiredInProduction.filter((k) => !process.env[k]);

  if (missingAlways.length > 0) {
    record('Environment', 'FAIL', `missing required var(s): ${missingAlways.join(', ')}`);
    return;
  }
  if (PRODUCTION_MODE && missingProd.length > 0) {
    record(
      'Environment',
      'FAIL',
      `--production requested but missing: ${missingProd.join(', ')} (matches services/production-secrets.ts's fail-loud gate)`
    );
    return;
  }
  if (!PRODUCTION_MODE && missingProd.length > 0) {
    record(
      'Environment',
      'DEFERRED',
      `base vars present; ${missingProd.length} production-only secret(s) not set (expected outside --production)`
    );
    return;
  }
  record('Environment', 'PASS', 'all required vars present (values not inspected or printed)');

  const corsValue = process.env.CORS_ALLOWED_ORIGINS;
  if (PRODUCTION_MODE && corsValue) {
    if (corsValue.trim() === '*' || corsValue.trim() === '') {
      record('CORS configuration', 'FAIL', 'CORS_ALLOWED_ORIGINS is empty or a wildcard in --production mode');
    } else {
      record('CORS configuration', 'PASS', `${corsValue.split(',').length} origin(s) configured`);
    }
  }
}

// ─── Database ─────────────────────────────────────────────────────────────
async function checkDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    record('Database', 'FAIL', 'DATABASE_URL not set');
    return;
  }
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    record('Database', 'FAIL', 'DATABASE_URL is not a valid URL (value not printed)');
    return;
  }
  if (PRODUCTION_MODE && isLocalHostname(hostname)) {
    record(
      'Database',
      'FAIL',
      `--production requested but DATABASE_URL host resolves to a local/private address — refusing to treat a local database as production`
    );
    return;
  }
  try {
    const { stdout } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'status'],
      {
        cwd: path.join(REPO_ROOT, 'packages/database'),
        env: process.env,
        shell: process.platform === 'win32',
      }
    );
    const upToDate = /up to date/i.test(stdout);
    record(
      'Database',
      upToDate ? 'PASS' : 'FAIL',
      upToDate ? 'connected, migrations up to date' : stdout.trim().split('\n').pop()
    );
  } catch (err) {
    record('Database', 'FAIL', `connection/migration check failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Hosting ────────────────────────────────────────────────────────────
function checkHosting() {
  // Render (and most PaaS providers) inject identifying env vars into the
  // process they actually run — a real, standard way to detect "this
  // process is genuinely executing on the platform" without needing an
  // API credential. Absence of these locally is expected, not a failure.
  const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  if (onRender) {
    record(
      'Hosting',
      'PASS',
      `running on Render (service ${process.env.RENDER_SERVICE_ID ?? 'unknown'})`
    );
    return;
  }
  const renderYamlExists = existsSync(path.join(REPO_ROOT, 'render.yaml'));
  record(
    'Hosting',
    'DEFERRED',
    renderYamlExists
      ? 'render.yaml specification present, but no provisioned service detected (not running on Render, no account credential available to check remotely)'
      : 'no hosting specification found'
  );
}

// ─── Domain / DNS ─────────────────────────────────────────────────────────
async function checkDomain() {
  const results = await checkOfficialDomains();
  for (const r of results) {
    record('Domain', r.state, `${r.host} ${r.detail}`);
  }
}

// ─── HTTPS / Application (only if a base URL was actually given) ─────────
async function checkApplication() {
  if (!BASE_URL) {
    record('HTTPS', 'DEFERRED', 'no --base-url/ATLAS_BASE_URL given');
    record('Application', 'DEFERRED', 'no --base-url/ATLAS_BASE_URL given');
    return;
  }
  let parsed;
  try {
    parsed = new URL(BASE_URL);
  } catch {
    record('HTTPS', 'FAIL', 'ATLAS_BASE_URL/--base-url is not a valid URL');
    return;
  }
  if (PRODUCTION_MODE && isLocalHostname(parsed.hostname)) {
    record(
      'HTTPS',
      'FAIL',
      'ATLAS_BASE_URL resolves to a local/private address — refusing to treat localhost as production'
    );
    record('Application', 'FAIL', 'skipped — local address rejected under --production');
    return;
  }
  record(
    'HTTPS',
    parsed.protocol === 'https:' ? 'PASS' : 'DEFERRED',
    parsed.protocol === 'https:' ? `${BASE_URL} uses HTTPS` : `${BASE_URL} is not HTTPS`
  );
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const body = await res.json().catch(() => ({}));
    record(
      'Application',
      res.status === 200 && body.status === 'healthy' ? 'PASS' : 'FAIL',
      `GET /health → ${res.status} ${JSON.stringify(body)}`
    );
  } catch (err) {
    record('Application', 'FAIL', `GET /health unreachable: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  console.log('\nATLAS PRODUCTION PREFLIGHT');
  console.log(`Mode: ${PRODUCTION_MODE ? '--production (strict)' : 'informational'}\n`);

  await checkRepository();
  checkEnvironment();
  await checkDatabase();
  checkHosting();
  await checkDomain();
  await checkApplication();

  const failed = results.filter((r) => r.status === 'FAIL');
  const deferred = results.filter((r) => r.status === 'DEFERRED');

  console.log('');
  if (failed.length > 0) {
    console.log(`RESULT: BLOCKED (${failed.length} check(s) failed)`);
    process.exitCode = 1;
  } else if (deferred.length > 0) {
    console.log(`RESULT: EXTERNAL/DEFERRED (${deferred.length} item(s) depend on infrastructure not yet provisioned)`);
    process.exitCode = 0;
  } else {
    console.log('RESULT: PASS');
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err);
  console.log('\nRESULT: BLOCKED (preflight crashed)');
  process.exitCode = 1;
});
