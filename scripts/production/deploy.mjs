#!/usr/bin/env node
/**
 * ATLAS 46.37/46.38 — Production Activation Automation & Fail-Loud Gate /
 * Production Infrastructure Handoff & Go-Live Lock.
 *
 * `production:deploy` — orchestrates the full deployment sequence, in the
 * conceptual order the 46.38 provider-neutral deployment contract
 * requires:
 *
 *   PRECHECK -> BUILD -> MIGRATION (status only) -> DEPLOY -> HEALTH
 *   -> READINESS -> SMOKE
 *
 * Any failed or not-actually-executed step stops the sequence and is
 * reported as such — a step is never reported PASS unless it actually
 * ran. This command never applies migrations itself (that remains the
 * separate, explicit, --production --yes gated `production:migrate`); it
 * only reads and reports migration status, so an operator can see
 * pending migrations before choosing to run that command.
 *
 * It also never proceeds to Client Zero (`production:client-zero`,
 * deliberately not chained here) on a deployment/health/readiness
 * failure upstream.
 *
 * Usage:
 *   node scripts/production/deploy.mjs --production
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveProvider } from './provider.mjs';
import { checkMigrationStatus } from './migration-status.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRODUCTION = process.argv.includes('--production');

function step(name) {
  console.log(`\n── ${name} ──`);
}

async function runNode(scriptRelPath, extraArgs = []) {
  const args = [path.join(REPO_ROOT, scriptRelPath), ...extraArgs];
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code ?? 1));
  });
  return exitCode === 0;
}

async function main() {
  console.log('\nATLAS PRODUCTION DEPLOY\n');

  if (!PRODUCTION) {
    console.log('Refusing to run: this command requires --production explicitly.');
    process.exitCode = 1;
    return;
  }

  step('1/7 Precheck (preflight)');
  const preflightOk = await runNode('scripts/production/preflight.mjs', ['--production']);
  if (!preflightOk) {
    console.log('\nSTOPPED at preflight — see failures above. Deployment not attempted.');
    process.exitCode = 1;
    return;
  }

  step('2/7 Build');
  try {
    await execFileAsync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['build'], {
      cwd: REPO_ROOT,
      shell: process.platform === 'win32',
    });
    console.log('Build: PASS (executed)');
  } catch (err) {
    console.log(`Build: FAIL (executed) — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  step('3/7 Migration status (read-only — does not apply anything)');
  const migrationStatus = await checkMigrationStatus(REPO_ROOT);
  if (migrationStatus.state !== 'PASS') {
    console.log(`Migration status: NOT VERIFIABLE (executed, failed) — ${migrationStatus.detail}`);
    console.log('STOPPED — cannot deploy without being able to read migration status against the target database.');
    process.exitCode = 1;
    return;
  }
  console.log(migrationStatus.detail);
  if (migrationStatus.pendingMigrations) {
    console.log(
      '\nMigration status: PENDING (executed) — this deploy will NOT apply them. ' +
        'Run `pnpm production:migrate --production --yes` explicitly, separately, before or after deploying.'
    );
  } else {
    console.log('\nMigration status: UP TO DATE (executed)');
  }

  step('4/7 Deploy (via ProductionProvider)');
  const provider = getActiveProvider();
  const validation = await provider.validate();
  console.log(`Provider validate(): ${validation.state} — ${validation.detail}`);
  if (validation.state !== 'PASS' && validation.state !== 'AVAILABLE') {
    console.log('\nSTOPPED — no usable hosting provider is configured in this environment.');
    console.log('DEPLOYMENT = EXTERNAL/DEFERRED');
    console.log(
      'This is the expected, honest result until a real hosting account/service exists — ' +
        'see docs/deployment/production-first-deployment.md.'
    );
    process.exitCode = 0;
    return;
  }
  const deployResult = await provider.deploy();
  console.log(`Provider deploy(): ${deployResult.state} — ${deployResult.detail}`);
  if (deployResult.state !== 'PASS') {
    process.exitCode = 1;
    return;
  }

  step('5/7 Health + 6/7 Readiness');
  const url = await provider.getDeploymentUrl();
  if (!url) {
    console.log('No deployment URL available from provider — cannot proceed to health/readiness (not verifiable).');
    process.exitCode = 1;
    return;
  }
  const smokeOk = await runNode('scripts/atlas-production-readiness.mjs', [
    `--api-url=${url}`,
    '--production',
  ]);

  step('7/7 Production smoke test');
  console.log(smokeOk ? 'Smoke test: PASS (executed)' : 'Smoke test: FAIL (executed)');
  process.exitCode = smokeOk ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
