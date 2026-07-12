import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { governanceStore } from '../../../modules/governance/governance-store.js';
import type { PolicyCategory, PolicyEnforcement } from '../../../modules/governance/types.js';

const VALID_CATEGORIES: PolicyCategory[] = [
  'security',
  'access',
  'deployment',
  'data',
  'operational',
  'compliance',
];
const VALID_ENFORCEMENTS: PolicyEnforcement[] = ['mandatory', 'advisory', 'disabled'];

export function registerPoliciesRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/governance/policies
  router.get('/api/v1/governance/policies', (ctx: RouteContext, res: ServerResponse) => {
    const category = ctx.query.get('category') ?? undefined;
    const enabledParam = ctx.query.get('enabled');
    const enabled = enabledParam === 'true' ? true : enabledParam === 'false' ? false : undefined;

    if (category && !VALID_CATEGORIES.includes(category as PolicyCategory)) {
      return apiError(res, `Invalid category "${category}"`, 400, 'INVALID_CATEGORY');
    }

    const policies = governanceStore.getPolicies({
      category: category as PolicyCategory | undefined,
      enabled,
    });

    json(res, { total: policies.length, policies });
  });

  // POST /api/v1/governance/policies
  router.post('/api/v1/governance/policies', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { name, category, description, enforcement, rules, appliesTo } = body;

    if (!name) return apiError(res, '"name" is required', 400, 'MISSING_FIELDS');
    if (!category) return apiError(res, '"category" is required', 400, 'MISSING_FIELDS');

    if (!VALID_CATEGORIES.includes(category as PolicyCategory)) {
      return apiError(res, `Invalid category "${category}"`, 400, 'INVALID_CATEGORY');
    }
    if (enforcement && !VALID_ENFORCEMENTS.includes(enforcement as PolicyEnforcement)) {
      return apiError(res, `Invalid enforcement "${enforcement}"`, 400, 'INVALID_ENFORCEMENT');
    }

    const policy = governanceStore.createPolicy({
      name,
      category,
      description,
      enforcement,
      rules,
      appliesTo,
    });
    json(res, policy, 201);
  });
}
