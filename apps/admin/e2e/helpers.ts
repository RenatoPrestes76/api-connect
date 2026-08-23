import { generateKeyPairSync, sign } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Sprint 46.16 — real-browser E2E helpers.
 *
 * Fixture setup (organization/Runtime/discovery/etc.) talks directly to the
 * real apps/api backend (port 3001) over plain HTTP — the same contracts
 * already exercised by apps/api's own vitest suite all along this project.
 * This is NOT a mock: it is the same JSON API the browser itself calls
 * through the Next.js proxy. Only *setup* bypasses the proxy (to seed a
 * known state fast); every actual assertion in the specs happens through
 * real browser navigation against apps/admin.
 *
 * Credentials: never hardcoded as "real" secrets — these are the project's
 * own seeded local/dev fixtures (the same ATLAS-DEMO-0001 activation key and
 * SUPER_ADMIN login already committed and used across every apps/api test
 * helper in this repo), overridable via env vars for any other environment.
 */

export const API_BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

export const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@atlasconnect.com.br';
export const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'root102030';

// ─── UI-level auth (what every spec actually validates) ────────────────────

export async function loginViaUI(
  page: Page,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function logoutViaUI(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Atlas Super Admin/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
}

/**
 * Logs in and lands on /dashboard regardless of the seeded demo account's
 * `mustChangePassword` flag (which would otherwise redirect to
 * /change-password on first login of a freshly-started apps/api process —
 * unrelated to this sprint's scope, so we navigate past it deterministically
 * rather than exercising the change-password flow in every other spec).
 */
export async function loginAndGoToDashboard(page: Page): Promise<void> {
  await loginViaUI(page);
  await page.waitForURL(/\/(dashboard|change-password)/);
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard');
  }
}

// ─── Raw backend fixture setup (bypasses the Next.js proxy on purpose) ────

interface RuntimeKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

function generateRuntimeKeyPair(): RuntimeKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function signPayload(privateKeyPem: string, payload: string): string {
  return sign(null, Buffer.from(payload), privateKeyPem).toString('base64');
}

async function adminLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE_URL}/admin/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'x-forwarded-for': '127.0.0.10' },
  });
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

export interface OperationalFixture {
  organizationId: string;
  organizationCode: string;
  runtimeId: string;
  profileId: string;
  discoveryRequestId: string;
}

/**
 * Builds the full operational chain via real API calls: tenant -> enrollment
 * -> Runtime register -> connection profile -> discovery request -> Runtime
 * claims + reports a fixture ERP schema -> semantic-mapping analyze+approve
 * -> canonical-model build. Every step is a genuine HTTP call against the
 * same backend the browser will read from afterward.
 */
