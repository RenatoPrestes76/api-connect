#!/usr/bin/env node
/**
 * ATLAS 46.20 — Production Deployment & Runtime Readiness Gate (Fase 14).
 *
 * Run against an already-running apps/api instance (the same use case as a
 * post-deploy smoke check): validates environment, database/migrations,
 * health, readiness, persistence, tenant isolation, authentication, CORS,
 * and the production build artifact, then prints a single verdict line.
 *
 * Usage: node scripts/atlas-production-readiness.mjs [--api-url=http://localhost:3001]
 *
 * Exit code 0 + "ATLAS PRODUCTION READINESS: PASS" only if every check
 * passes. Any critical failure exits 1 with "...: BLOCKED" — this script
 * must never print PASS while a check above failed.
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const apiUrlArg = process.argv.find((a) => a.startsWith('--api-url='));
const API_URL = apiUrlArg ? apiUrlArg.slice('--api-url='.length) : 'http://localhost:3001';

/** @type {{name: string, ok: boolean, detail: string}[]} */
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`);
}

async function getJson(pathname, init) {
  const res = await fetch(`${API_URL}${pathname}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ─── 1. Environment ─────────────────────────────────────────────────────────
async function checkEnvironment() {
  const missing = ['DATABASE_URL', 'API_SECRET_KEY'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    record('Environment', false, `missing required var(s): ${missing.join(', ')}`);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      const mod = await import(
        pathToFileURL(path.join(REPO_ROOT, 'apps/api/dist/services/production-secrets.js')).href
      );
      mod.assertProductionSecretsConfigured('production');
      mod.assertProductionCorsConfigured('production');
      record('Environment', true, 'required vars + production secrets + CORS allowlist present');
    } catch (err) {
      record('Environment', false, err instanceof Error ? err.message : String(err));
    }
    return;
  }

  record(
    'Environment',
    true,
    `required vars present (NODE_ENV=${process.env.NODE_ENV ?? 'development'} — production secret/CORS gate only enforced when NODE_ENV=production)`
  );
}

// ─── 2. Database / migrations ───────────────────────────────────────────────
async function checkDatabaseMigrations() {
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
      'Database/Migrations',
      upToDate,
      upToDate ? 'schema up to date, no pending migrations' : stdout.trim().split('\n').pop()
    );
  } catch (err) {
    record('Database/Migrations', false, err instanceof Error ? err.message : String(err));
  }
}

