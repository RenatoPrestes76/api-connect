import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';
import type { SlaPeriod } from '../../../modules/operations/types.js';

const VALID_PERIODS: SlaPeriod[] = ['today', '7d', '30d', '12m'];

export function registerOperationsSlaRoute(router: { get: Function }): void {
  router.get('/api/v1/operations/sla', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const period = (ctx.query.get('period') ?? 'today') as SlaPeriod;

    if (!VALID_PERIODS.includes(period)) {
      return apiError(
        res,
        `period must be one of: ${VALID_PERIODS.join(', ')}`,
        400,
        'INVALID_PERIOD'
      );
    }

    const records = operationsStore.getSlaHistory(tenantId, period);
    const compliant = records.filter((r) => r.met).length;

    json(res, {
      period,
      total: records.length,
      compliant,
      nonCompliant: records.length - compliant,
      records,
    });
  });
}
