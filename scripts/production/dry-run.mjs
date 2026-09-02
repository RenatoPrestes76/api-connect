#!/usr/bin/env node
/**
 * ATLAS 46.38 — Production Infrastructure Handoff & Go-Live Lock.
 *
 * `production:dry-run` — a safe validation mode for the whole production
 * pipeline that never talks to real infrastructure and never claims
 * production is available. It checks that the automation LAYER ITSELF is
 * correct: the commands exist, run in the right conceptual order, declare
 * the right preconditions, and — most importantly — that every one of the
 * fail-loud protections this repository depends on (local-database
 * refusal, localhost-as-production refusal, missing-secret refusal,
 * unconfirmed-mutation refusal) actually fires when triggered, verified by
 * really invoking each command with a controlled, cloned environment
 * rather than only reading the source and assuming.
 *
 * This script's own result is ALWAYS `DRY_RUN_ONLY`. It never prints
 * `PRODUCTION_READY` — that determination belongs solely to
 * `production:verify` against a real external target, which this script
 * deliberately never contacts.
 *
 * Usage:
 *   node scripts/production/dry-run.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts', 'production');

/** @type {{name: string, status: 'PASS'|'FAIL', detail: string}[]} */
const checks = [];
function record(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}

/** Run a script with a fully-controlled environment. Never mutates process.env. */
function runWith(scriptRelPath, args, envOverrides) {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [path.join(REPO_ROOT, scriptRelPath), ...args],
      { env: { ...process.env, ...envOverrides }, timeout: 30_000 },
      (err, stdout, stderr) => {
        resolve({ code: err ? (err.code ?? 1) : 0, stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    );
    void child;
  });
}

// A minimal, complete env with every required-in-production secret set to
// an obviously-fake, clearly-labeled placeholder — used only as the
// process env of a throwaway child process for THIS dry-run's own
// behavioral checks, never written to disk, never used against a real
// database or service.
const FAKE_SECRETS = {
  ADMIN_JWT_SECRET: 'dry-run-fake-secret',
  PORTAL_JWT_SECRET: 'dry-run-fake-secret',
  RUNTIME_JWT_SECRET: 'dry-run-fake-secret',
  RUNTIME_CERT_SECRET: 'dry-run-fake-secret',
  CONNECTOR_PACKAGE_SECRET: 'dry-run-fake-secret',
  MESSAGE_DELIVERY_SECRET: 'dry-run-fake-secret',
  SUPABASE_JWT_SECRET: 'dry-run-fake-secret',
  ATLAS_MASTER_KEY: 'dry-run-fake-secret',
  CORS_ALLOWED_ORIGINS: 'https://example.invalid',
};

// ─── 1. Command existence ──────────────────────────────────────────────────
function checkCommandsExist() {
  const expected = [
    'preflight.mjs',
    'migrate.mjs',
    'deploy.mjs',
    'verify.mjs',
    'rollback.mjs',
    'client-zero.mjs',
    'domain.mjs',
    'provider.mjs',
    'migration-status.mjs',
  ];
  const missing = expected.filter((f) => !existsSync(path.join(SCRIPTS_DIR, f)));
  record('Command existence', missing.length === 0, missing.length === 0
    ? `all ${expected.length} scripts present in scripts/production/`
    : `missing: ${missing.join(', ')}`);

  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const expectedCommands = [
    'production:preflight',
    'production:deploy',
    'production:migrate',
    'production:verify',
    'production:client-zero',
    'production:rollback',
    'production:domain',
    'production:dry-run',
  ];
  const missingCommands = expectedCommands.filter((c) => !pkg.scripts?.[c]);
  record('package.json command registration', missingCommands.length === 0, missingCommands.length === 0
    ? `all ${expectedCommands.length} production:* commands registered`
    : `missing from package.json scripts: ${missingCommands.join(', ')}`);
}

// ─── 2. Command order (structural, read from deploy.mjs's own source) ─────
function checkCommandOrder() {
  const source = readFileSync(path.join(SCRIPTS_DIR, 'deploy.mjs'), 'utf8');
  const markers = ['Precheck', 'Build', 'Migration status', 'Deploy (via ProductionProvider)', 'Health', 'Readiness', 'Production smoke test'];
  const positions = markers.map((m) => source.indexOf(m));
  const allFound = positions.every((p) => p !== -1);
  const inOrder = allFound && positions.every((p, i) => i === 0 || p > positions[i - 1]);
  record(
    'Deployment step order',
    inOrder,
    inOrder
      ? `PRECHECK -> BUILD -> MIGRATION -> DEPLOY -> HEALTH -> READINESS -> SMOKE, in that order in deploy.mjs`
      : `expected order not found verbatim in deploy.mjs (markers: ${markers.join(' | ')})`
  );
}

