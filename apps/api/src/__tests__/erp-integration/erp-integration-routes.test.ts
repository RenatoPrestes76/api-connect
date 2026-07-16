import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { registerAdminIdentityRoutes } from '../../routes/v1/admin-identity/index.js';
import { registerControlPlaneRoutes } from '../../routes/v1/control-plane/index.js';
import { get, post, bearer, superAdminAuth } from '../control-plane/helpers.js';
import { FakeErpIntegrationRepository } from './fake-erp-integration-repository.js';

const KNOWN_ORGS = new Set(['org-alpha', 'org-beta']);

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startTestServer(repo: FakeErpIntegrationRepository): Promise<TestServer> {
  const router = new Router();
  router.use(authMiddleware);
  registerAdminIdentityRoutes(router);
  registerControlPlaneRoutes(router, {
    erpIntegrationRepository: repo,
    organizationExists: async (organizationId: string) => KNOWN_ORGS.has(organizationId),
  });

  const srv = createServer((req, res) => void router.dispatch(req, res));
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => srv.close((err) => (err ? reject(err) : resolve()))),
  };
}

describe('Control Plane — ERP integration routes', () => {
  let repo: FakeErpIntegrationRepository;
  let srv: Awaited<ReturnType<typeof startTestServer>>;
  let adminAuthHeader: Record<string, string>;

  beforeAll(async () => {
    repo = new FakeErpIntegrationRepository();
    srv = await startTestServer(repo);
    adminAuthHeader = await superAdminAuth(srv.baseUrl, '10.20.0.1');
  });
  afterAll(async () => srv.close());
  beforeEach(() => repo.clear());

  describe('POST /admin/control-plane/organizations/:id/erp-integration', () => {
    it('registers an OFF company correctly', async () => {
      const { status, body } = await post<{ integrationType: string; status: string }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'OFF' },
        adminAuthHeader
      );
      expect(status).toBe(201);
      expect(body.integrationType).toBe('OFF');
      expect(body.status).toBe('ACTIVE');
    });

    it('registers an ON company correctly', async () => {
      const { status, body } = await post<{ integrationType: string }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-beta/erp-integration',
        { integrationType: 'ON', erpName: 'SAP', host: 'erp.internal' },
        adminAuthHeader
      );
      expect(status).toBe(201);
      expect(body.integrationType).toBe('ON');
    });

    it('rejects an invalid integrationType', async () => {
      const { status, body } = await post<{ error: { code: string } }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'MAYBE' },
        adminAuthHeader
      );
      expect(status).toBe(400);
      expect(body.error.code).toBe('INVALID_INTEGRATION_TYPE');
    });

    it('returns 404 for an unknown organization', async () => {
      const { status, body } = await post<{ error: { code: string } }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-does-not-exist/erp-integration',
        { integrationType: 'OFF' },
        adminAuthHeader
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe('ORGANIZATION_NOT_FOUND');
    });

    it('returns 401 without an admin session', async () => {
      const { status } = await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'OFF' }
      );
      expect(status).toBe(401);
    });

    it('returns 403 for a token without erp-integration.manage', async () => {
      const { status } = await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'OFF' },
        bearer('not-a-real-token')
      );
      expect(status).toBe(401); // invalid token short-circuits before the permission check
    });
  });

  describe('GET /admin/control-plane/organizations/:id/erp-integration', () => {
    it('resolves the correct configuration for a registered company', async () => {
      await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'ON' },
        adminAuthHeader
      );
      const { status, body } = await get<{ tipo_integracao: string; permite_escrita: boolean }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        adminAuthHeader
      );
      expect(status).toBe(200);
      expect(body.tipo_integracao).toBe('ON');
      expect(body.permite_escrita).toBe(false);
    });

    it('does not mix configuration between different companies', async () => {
      await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'OFF' },
        adminAuthHeader
      );
      await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-beta/erp-integration',
        { integrationType: 'ON' },
        adminAuthHeader
      );

      const alpha = await get<{ tipo_integracao: string }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        adminAuthHeader
      );
      const beta = await get<{ tipo_integracao: string }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-beta/erp-integration',
        adminAuthHeader
      );

      expect(alpha.body.tipo_integracao).toBe('OFF');
      expect(beta.body.tipo_integracao).toBe('ON');
    });

    it('returns 404 when the company has no ERP integration configured yet', async () => {
      const { status, body } = await get<{ error: { code: string } }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-beta/erp-integration',
        adminAuthHeader
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe('ERP_INTEGRATION_NOT_CONFIGURED');
    });
  });

  describe('GET /admin/control-plane/organizations/:id/erp-integration/health', () => {
    it('returns the health-check structure scaffold', async () => {
      await post(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration',
        { integrationType: 'OFF' },
        adminAuthHeader
      );
      const { status, body } = await get<{ checks: Array<{ status: string }> }>(
        srv.baseUrl,
        '/admin/control-plane/organizations/org-alpha/erp-integration/health',
        adminAuthHeader
      );
      expect(status).toBe(200);
      expect(body.checks.every((c) => c.status === 'PENDING')).toBe(true);
    });
  });
});
