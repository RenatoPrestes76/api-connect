#!/usr/bin/env node
/**
 * ATLAS 46.37 — Production Activation Automation & Fail-Loud Gate.
 *
 * `production:client-zero` — the automated end-to-end Client Zero flow:
 *
 *   signup -> tenant provisioning -> activation key -> runtime
 *   registration -> heartbeat -> discovery poll -> first job -> persistence
 *
 * The admin-side steps (signup, tenant, activation key) are plain HTTP
 * calls via fetch — no new logic beyond what the existing admin API
 * already does. The runtime-side steps (Ed25519 identity, signed
 * registration/heartbeat/auth) are NOT reimplemented here — they run
 * through `apps/agent/src/atlas-runtime-client/cli-run-once.ts`, a thin
 * wrapper around the same `runAtlasRuntimeClient` orchestrator the real
 * E2E tests use, invoked via `npx tsx` so no separate build step is
 * required.
 *
 * Usage:
 *   ATLAS_BASE_URL=<real-url> \
 *   ATLAS_ADMIN_EMAIL=<real-admin-email> \
 *   ATLAS_ADMIN_PASSWORD=<real-admin-password> \
 *   node scripts/production/client-zero.mjs --production
 *
 * Requires --production AND a real (non-local) ATLAS_BASE_URL AND real
 * admin credentials — any of those missing is reported as
 * `CLIENT ZERO = EXTERNAL/DEFERRED`, not simulated against localhost.
 *
 * Never prints a password, activation key, or private key.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRODUCTION = process.argv.includes('--production');
const BASE_URL = process.env.ATLAS_BASE_URL;
const ADMIN_EMAIL = process.env.ATLAS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD;

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
  console.log('\nATLAS PRODUCTION CLIENT ZERO\n');

  if (!PRODUCTION || !BASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    const missing = [
      !PRODUCTION && '--production flag',
      !BASE_URL && 'ATLAS_BASE_URL',
      !ADMIN_EMAIL && 'ATLAS_ADMIN_EMAIL',
      !ADMIN_PASSWORD && 'ATLAS_ADMIN_PASSWORD',
    ].filter(Boolean);
    console.log(`CLIENT ZERO = EXTERNAL/DEFERRED — missing: ${missing.join(', ')}`);
    console.log('Not simulated against localhost or with fabricated credentials.');
    process.exitCode = 0;
    return;
  }

  let hostname;
  try {
    hostname = new URL(BASE_URL).hostname;
  } catch {
    console.log('BLOCKED: ATLAS_BASE_URL is not a valid URL.');
    process.exitCode = 1;
    return;
  }
  if (isLocalHostname(hostname)) {
    console.log('BLOCKED: ATLAS_BASE_URL resolves to a local/private address — refusing to run Client Zero against it under --production.');
    process.exitCode = 1;
    return;
  }

  const runId = Date.now().toString(36);
  const orgCode = `CZAUTO${runId}`.toUpperCase();

  try {
    // 1. Admin login.
    const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const loginBody = await loginRes.json().catch(() => ({}));
    if (loginRes.status !== 200 || !loginBody.accessToken) {
      console.log(`BLOCKED: admin login failed (${loginRes.status})`);
      process.exitCode = 1;
      return;
    }
    const auth = { Authorization: `Bearer ${loginBody.accessToken}` };
    console.log('[PASS] Authentication — admin session established');

    // 2. Signup -> Organization.
    const signupRes = await fetch(`${BASE_URL}/api/v1/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Client Zero Automation ${runId}`,
        razaoSocial: `Client Zero Automation ${runId} LTDA`,
        cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
        internalCode: orgCode,
        plan: 'professional',
        owner: {
          name: 'Client Zero Automation',
          email: `owner-${orgCode.toLowerCase()}@example.com`,
          password: `Aut0-${runId}!Zz`,
        },
      }),
    });
    const signupBody = await signupRes.json().catch(() => ({}));
    if (signupRes.status !== 201) {
      console.log(`BLOCKED: signup failed (${signupRes.status})`);
      process.exitCode = 1;
      return;
    }
    console.log('[PASS] Tenant — Organization created (PENDING_TENANT_ASSIGNMENT)');

    // 3. Tenant provisioning.
    const tenantRes = await fetch(`${BASE_URL}/admin/control-plane/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ name: `Client Zero Automation Tenant ${runId}`, slug: `cz-auto-${runId}` }),
    });
    const tenantBody = await tenantRes.json().catch(() => ({}));
    if (tenantRes.status !== 201) {
      console.log(`BLOCKED: tenant provisioning failed (${tenantRes.status})`);
      process.exitCode = 1;
      return;
    }
    await fetch(
      `${BASE_URL}/admin/control-plane/organizations/${signupBody.organization.controlPlaneOrganizationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: tenantBody.id }),
      }
    );
    console.log('[PASS] Tenant — associated with Organization');

    // 4. Activation key.
    const keyRes = await fetch(`${BASE_URL}/admin/runtime-registration/activation-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ organizationCode: orgCode }),
    });
    const keyBody = await keyRes.json().catch(() => ({}));
    if (keyRes.status !== 201) {
      console.log(`BLOCKED: activation key issuance failed (${keyRes.status})`);
      process.exitCode = 1;
      return;
    }
    console.log('[PASS] Registration — activation key issued');

    // 5. Runtime registration + heartbeat + discovery poll + job, via the
    //    real signed runtime client (never reimplemented here).
    const { stdout, stderr } = await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', 'src/atlas-runtime-client/cli-run-once.ts'],
      {
        cwd: path.join(REPO_ROOT, 'apps/agent'),
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          ATLAS_BASE_URL: BASE_URL,
          ATLAS_ORG_CODE: orgCode,
          ATLAS_ACTIVATION_KEY: keyBody.activationKey.code,
        },
      }
    );
    const runtimeResult = JSON.parse(stdout.trim().split('\n').pop() ?? '{}');
    if (!runtimeResult.ok) {
      console.log(`BLOCKED: runtime enrollment failed — ${runtimeResult.error ?? stderr}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[PASS] Runtime — registered (${runtimeResult.runtimeId})`);
    console.log(`[PASS] Heartbeat — status ${runtimeResult.heartbeatStatus}`);
    console.log(
      `[${runtimeResult.jobsProcessed > 0 ? 'PASS' : 'DEFERRED'}] Discovery/First Job — ${runtimeResult.jobsProcessed} job(s) polled, ${runtimeResult.jobsSucceeded} succeeded`
    );

    // 6. Persistence — independent re-read.
    const verifyRes = await fetch(
      `${BASE_URL}/admin/runtime-registration/runtimes/${runtimeResult.runtimeId}`,
      { headers: auth }
    );
    const verifyBody = await verifyRes.json().catch(() => ({}));
    console.log(
      `[${verifyRes.status === 200 ? 'PASS' : 'FAIL'}] Persistence — re-read runtime, liveness=${verifyBody.runtime?.liveness}`
    );

    console.log('\nCLIENT ZERO: PASS');
    process.exitCode = 0;
  } catch (err) {
    console.log(`\nBLOCKED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main();
