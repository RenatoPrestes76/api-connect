import type { Router }                    from '../../../http/router.js';
import type { AtlasAgentRepository }     from '@seltriva/agent-identity';
import {
  ProvisioningService,
} from '@seltriva/agent-provisioning';
import type {
  ProvisioningTokenRepository,
  AgentAccessTokenRepository,
} from '@seltriva/agent-provisioning';
import type {
  HeartbeatRecordRepository,
  SyncRecordRepository,
} from '@seltriva/agent-observability';
import type { ActivationTokenRepository } from '@seltriva/activation';
import { createProvisionHandler }        from './provision.js';
import { createHeartbeatHandler }        from './heartbeat.js';
import { createSyncStatusHandler }       from './sync-status.js';
import { createMeHandler }               from './me.js';
import { atlasOpenApiHandler }           from './openapi.js';
import { createActivateHandler }         from './activate.js';

export interface AtlasInfrastructureDeps {
  agentRepo:            AtlasAgentRepository;
  tokenRepo:            ProvisioningTokenRepository;
  accessTokenRepo:      AgentAccessTokenRepository;
  heartbeatRepo:        HeartbeatRecordRepository;
  syncRepo:             SyncRecordRepository;
  activationTokenRepo:  ActivationTokenRepository;
}

export function registerAtlasRoutes(router: Router, deps: AtlasInfrastructureDeps): void {
  const service = new ProvisioningService(
    deps.tokenRepo,
    deps.agentRepo,
    deps.accessTokenRepo,
  );

  router.post('/api/v1/provision',    createProvisionHandler(service));
  router.post('/api/v1/activate',     createActivateHandler(deps.activationTokenRepo, deps.agentRepo, deps.accessTokenRepo));
  router.post('/api/v1/heartbeat',    createHeartbeatHandler(deps.agentRepo, deps.heartbeatRepo));
  router.post('/api/v1/sync-status',  createSyncStatusHandler(deps.agentRepo, deps.syncRepo));
  router.get('/api/v1/me',            createMeHandler(deps.agentRepo));
  router.get('/api/v1/atlas/openapi', atlasOpenApiHandler);
}
