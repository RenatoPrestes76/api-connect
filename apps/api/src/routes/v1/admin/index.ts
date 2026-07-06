import type { Router }                    from '../../../http/router.js';
import type { AtlasAgentRepository }      from '@seltriva/agent-identity';
import type {
  HeartbeatRecordRepository,
  SyncRecordRepository,
} from '@seltriva/agent-observability';
import type { ActivationTokenRepository } from '@seltriva/activation';
import { ActivationTokenService }         from '@seltriva/activation';
import {
  createListAgentsHandler,
  createGetAgentHandler,
  createListCompanyAgentsHandler,
  createDisableAgentHandler,
  createEnableAgentHandler,
  createDeleteAgentHandler,
} from './agents.js';
import {
  createDashboardMetricsHandler,
  createDashboardActivityHandler,
} from './dashboard.js';
import {
  createActivationTokenHandler,
  listActivationTokensHandler,
  deleteActivationTokenHandler,
} from './activation-tokens.js';

export interface AdminInfrastructureDeps {
  agentRepo:             AtlasAgentRepository;
  heartbeatRepo:         HeartbeatRecordRepository;
  syncRepo:              SyncRecordRepository;
  activationTokenRepo:   ActivationTokenRepository;
}

export function registerAdminRoutes(router: Router, deps: AdminInfrastructureDeps): void {
  const { agentRepo, heartbeatRepo, syncRepo, activationTokenRepo } = deps;

  const activationService = new ActivationTokenService(activationTokenRepo);

  // Agent admin
  router.get('/admin/agents',                             createListAgentsHandler(agentRepo));
  router.get('/admin/agents/:id',                         createGetAgentHandler(agentRepo));
  router.get('/admin/companies/:companyId/agents',        createListCompanyAgentsHandler(agentRepo));
  router.patch('/admin/agents/:id/disable',               createDisableAgentHandler(agentRepo));
  router.patch('/admin/agents/:id/enable',                createEnableAgentHandler(agentRepo));
  router.delete('/admin/agents/:id',                      createDeleteAgentHandler(agentRepo));

  // Dashboard
  router.get('/admin/dashboard/metrics',  createDashboardMetricsHandler(agentRepo, syncRepo, heartbeatRepo));
  router.get('/admin/dashboard/activity', createDashboardActivityHandler(agentRepo, syncRepo, heartbeatRepo));

  // Activation tokens
  router.post('/admin/activation-tokens',        createActivationTokenHandler(activationService));
  router.get('/admin/activation-tokens',         listActivationTokensHandler(activationService));
  router.delete('/admin/activation-tokens/:id',  deleteActivationTokenHandler(activationService));
}
