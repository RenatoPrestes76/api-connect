import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import { isValidKeyFormat, keyFingerprint } from '@seltriva/billing';

// GET /api/v1/billing/license
export async function getLicense(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const lic = billingStore.getLicense(tenantId);
  if (!lic) {
    apiError(res, 'License not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, {
    ...lic,
    fingerprint: keyFingerprint(lic.key),
  });
}

// POST /api/v1/billing/license/validate
export async function validateLicense(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { key?: string; tenantId?: string } | undefined;
  if (!body?.key || !body?.tenantId) {
    apiError(res, 'key and tenantId are required', 400, 'VALIDATION_ERROR');
    return;
  }

  if (!isValidKeyFormat(body.key)) {
    json(res, { valid: false, message: 'Invalid license key format' });
    return;
  }

  const result = billingStore.validateLicense(body.key, body.tenantId);
  json(res, result);
}
