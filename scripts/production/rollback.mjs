#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `production:rollback` — identifies the current and previous deployment
 * via the active `ProductionProvider`, requires explicit confirmation,
 * and only actually rolls back when a real provider mechanism exists.
 * Never simulates a rollback and reports it as PASS.
 *
 * Usage:
 *   node scripts/production/rollback.mjs --production --yes
 */
import { getActiveProvider } from './provider.mjs';

const args = process.argv.slice(2);
const PRODUCTION = args.includes('--production');
const CONFIRMED = args.includes('--yes');

async function main() {
  console.log('\nATLAS PRODUCTION ROLLBACK\n');

  if (!PRODUCTION || !CONFIRMED) {
    console.log('Refusing to run: this command requires both --production and --yes, explicitly.');
    process.exitCode = 1;
    return;
  }

  const provider = getActiveProvider();
  const status = await provider.getDeploymentStatus();
  console.log(`Current deployment status: ${status.state} — ${status.detail}`);

  const result = await provider.rollback();
  console.log(`Rollback: ${result.state} — ${result.detail}`);

  if (result.state === 'DEFERRED') {
    console.log('\nROLLBACK = EXTERNAL/DEFERRED — not simulated.');
    process.exitCode = 0;
    return;
  }

  if (result.state !== 'PASS') {
    process.exitCode = 1;
    return;
  }

  const url = await provider.getDeploymentUrl();
  if (url) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      console.log(`Post-rollback health check: ${res.status}`);
    } catch (err) {
      console.log(`Post-rollback health check failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  process.exitCode = 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
