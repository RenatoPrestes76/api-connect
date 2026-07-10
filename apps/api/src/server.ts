/**
 * HTTP server factory — wires router, middleware, and all routes.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router, apiError } from './http/router.js';
import { authMiddleware } from './middleware/auth.js';
import { createAgentAuthMiddleware } from './middleware/agent-auth.js';
import { registerAtlasRoutes } from './routes/v1/atlas/index.js';
import type { AtlasInfrastructureDeps } from './routes/v1/atlas/index.js';
import { registerAdminRoutes } from './routes/v1/admin/index.js';
import type { AdminInfrastructureDeps } from './routes/v1/admin/index.js';
import { registerDiscoveryRoutes } from './routes/v1/discovery/index.js';
import { registerHubRoutes } from './routes/v1/hub/index.js';
import { registerOrchestratorRoutes } from './routes/v1/orchestrator/index.js';
import { registerObservatoryRoutes } from './routes/v1/observatory/index.js';
import { registerCopilotRoutes } from './routes/v1/copilot/index.js';
import { registerWorkflowBuilderRoutes } from './routes/v1/workflow-builder/index.js';
import { registerMarketplaceRoutes } from './routes/v1/marketplace/index.js';
import { healthHandler } from './routes/health.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  listOrgWorkspaces,
  listOrgMembers,
} from './routes/v1/organizations.js';
import {
  listAgents,
  getAgent,
  registerAgent,
  agentHeartbeat,
  getAgentHeartbeats,
  retireAgent,
} from './routes/v1/agents.js';
import {
  listPlugins,
  getPlugin,
  listInstalledPlugins,
  installPlugin,
  uninstallPlugin,
} from './routes/v1/plugins.js';

// ─── Request Logger ─────────────────────────────────────────────────────────

function requestLogger(
  _ctx: Parameters<Parameters<Router['use']>[0]>[0],
  req: IncomingMessage,
  _res: ServerResponse,
  next: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  const result = next();
  result
    .then(() => {
      const ms = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} — ${ms}ms`);
    })
    .catch(() => undefined);
  return result;
}

// ─── Global Error Boundary ───────────────────────────────────────────────────

async function withErrorBoundary(
  req: IncomingMessage,
  res: ServerResponse,
  handler: () => Promise<void>
): Promise<void> {
  try {
    await handler();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const code = (err as { code?: string }).code;
    console.error(`[ERROR] ${req.method} ${req.url}:`, message);

    if (!res.headersSent) {
      if (code === 'P2002') {
        apiError(res, 'Resource already exists', 409, 'CONFLICT');
      } else if (code === 'P2025') {
        apiError(res, 'Resource not found', 404, 'NOT_FOUND');
      } else {
        apiError(res, message, 500, 'INTERNAL_ERROR');
      }
    }
  }
}

// ─── Router Setup ────────────────────────────────────────────────────────────

export type { AtlasInfrastructureDeps, AdminInfrastructureDeps };

export interface ApiServerDeps {
  atlas?: AtlasInfrastructureDeps;
  admin?: AdminInfrastructureDeps;
}

export function createApiServer(
  atlasDeps?: AtlasInfrastructureDeps,
  adminDeps?: AdminInfrastructureDeps
) {
  const router = new Router();

  // Middleware
  router.use(requestLogger);
  router.use(authMiddleware);
  if (atlasDeps) {
    router.use(createAgentAuthMiddleware(atlasDeps.accessTokenRepo));
  }

  // Health
  router.get('/health', healthHandler);
  router.get('/api/v1/health', healthHandler);

  // Organizations
  router.get('/api/v1/organizations', listOrganizations);
  router.post('/api/v1/organizations', createOrganization);
  router.get('/api/v1/organizations/:id', getOrganization);
  router.put('/api/v1/organizations/:id', updateOrganization);
  router.delete('/api/v1/organizations/:id', deleteOrganization);
  router.get('/api/v1/organizations/:id/workspaces', listOrgWorkspaces);
  router.get('/api/v1/organizations/:id/members', listOrgMembers);
  router.get('/api/v1/organizations/:orgId/plugins', listInstalledPlugins);
  router.post('/api/v1/organizations/:orgId/plugins/:pluginId/install', installPlugin);
  router.delete('/api/v1/organizations/:orgId/plugins/:pluginId', uninstallPlugin);

  // Agents
  router.get('/api/v1/agents', listAgents);
  router.post('/api/v1/agents/register', registerAgent);
  router.get('/api/v1/agents/:id', getAgent);
  router.post('/api/v1/agents/:id/heartbeat', agentHeartbeat);
  router.get('/api/v1/agents/:id/heartbeats', getAgentHeartbeats);
  router.delete('/api/v1/agents/:id', retireAgent);

  // Plugins
  router.get('/api/v1/plugins', listPlugins);
  router.get('/api/v1/plugins/:id', getPlugin);

  // Atlas Control Plane (agent provisioning + heartbeat)
  if (atlasDeps) {
    registerAtlasRoutes(router, atlasDeps);
  }

  // Atlas Admin (observability dashboard)
  if (adminDeps) {
    registerAdminRoutes(router, adminDeps);
  }

  // PROMETHEUS Discovery AI
  registerDiscoveryRoutes(router);

  // ATLAS HUB Control Plane
  registerHubRoutes(router);

  // ORCHESTRATOR — Sprint 29
  registerOrchestratorRoutes(router);

  // OBSERVATORY — Sprint 30
  registerObservatoryRoutes(router);

  // AI COPILOT — Sprint 31
  registerCopilotRoutes(router);

  // WORKFLOW BUILDER IA — Sprint 32
  registerWorkflowBuilderRoutes(router);

  // MARKETPLACE DE CONNECTORS — Sprint 33
  registerMarketplaceRoutes(router);

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    withErrorBoundary(req, res, () => router.dispatch(req, res));
  });

  return httpServer;
}
