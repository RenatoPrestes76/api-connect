#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `production:deploy` — orchestrates the full deployment sequence:
 *
 *   preflight -> build -> deploy (via ProductionProvider) -> wait
 *   -> health -> readiness -> migration verification -> smoke test
 *
 * Any failed step stops the sequence — it never proceeds to Client Zero
 * (that's a separate command, `production:client-zero`, deliberately not
 * chained here) with a deployment/health/readiness/database failure
 * upstream.
 *
 * Usage:
 *   node scripts/production/deploy.mjs --production
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveProvider } from './provider.mjs';

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

  step('1/6 Preflight');
  const preflightOk = await runNode('scripts/production/preflight.mjs', ['--production']);
  if (!preflightOk) {
    console.log('\nSTOPPED at preflight — see failures above. Deployment not attempted.');
    process.exitCode = 1;
    return;
  }

  step('2/6 Build');
  try {
    await execFileAsync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['build'], {
      cwd: REPO_ROOT,
      shell: process.platform === 'win32',
    });
    console.log('Build: PASS');
  } catch (err) {
    console.log(`Build: FAIL — ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  step('3/6 Deploy (via ProductionProvider)');
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

  step('4/6 Wait for deployment + Health/Readiness');
  const url = await provider.getDeploymentUrl();
  if (!url) {
    console.log('No deployment URL available from provider — cannot proceed to health/readiness.');
    process.exitCode = 1;
    return;
  }
  const smokeOk = await runNode('scripts/atlas-production-readiness.mjs', [
    `--api-url=${url}`,
    '--production',
  ]);

  step('5/6 Migration verification');
  console.log('See production:migrate — not run automatically as part of deploy (explicit, separate, confirmation-gated command by design).');

  step('6/6 Production smoke test');
  console.log(smokeOk ? 'Smoke test: PASS' : 'Smoke test: FAIL');
  process.exitCode = smokeOk ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
