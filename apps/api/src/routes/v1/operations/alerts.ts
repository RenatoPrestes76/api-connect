import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';
import type { AlertSeverity } from '../../../modules/operations/types.js';

const VALID_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'error', 'critical'];

export function registerOperationsAlertsRoutes(router: { get: Function; patch: Function }): void {
  router.get('/api/v1/operations/alerts', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const severity = ctx.query.get('severity') ?? undefined;
    const resolvedParam = ctx.query.get('resolved');
    const resolved =
      resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined;

    if (severity && !VALID_SEVERITIES.includes(severity as AlertSeverity)) {
      return apiError(
        res,
        `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        400,
        'INVALID_SEVERITY'
      );
    }

    const alerts = operationsStore.getAlerts(tenantId, { severity, resolved });
    json(res, { total: alerts.length, alerts });
  });

  router.patch('/api/v1/operations/alerts/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params['id'];
    if (!id) return apiError(res, '"id" param required', 400, 'MISSING_FIELDS');

    const alert = operationsStore.resolveAlert(id);
    if (!alert) return apiError(res, 'Alert not found', 404, 'NOT_FOUND');

    operationsStore.addEvent({
      tenantId: alert.tenantId,
      event: 'alert.resolved',
      severity: 'info',
      payload: { alertId: id, title: alert.title },
    });

    json(res, alert);
  });
}