// ─── 3. Preconditions declared consistently between preflight.mjs and the ──
//        production-environment-contract.md this sprint wrote
function checkPreconditionsDeclared() {
  const preflightSource = readFileSync(path.join(SCRIPTS_DIR, 'preflight.mjs'), 'utf8');
  const contractPath = path.join(REPO_ROOT, 'docs/deployment/production-environment-contract.md');
  if (!existsSync(contractPath)) {
    record('Preconditions documented', false, 'docs/deployment/production-environment-contract.md is missing');
    return;
  }
  const contractSource = readFileSync(contractPath, 'utf8');
  const requiredInProduction = [
    'ADMIN_JWT_SECRET', 'PORTAL_JWT_SECRET', 'RUNTIME_JWT_SECRET', 'RUNTIME_CERT_SECRET',
    'CONNECTOR_PACKAGE_SECRET', 'MESSAGE_DELIVERY_SECRET', 'SUPABASE_JWT_SECRET',
    'ATLAS_MASTER_KEY', 'CORS_ALLOWED_ORIGINS',
  ];
  const notInPreflight = requiredInProduction.filter((v) => !preflightSource.includes(v));
  const notInContract = requiredInProduction.filter((v) => !contractSource.includes(v));
  const ok = notInPreflight.length === 0 && notInContract.length === 0;
  record(
    'Preconditions documented',
    ok,
    ok
      ? `all ${requiredInProduction.length} production-required secrets declared consistently in preflight.mjs and production-environment-contract.md`
      : `mismatch — missing from preflight.mjs: [${notInPreflight.join(', ')}], missing from contract: [${notInContract.join(', ')}]`
  );
}

// ─── 4. Real behavioral protections — actually invoke the commands ────────
async function checkLocalDatabaseProtection() {
  const { code, stdout } = await runWith('scripts/production/preflight.mjs', ['--production'], {
    ...FAKE_SECRETS,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/dry_run_fake',
    API_SECRET_KEY: 'dry-run-fake-secret',
  });
  const refused = /FAIL.*Database.*local\/private address|local\/private address/i.test(stdout);
  record(
    'Protection: local DATABASE_URL under --production',
    refused && code === 1,
    refused ? 'preflight.mjs --production correctly refuses a localhost DATABASE_URL' : `did not refuse as expected (exit=${code})`
  );
}

async function checkLocalhostAppProtection() {
  const { code, stdout } = await runWith(
    'scripts/production/preflight.mjs',
    ['--production', '--base-url=http://localhost:3001'],
    {
      ...FAKE_SECRETS,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/dry_run_fake',
      API_SECRET_KEY: 'dry-run-fake-secret',
    }
  );
  const refused = /local\/private address — refusing to treat localhost as production/i.test(stdout);
  record(
    'Protection: localhost --base-url under --production',
    refused && code === 1,
    refused ? 'preflight.mjs --production correctly refuses a localhost --base-url' : `did not refuse as expected (exit=${code})`
  );
}

async function checkMissingSecretsProtection() {
  const { code, stdout } = await runWith('scripts/production/preflight.mjs', ['--production'], {
    DATABASE_URL: 'postgresql://user:pass@db.dry-run-fake.invalid:5432/x',
    API_SECRET_KEY: 'dry-run-fake-secret',
    // Deliberately NOT spreading FAKE_SECRETS — this is the missing-secrets case.
    ADMIN_JWT_SECRET: undefined,
    PORTAL_JWT_SECRET: undefined,
    RUNTIME_JWT_SECRET: undefined,
    RUNTIME_CERT_SECRET: undefined,
    CONNECTOR_PACKAGE_SECRET: undefined,
    MESSAGE_DELIVERY_SECRET: undefined,
    SUPABASE_JWT_SECRET: undefined,
    ATLAS_MASTER_KEY: undefined,
    CORS_ALLOWED_ORIGINS: undefined,
  });
  const refused = /FAIL.*Environment.*missing/i.test(stdout);
  record(
    'Protection: missing production secrets under --production',
    refused && code === 1,
    refused ? 'preflight.mjs --production correctly refuses when production secrets are absent' : `did not refuse as expected (exit=${code})`
  );
}

