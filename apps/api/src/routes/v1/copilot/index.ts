import type { Router } from '../../../http/router.js';
import { chat, listConversations, getConversation, deleteConversation } from './chat.js';
import { diagnose } from './diagnose.js';
import { generate } from './generate.js';
import { explain } from './explain.js';
import { search } from './search.js';
import { listCopilotAudit } from './audit.js';

export function registerCopilotRoutes(router: Router): void {
  // Chat — conversation management
  router.post('/api/v1/copilot/chat', chat);
  router.get('/api/v1/copilot/conversations', listConversations);
  router.get('/api/v1/copilot/conversations/:id', getConversation);
  router.delete('/api/v1/copilot/conversations/:id', deleteConversation);

  // AI features
  router.post('/api/v1/copilot/diagnose', diagnose);
  router.post('/api/v1/copilot/generate', generate);
  router.post('/api/v1/copilot/explain', explain);
  router.post('/api/v1/copilot/search', search);

  // Audit trail
  router.get('/api/v1/copilot/audit', listCopilotAudit);
}
