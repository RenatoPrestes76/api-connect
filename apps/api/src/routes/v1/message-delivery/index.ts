import type { Router } from '../../../http/router.js';
import { registerMessageSendRoute } from './send.js';
import { registerMessageAckRoute } from './ack.js';
import { registerMessagePendingRoute } from './pending.js';
import { registerMessageDeadLetterRoute } from './dead-letter.js';
import { registerMessageReprocessRoute } from './reprocess.js';

export function registerMessageDeliveryRoutes(router: Router): void {
  registerMessageSendRoute(router);
  registerMessageAckRoute(router);
  registerMessagePendingRoute(router);
  registerMessageDeadLetterRoute(router);
  registerMessageReprocessRoute(router);
}