export async function buildOperationalFixture(
  request: APIRequestContext,
  options: { autoApprove?: boolean; autoBuildCanonical?: boolean } = {}
): Promise<OperationalFixture> {
  const { autoApprove = true, autoBuildCanonical = true } = options;
  const adminToken = await adminLogin(request);
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  const orgCode = `E2E${Date.now().toString(36)}`;

  // 1. Tenant
  const orgRes = await request.post(`${API_BASE_URL}/api/v1/portal/auth/register`, {
    data: {
      name: `Empresa ${orgCode}`,
      razaoSocial: `Empresa ${orgCode} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001${Math.floor(Math.random() * 100)}`,
      internalCode: orgCode,
      plan: 'starter',
      owner: {
        name: 'Owner E2E',
        email: `owner-${orgCode.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwnerE2E123!',
      },
    },
  });
  const { organization } = (await orgRes.json()) as { organization: { id: string } };
  const organizationId = organization.id;

  // 2. Enrollment code bound to that tenant
  const keyRes = await request.post(`${API_BASE_URL}/admin/runtime-registration/activation-keys`, {
    data: { organizationCode: orgCode },
    headers: adminAuth,
  });
  const { activationKey } = (await keyRes.json()) as { activationKey: { code: string } };

  // 3. Runtime registers using the enrollment code (never picks its own tenant)
  const keyPair = generateRuntimeKeyPair();
  const registerRes = await request.post(`${API_BASE_URL}/runtime/register`, {
    data: {
      organizationCode: orgCode,
      activationKey: activationKey.code,
      runtimeVersion: '1.2.0',
      fingerprint: `fp-e2e-${Math.random()}`,
      publicKey: keyPair.publicKeyPem,
      hostname: 'e2e-runtime.local',
      os: 'linux',
      architecture: 'x64',
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    },
  });
  const registerBody = (await registerRes.json()) as { data: { runtimeId: string } };
  const runtimeId = registerBody.data.runtimeId;

  // 4. Runtime authenticates operationally (JWT session, not the enrollment code)
  const authTimestamp = new Date().toISOString();
  const authSignature = signPayload(
    keyPair.privateKeyPem,
    JSON.stringify({ runtimeId, timestamp: authTimestamp })
  );
  const tokenRes = await request.post(`${API_BASE_URL}/runtime/auth/token`, {
    data: { runtimeId, timestamp: authTimestamp, signature: authSignature },
  });
  const { accessToken: runtimeToken } = (await tokenRes.json()) as { accessToken: string };
  const runtimeAuth = { Authorization: `Bearer ${runtimeToken}` };

  // 5. Heartbeat
  const hbTimestamp = new Date().toISOString();
  const hbPayload = JSON.stringify({
    runtimeId,
    version: '1.2.0',
    memory: 256,
    cpu: 4.2,
    status: null,
    timestamp: hbTimestamp,
  });
  const hbSignature = signPayload(keyPair.privateKeyPem, hbPayload);
  await request.post(`${API_BASE_URL}/runtime/heartbeat`, {
    data: {
      runtimeId,
      version: '1.2.0',
      memory: 256,
      cpu: 4.2,
      timestamp: hbTimestamp,
      signature: hbSignature,
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    },
  });

  // Connection profile (ERP)
  const profileRes = await request.post(`${API_BASE_URL}/erp-connectivity/profiles`, {
    data: {
      runtimeId,
      organizationId,
      name: 'ERP E2E',
      dbType: 'POSTGRESQL',
      host: 'db.e2e.local',
      port: 5432,
      database: 'erp_e2e',
      username: 'erp_user',
      password: 'S3nhaSuperSecretaE2E!',
    },
    headers: adminAuth,
  });
  const { profile } = (await profileRes.json()) as { profile: { id: string } };
  const profileId = profile.id;

  // 6. Discovery job
  const discoverRes = await request.post(`${API_BASE_URL}/erp-metadata/discover`, {
    data: { runtimeId, organizationId, profileId },
    headers: adminAuth,
  });
  const { request: discoveryRequest } = (await discoverRes.json()) as {
    request: { id: string };
  };
  const discoveryRequestId = discoveryRequest.id;

  // 7. Runtime claims + 8. reports a fixture schema
  await request.get(`${API_BASE_URL}/erp-metadata/runtime/jobs`, { headers: runtimeAuth });
  await request.post(`${API_BASE_URL}/erp-metadata/runtime/result`, {
    data: {
      requestId: discoveryRequestId,
      runtimeId,
      success: true,
      schema: buildFixtureSchema(),
    },
    headers: runtimeAuth,
  });

  // 9. Semantic Mapping analyze (+ optionally approve every suggestion —
  // callers validating the UI's own approve action leave this false so a
  // real PENDING mapping is still there to click through).
  await request.post(`${API_BASE_URL}/semantic-mapping/analyze`, {
    data: { profileId },
    headers: adminAuth,
  });
  if (autoApprove) {
    const entitiesRes = await request.get(
      `${API_BASE_URL}/semantic-mapping/entities?profileId=${profileId}`,
      { headers: adminAuth }
    );
    const { entities } = (await entitiesRes.json()) as {
      entities: Array<{ schema: string; table: string }>;
    };
    for (const mapping of entities) {
      await request.post(`${API_BASE_URL}/semantic-mapping/approve`, {
        data: { profileId, schema: mapping.schema, table: mapping.table, decision: 'APPROVE' },
        headers: adminAuth,
      });
    }
  }

  // 10. Canonical Model build
  if (autoApprove && autoBuildCanonical) {
    await request.post(`${API_BASE_URL}/canonical-model/build`, {
      data: { organizationId },
      headers: adminAuth,
    });
  }

  return { organizationId, organizationCode: orgCode, runtimeId, profileId, discoveryRequestId };
}

function buildFixtureSchema(): unknown {
  const col = (name: string, type: string, overrides: Record<string, unknown> = {}) => ({
    name,
    type,
    nullable: overrides['nullable'] ?? true,
    isPrimaryKey: overrides['isPrimaryKey'] ?? false,
    isForeignKey: overrides['isForeignKey'] ?? false,
    isUnique: overrides['isUnique'] ?? false,
  });
  return {
    name: 'erp_e2e',
    tables: [
      {
        name: 'produtos',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('codigo', 'varchar', { nullable: false, isUnique: true }),
          col('descricao', 'varchar', { nullable: false }),
          col('preco_venda', 'numeric'),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [],
        indexes: [],
      },
      {
        name: 'estoque',
        columns: [
          col('id', 'serial', { nullable: false, isPrimaryKey: true, isUnique: true }),
          col('produto_id', 'integer', { nullable: false, isForeignKey: true }),
          col('quantidade', 'numeric'),
        ],
        primaryKey: { columns: ['id'] },
        foreignKeys: [
          { column: 'produto_id', referencedTable: 'produtos', referencedColumn: 'id' },
        ],
        indexes: [],
      },
    ],
    relations: [],
    discoveredAt: new Date(),
  };
}