// ─── 3. Health ───────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const { status, body } = await getJson('/health');
    const ok = status === 200 && body.status === 'healthy';
    record('Health', ok, `GET /health → ${status} ${JSON.stringify(body.checks ?? {})}`);
  } catch (err) {
    record('Health', false, `GET /health unreachable: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── 4. Readiness ────────────────────────────────────────────────────────────
async function checkReadiness() {
  try {
    const { status, body } = await getJson('/ready');
    const ok = status === 200 && body.status === 'ready';
    record('Readiness', ok, `GET /ready → ${status} ${JSON.stringify(body.checks ?? {})}`);
  } catch (err) {
    record('Readiness', false, `GET /ready unreachable: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Auth helper (shared by persistence/isolation/authentication checks) ────
async function login() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@atlasconnect.com.br';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'root102030';
  const { status, body } = await getJson('/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200 || !body.accessToken) {
    throw new Error(`login failed: ${status} ${JSON.stringify(body)}`);
  }
  return { Authorization: `Bearer ${body.accessToken}` };
}

// ─── 5. Authentication ───────────────────────────────────────────────────────
async function checkAuthentication(auth) {
  try {
    const unauth = await getJson('/admin/control-plane/tenants');
    const authed = await getJson('/admin/control-plane/tenants', { headers: auth });
    const ok = unauth.status === 401 && authed.status === 200;
    record(
      'Authentication',
      ok,
      `unauthenticated → ${unauth.status}, authenticated → ${authed.status}`
    );
  } catch (err) {
    record('Authentication', false, err instanceof Error ? err.message : String(err));
  }
}

// ─── 6. Persistence + Tenant isolation ──────────────────────────────────────
// One combined, run-scoped, self-cleaning check: create two tenants + one
// organization each, confirm each is independently readable (persistence),
// then confirm a tenantId-scoped list of one never includes the other's
// organization (isolation) — mirroring apps/api's own
// tenancy-persistence.test.ts, but against the live target being verified.
async function checkPersistenceAndIsolation(auth) {
  const runId = Date.now().toString(36);
  const created = { tenants: [], organizations: [] };
  try {
    const tA = await getJson('/admin/control-plane/tenants', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Readiness A ${runId}`, slug: `readiness-a-${runId}` }),
    });
    const tB = await getJson('/admin/control-plane/tenants', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Readiness B ${runId}`, slug: `readiness-b-${runId}` }),
    });
    created.tenants.push(tA.body.id, tB.body.id);

    const oA = await getJson('/admin/control-plane/organizations', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Org A ${runId}`,
        slug: `readiness-org-a-${runId}`,
        tenantId: tA.body.id,
      }),
    });
    const oB = await getJson('/admin/control-plane/organizations', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Org B ${runId}`,
        slug: `readiness-org-b-${runId}`,
        tenantId: tB.body.id,
      }),
    });
    created.organizations.push(oA.body.id, oB.body.id);

    const reread = await getJson(`/admin/control-plane/tenants/${tA.body.id}`, { headers: auth });
    const persistenceOk = reread.status === 200 && reread.body.id === tA.body.id;
    record('Persistence', persistenceOk, `created tenant re-read by id → ${reread.status}`);

    const listA = await getJson(`/admin/control-plane/organizations?tenantId=${tA.body.id}`, {
      headers: auth,
    });
    const orgIdsForA = (listA.body.organizations ?? []).map((o) => o.id);
    const isolationOk = orgIdsForA.includes(oA.body.id) && !orgIdsForA.includes(oB.body.id);
    record(
      'Tenant Isolation',
      isolationOk,
      `tenant A's organization list includes A's org (${orgIdsForA.includes(oA.body.id)}) and excludes B's org (${!orgIdsForA.includes(oB.body.id)})`
    );
  } catch (err) {
    record('Persistence', false, err instanceof Error ? err.message : String(err));
    record('Tenant Isolation', false, 'skipped — persistence check failed first');
  } finally {
    for (const id of created.organizations) {
      await fetch(`${API_URL}/admin/control-plane/organizations/${id}`, {
        method: 'DELETE',
        headers: auth,
      }).catch(() => undefined);
    }
    for (const id of created.tenants) {
      await fetch(`${API_URL}/admin/control-plane/tenants/${id}`, {
        method: 'DELETE',
        headers: auth,
      }).catch(() => undefined);
    }
  }
}

// ─── 7. CORS ─────────────────────────────────────────────────────────────────
async function checkCors() {
  const configured = process.env.CORS_ALLOWED_ORIGINS;
  if (process.env.NODE_ENV === 'production') {
    const ok = Boolean(configured) && configured.trim() !== '*';
    record(
      'CORS',
      ok,
      ok
        ? `production allowlist configured (${configured.split(',').length} origin(s))`
        : 'production is running with an open/unset CORS_ALLOWED_ORIGINS'
    );
    return;
  }
  record(
    'CORS',
    true,
    `non-production (NODE_ENV=${process.env.NODE_ENV ?? 'development'}) — open CORS is the accepted dev default`
  );
}

// ─── 8. Production build artifact ───────────────────────────────────────────
function checkProductionBuild() {
  const distEntry = path.join(REPO_ROOT, 'apps/api/dist/index.js');
  const ok = existsSync(distEntry);
  record('Production Build', ok, ok ? `${distEntry} present` : `${distEntry} missing — run pnpm build`);
}

async function main() {
  console.log(`\nATLAS Production Readiness — target: ${API_URL}\n`);

  checkProductionBuild();
  await checkEnvironment();
  await checkDatabaseMigrations();
  await checkHealth();
  await checkReadiness();

  let auth;
  try {
    auth = await login();
  } catch (err) {
    record('Authentication', false, `login failed: ${err instanceof Error ? err.message : err}`);
  }
  if (auth) {
    await checkAuthentication(auth);
    await checkPersistenceAndIsolation(auth);
  } else {
    record('Persistence', false, 'skipped — login failed');
    record('Tenant Isolation', false, 'skipped — login failed');
  }

  await checkCors();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length > 0) {
    console.log(`ATLAS PRODUCTION READINESS: BLOCKED (${failed.length} check(s) failed)`);
    process.exitCode = 1;
  } else {
    console.log('ATLAS PRODUCTION READINESS: PASS');
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err);
  console.log('\nATLAS PRODUCTION READINESS: BLOCKED (script crashed)');
  process.exitCode = 1;
});
