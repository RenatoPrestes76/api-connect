/**
 * Admin-only routes for a company's ERP integration mode. Seltriva staff
 * register/inspect the OFF/ON configuration here — companies never toggle
 * this themselves. No ERP write path, pricing, or sync automation lives here.
 */
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { runWithTenantContext } from '../../../infrastructure/data/tenant-context.js';
import type { ErpIntegrationRepositoryPort } from '../../../modules/erp-integration/erp-integration-repository.js';
import {
  ErpIntegrationResolutionService,
  ErpIntegrationNotConfiguredError,
} from '../../../modules/erp-integration/erp-integration-resolution.service.js';
import { ErpIntegrationHealthChecker } from '../../../modules/erp-integration/erp-integration-health.js';
import type { ErpIntegrationType } from '../../../modules/erp-integration/erp-integration-entity.js';

export interface ErpIntegrationInfrastructureDeps {
  readonly erpIntegrationRepository: ErpIntegrationRepositoryPort;
  /** Checks whether an organization exists — injectable so tests don't need a live database. */
  readonly organizationExists: (organizationId: string) => Promise<boolean>;
}

const VALID_TYPES: ErpIntegrationType[] = ['OFF', 'ON'];

async function requireOrganization(
  organizationId: string,
  res: ServerResponse,
  organizationExists: (organizationId: string) => Promise<boolean>
): Promise<boolean> {
  if (!(await organizationExists(organizationId))) {
    apiError(res, `Organization "${organizationId}" not found`, 404, 'ORGANIZATION_NOT_FOUND');
    return false;
  }
  return true;
}

export function registerErpIntegrationRoutes(
  router: { get: Function; post: Function },
  deps: ErpIntegrationInfrastructureDeps
): void {
  const { erpIntegrationRepository, organizationExists } = deps;
  const resolutionService = new ErpIntegrationResolutionService(erpIntegrationRepository);
  const healthChecker = new ErpIntegrationHealthChecker(erpIntegrationRepository);

  // POST /admin/control-plane/organizations/:id/erp-integration — register/update the mode.
  router.post(
    '/admin/control-plane/organizations/:id/erp-integration',
    requirePermission('erp-integration.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params['id'];
      if (!organizationId) return apiError(res, 'Missing organization id', 400, 'BAD_REQUEST');
      if (!(await requireOrganization(organizationId, res, organizationExists))) return;

      const body = (ctx.body as Record<string, unknown>) ?? {};
      const integrationType = body['integrationType'] as ErpIntegrationType | undefined;
      if (!integrationType || !VALID_TYPES.includes(integrationType)) {
        return apiError(
          res,
          `integrationType must be one of: ${VALID_TYPES.join(', ')}`,
          400,
          'INVALID_INTEGRATION_TYPE'
        );
      }

      const saved = await runWithTenantContext(organizationId, () =>
        erpIntegrationRepository.upsertForCurrentTenant({
          integrationType,
          erpName: body['erpName'] as string | undefined,
          host: body['host'] as string | undefined,
          database: body['database'] as string | undefined,
          schema: body['schema'] as string | undefined,
        })
      );

      json(
        res,
        {
          organizationId: saved.organizationId,
          integrationType: saved.integrationType,
          status: saved.status,
        },
        201
      );
    })
  );

  // GET /admin/control-plane/organizations/:id/erp-integration — resolve the current mode.
  router.get(
    '/admin/control-plane/organizations/:id/erp-integration',
    requirePermission('erp-integration.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params['id'];
      if (!organizationId) return apiError(res, 'Missing organization id', 400, 'BAD_REQUEST');
      if (!(await requireOrganization(organizationId, res, organizationExists))) return;

      try {
        const resolution = await resolutionService.resolve(organizationId);
        json(res, resolution);
      } catch (error) {
        if (error instanceof ErpIntegrationNotConfiguredError) {
          return apiError(res, error.message, 404, error.code);
        }
        throw error;
      }
    })
  );

  // GET /admin/control-plane/organizations/:id/erp-integration/health — structure-only scaffold.
  router.get(
    '/admin/control-plane/organizations/:id/erp-integration/health',
    requirePermission('erp-integration.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params['id'];
      if (!organizationId) return apiError(res, 'Missing organization id', 400, 'BAD_REQUEST');
      if (!(await requireOrganization(organizationId, res, organizationExists))) return;

      try {
        const report = await healthChecker.check(organizationId);
        json(res, report);
      } catch (error) {
        if (error instanceof ErpIntegrationNotConfiguredError) {
          return apiError(res, error.message, 404, error.code);
        }
        throw error;
      }
    })
  );
}
