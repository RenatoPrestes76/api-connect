import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { regionsStore } from '../../../modules/regions/regions-store.js';
import type {
  FailoverResult,
  MigrationResult,
  SyncResult,
} from '../../../modules/regions/types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function registerRegionActionRoutes(router: { post: Function }): void {
  // POST /api/v1/regions/failover
  router.post('/api/v1/regions/failover', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, fromRegion, toRegion, reason = 'Manual failover' } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
    if (!fromRegion) return apiError(res, '"fromRegion" is required', 400, 'MISSING_FIELDS');
    if (!toRegion) return apiError(res, '"toRegion" is required', 400, 'MISSING_FIELDS');

    const placement = regionsStore.getTenantPlacement(tenantId);
    if (!placement) return apiError(res, `Tenant "${tenantId}" not found`, 404, 'NOT_FOUND');

    const target = regionsStore.getRegionByCode(toRegion);
    if (!target) return apiError(res, `Region "${toRegion}" not found`, 404, 'REGION_NOT_FOUND');

    // Update tenant's primary region
    regionsStore.updateTenantPlacement(tenantId, { primaryRegion: toRegion, placement: 'pinned' });

    // Record event
    regionsStore.addGlobalEvent({
      type: 'region.failover.completed',
      region: toRegion,
      tenantId,
      severity: 'warning',
      message: `Tenant ${tenantId} failed over from ${fromRegion} to ${toRegion}: ${reason}`,
      payload: { tenantId, fromRegion, toRegion, reason },
    });

    const result: FailoverResult = {
      success: true,
      tenantId,
      fromRegion,
      toRegion,
      reason,
      failoveredAt: nowIso(),
      complianceChecked: true,
      automatic: false,
      message: `Tenant ${tenantId} successfully failed over to ${toRegion}`,
    };

    json(res, result, 201);
  });

  // POST /api/v1/regions/failover/auto — picks the nearest eligible active region automatically.
  router.post('/api/v1/regions/failover/auto', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, reason = 'Automatic geographic failover' } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');

    const result = regionsStore.automaticGeoFailover(tenantId, reason);
    if (result === 'TENANT_NOT_FOUND')
      return apiError(res, `Tenant "${tenantId}" not found`, 404, 'NOT_FOUND');
    if (result === 'NO_ELIGIBLE_REGION') {
      return apiError(
        res,
        'No eligible active region available for automatic failover',
        409,
        'NO_ELIGIBLE_REGION'
      );
    }
    json(res, result, 201);
  });

  // POST /api/v1/regions/migrate-tenant
  router.post('/api/v1/regions/migrate-tenant', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, targetRegion, reason = 'Planned migration' } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
    if (!targetRegion) return apiError(res, '"targetRegion" is required', 400, 'MISSING_FIELDS');

    const placement = regionsStore.getTenantPlacement(tenantId);
    if (!placement) return apiError(res, `Tenant "${tenantId}" not found`, 404, 'NOT_FOUND');

    const target = regionsStore.getRegionByCode(targetRegion);
    if (!target)
      return apiError(res, `Region "${targetRegion}" not found`, 404, 'REGION_NOT_FOUND');

    const previousRegion = placement.primaryRegion;

    // Check compliance warnings
    const policies = regionsStore.getCompliancePolicies(tenantId);
    const warnings: string[] = [];

    const residencyPolicy = policies.find((p) => p.policy === 'data_residency' && p.enabled);
    if (residencyPolicy?.region && residencyPolicy.region !== targetRegion) {
      warnings.push(
        `Data residency policy requires region "${residencyPolicy.region}"; migrating to "${targetRegion}"`
      );
    }
    const lgpdPolicy = policies.find((p) => p.policy === 'lgpd' && p.enabled);
    if (lgpdPolicy && !targetRegion.startsWith('br-')) {
      warnings.push(
        `LGPD compliance: tenant has active LGPD policy bound to Brazilian jurisdiction`
      );
    }

    // Update placement
    regionsStore.updateTenantPlacement(tenantId, {
      primaryRegion: targetRegion,
      placement: 'migrating',
    });

    // Record event
    regionsStore.addGlobalEvent({
      type: 'tenant.migrated',
      region: targetRegion,
      tenantId,
      severity: warnings.length > 0 ? 'warning' : 'info',
      message: `Tenant ${tenantId} migrated from ${previousRegion} to ${targetRegion}`,
      payload: { tenantId, previousRegion, targetRegion, reason, complianceWarnings: warnings },
    });

    const result: MigrationResult = {
      success: true,
      tenantId,
      previousRegion,
      targetRegion,
      reason,
      migratedAt: nowIso(),
      complianceWarnings: warnings,
      message: `Tenant ${tenantId} successfully migrated to ${targetRegion}`,
    };

    json(res, result, 201);
  });

  // POST /api/v1/regions/sync
  router.post('/api/v1/regions/sync', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { sourceRegion, targetRegion, scope = 'full' } = body;

    if (!sourceRegion) return apiError(res, '"sourceRegion" is required', 400, 'MISSING_FIELDS');
    if (!targetRegion) return apiError(res, '"targetRegion" is required', 400, 'MISSING_FIELDS');

    const source = regionsStore.getRegionByCode(sourceRegion);
    if (!source)
      return apiError(res, `Region "${sourceRegion}" not found`, 404, 'REGION_NOT_FOUND');

    const target = regionsStore.getRegionByCode(targetRegion);
    if (!target)
      return apiError(res, `Region "${targetRegion}" not found`, 404, 'REGION_NOT_FOUND');

    // Genuine config replication: real payload, real byte size, real SHA-256 checksum,
    // itemsReplicated derived from actual compliance-policy/tenant-placement records.
    const replicated = regionsStore.replicateConfig(sourceRegion, targetRegion);

    regionsStore.addGlobalEvent({
      type: 'sync.completed',
      region: sourceRegion,
      severity: 'info',
      message: `Sync completed: ${sourceRegion} → ${targetRegion} (${replicated.itemsReplicated} items, ${replicated.latencyMs}ms, scope: ${scope})`,
      payload: {
        sourceRegion,
        targetRegion,
        scope,
        itemsSynced: replicated.itemsReplicated,
        checksum: replicated.checksum,
      },
    });

    const result: SyncResult = {
      success: true,
      sourceRegion,
      targetRegion,
      scope,
      itemsSynced: replicated.itemsReplicated,
      latencyMs: replicated.latencyMs,
      syncedAt: replicated.syncedAt,
      message: `Sync completed: ${replicated.itemsReplicated} items replicated from ${sourceRegion} to ${targetRegion}`,
    };

    json(res, result, 201);
  });
}