async function checkHealthReadinessLocalRefusal() {
  const { code, stdout } = await runWith(
    'scripts/atlas-production-readiness.mjs',
    ['--api-url=http://localhost:9999', '--production'],
    {}
  );
  const refused = /Refusing to treat localhost\/Docker-local as production/i.test(stdout);
  record(
    'Health/readiness contract: refuses local target under --production',
    refused && code === 1,
    refused ? 'atlas-production-readiness.mjs --production correctly refuses a local target' : `did not refuse as expected (exit=${code})`
  );
}

async function checkMutationConfirmationGates() {
  const migrateNoFlags = await runWith('scripts/production/migrate.mjs', [], {});
  const migrateRefused = migrateNoFlags.code === 1 && /Refusing to run/i.test(migrateNoFlags.stdout);
  record(
    'Protection: production:migrate requires --production AND --yes',
    migrateRefused,
    migrateRefused ? 'refuses to run without both flags' : `did not refuse as expected (exit=${migrateNoFlags.code})`
  );

  const rollbackNoFlags = await runWith('scripts/production/rollback.mjs', [], {});
  const rollbackRefused = rollbackNoFlags.code === 1 && /Refusing to run/i.test(rollbackNoFlags.stdout);
  record(
    'Protection: production:rollback requires --production AND --yes',
    rollbackRefused,
    rollbackRefused ? 'refuses to run without both flags' : `did not refuse as expected (exit=${rollbackNoFlags.code})`
  );
}

async function checkRollbackContract() {
  const { code, stdout } = await runWith('scripts/production/rollback.mjs', ['--production', '--yes'], {});
  const honest = /ROLLBACK = EXTERNAL\/DEFERRED — not simulated/i.test(stdout);
  record(
    'Rollback contract: never simulates',
    honest && code === 0,
    honest ? 'with no real provider configured, correctly reports EXTERNAL/DEFERRED rather than a fabricated success' : `unexpected output (exit=${code})`
  );
}

async function checkClientZeroDeferred() {
  const { code, stdout } = await runWith('scripts/production/client-zero.mjs', ['--production'], {
    ATLAS_BASE_URL: undefined,
    ATLAS_ADMIN_EMAIL: undefined,
    ATLAS_ADMIN_PASSWORD: undefined,
  });
  const deferred = /CLIENT ZERO = EXTERNAL\/DEFERRED/i.test(stdout);
  record(
    'Client Zero contract: EXTERNAL/DEFERRED when prerequisites absent',
    deferred && code === 0,
    deferred ? 'correctly reports EXTERNAL/DEFERRED, exits 0 (not an error state)' : `unexpected output (exit=${code})`
  );
}

async function main() {
  console.log('\nATLAS PRODUCTION DEPLOYMENT DRY-RUN');
  console.log('This never contacts real infrastructure and never determines production readiness.\n');

  checkCommandsExist();
  checkCommandOrder();
  checkPreconditionsDeclared();
  await checkLocalDatabaseProtection();
  await checkLocalhostAppProtection();
  await checkMissingSecretsProtection();
  await checkHealthReadinessLocalRefusal();
  await checkMutationConfirmationGates();
  await checkRollbackContract();
  await checkClientZeroDeferred();

  const failed = checks.filter((c) => c.status === 'FAIL');
  console.log('');
  if (failed.length > 0) {
    console.log(`RESULT: DRY_RUN_ONLY — ${failed.length} pipeline check(s) FAILED (the automation itself has a gap — see FAIL rows above).`);
    process.exitCode = 1;
  } else {
    console.log(`RESULT: DRY_RUN_ONLY — all ${checks.length} pipeline structure/fail-loud checks passed.`);
    console.log(
      'This confirms the AUTOMATION is correct. It does NOT mean production is available — ' +
        'no real hosting, database, domain, or secret was contacted. Never read this as PRODUCTION_READY.'
    );
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err);
  console.log('\nRESULT: DRY_RUN_ONLY — dry-run crashed, treat as a failure of the automation layer.');
  process.exitCode = 1;
});
