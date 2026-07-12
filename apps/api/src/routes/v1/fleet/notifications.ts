import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { wsHub } from '../../../modules/fleet-ops/websocket-hub.js';
import type { NotificationChannel } from '../../../modules/fleet-ops/types.js';

export function registerNotificationRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/fleet/notifications',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const channel = ctx.query.get('channel') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const notifications = fleetOpsStore.listNotifications({ channel, status });
      json(res, { notifications, total: notifications.length });
    })
  );

  router.post(
    '/admin/fleet/notifications/test',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | { channel?: NotificationChannel; target?: string; subject?: string; body?: string }
        | undefined;
      if (!body?.channel || !body?.target || !body?.body) {
        return apiError(res, 'channel, target and body are required', 400, 'MISSING_FIELDS');
      }
      const notification = await fleetOpsStore.sendNotification({
        channel: body.channel,
        target: body.target,
        subject: body.subject,
        body: body.body,
      });
      json(res, notification, 201);
    })
  );

  // POST /admin/fleet/notifications/ws-ticket — mints a short-lived ticket the
  // browser exchanges for a WebSocket connection (WS handshakes can't carry
  // an Authorization header, so auth happens over the normal REST call first).
  router.post(
    '/admin/fleet/notifications/ws-ticket',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const ticket = wsHub.issueTicket(ctx.adminUserId as string);
      json(res, { ticket });
    })
  );
}
