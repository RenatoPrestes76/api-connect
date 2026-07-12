import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { governanceStore } from '../../../modules/governance/governance-store.js';
import type { RiskCategory, RiskStatus, RiskSeverity } from '../../../modules/governance/types.js';

const VALID_CATEGORIES: RiskCategory[] = [
  'operational',
  'security',
  'availability',
  'compliance',
  'integration',
  'infrastructure',
];
const VALID_STATUSES: RiskStatus[] = ['open', 'mitigating', 'mitigated', 'accepted', 'transferred'];
const VALID_SEVERITIES: RiskSeverity[] = ['critical', 'high', 'medium', 'low'];

export function registerRiskRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/risk
  router.get('/api/v1/risk', (ctx: RouteContext, res: ServerResponse) => {
    const category = ctx.query.get('category') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;
    const severity = ctx.query.get('severity') ?? undefined;

    if (category && !VALID_CATEGORIES.includes(category as RiskCategory)) {
      return apiError(res, `Invalid category "${category}"`, 400, 'INVALID_CATEGORY');
    }
    if (status && !VALID_STATUSES.includes(status as RiskStatus)) {
      return apiError(res, `Invalid status "${status}"`, 400, 'INVALID_STATUS');
    }
    if (severity && !VALID_SEVERITIES.includes(severity as RiskSeverity)) {
      return apiError(res, `Invalid severity "${severity}"`, 400, 'INVALID_SEVERITY');
    }

    const risks = governanceStore.getRisks({
      category: category as RiskCategory | undefined,
      status: status as RiskStatus | undefined,
      severity: severity as RiskSeverity | undefined,
    });

    json(res, { total: risks.length, risks });
  });

  // POST /api/v1/risk
  router.post('/api/v1/risk', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const {
      title,
      category,
      description,
      probability,
      impact,
      owner,
      mitigationPlan,
      dueDate,
      tenantId,
    } = body;

    if (!title) return apiError(res, '"title" is required', 400, 'MISSING_FIELDS');
    if (!category) return apiError(res, '"category" is required', 400, 'MISSING_FIELDS');
    if (probability === undefined)
      return apiError(res, '"probability" is required', 400, 'MISSING_FIELDS');
    if (impact === undefined) return apiError(res, '"impact" is required', 400, 'MISSING_FIELDS');

    if (!VALID_CATEGORIES.includes(category as RiskCategory)) {
      return apiError(res, `Invalid category "${category}"`, 400, 'INVALID_CATEGORY');
    }

    const risk = governanceStore.createRisk({
      title,
      category,
      description,
      probability,
      impact,
      owner,
      mitigationPlan,
      dueDate,
      tenantId,
    });
    json(res, risk, 201);
  });
}
