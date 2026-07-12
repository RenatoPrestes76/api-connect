import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { governanceStore } from '../../../modules/governance/governance-store.js';
import type { ComplianceFramework, EvidenceStatus } from '../../../modules/governance/types.js';

export function registerComplianceRoutes(router: { get: Function }): void {
  // GET /api/v1/compliance/status
  router.get('/api/v1/compliance/status', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, governanceStore.getComplianceStatus());
  });

  // GET /api/v1/compliance/evidence
  router.get('/api/v1/compliance/evidence', (ctx: RouteContext, res: ServerResponse) => {
    const framework = ctx.query.get('framework') ?? undefined;
    const controlId = ctx.query.get('controlId') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;

    const evidence = governanceStore.getEvidence({
      framework: framework as ComplianceFramework | undefined,
      controlId,
      status: status as EvidenceStatus | undefined,
    });

    json(res, { total: evidence.length, evidence });
  });
}
