/**
 * HTTP server factory — wires router, middleware, and all routes.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import { Router, apiError } from './http/router.js';
import { authMiddleware } from './middleware/auth.js';
import { securityHeaders } from './middleware/security-headers.js';
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
import { registerBillingRoutes } from './routes/v1/billing/index.js';
import { registerSecurityRoutes } from './routes/v1/security/index.js';
import { registerOpsRoutes } from './routes/v1/ops/index.js';
import { registerPortalRoutes } from './routes/v1/portal/index.js';
import { registerReleaseRoutes } from './routes/v1/release/index.js';
import { registerSetupRoutes } from './routes/v1/setup/index.js';
import { registerOperationsRoutes } from './routes/v1/operations/index.js';
import { registerHaRoutes } from './routes/v1/ha/index.js';
import { registerRegionsRoutes } from './routes/v1/regions/index.js';
import { registerGovernanceRoutes } from './routes/v1/governance/index.js';
import { registerPrometheusRoutes } from './routes/v1/prometheus/index.js';
import { registerHeliosRoutes } from './routes/v1/helios/index.js';
import { registerAdminIdentityRoutes } from './routes/v1/admin-identity/index.js';
import { registerControlPlaneRoutes } from './routes/v1/control-plane/index.js';
import { registerFleetRoutes } from './routes/v1/fleet/index.js';
import { registerChaosRoutes } from './routes/v1/chaos/index.js';
import { wsHub } from './modules/fleet-ops/websocket-hub.js';
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
        apiError(res, 'Internal server error', 500, 'INTERNAL_ERROR');
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
  router.use(securityHeaders);
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

  // BILLING & LICENSING — Sprint 34
  registerBillingRoutes(router);

  // SECURITY & COMPLIANCE — Sprint 35
  registerSecurityRoutes(router);

  // TITAN — PRODUCTION HARDENING — Sprint 36
  registerOpsRoutes(router);

  // ODYSSEY — GA RELEASE — Sprint 37
  registerPortalRoutes(router);
  registerReleaseRoutes(router);

  // ORION — FIRST RUN EXPERIENCE — Sprint 38
  registerSetupRoutes(router);

  // AURORA — ENTERPRISE OPERATIONS CENTER — Sprint 39
  registerOperationsRoutes(router);

  // NEBULA — HIGH AVAILABILITY & DISASTER RECOVERY — Sprint 40
  registerHaRoutes(router);

  // COSMOS — MULTI-REGION & GLOBAL EDGE — Sprint 41
  registerRegionsRoutes(router);

  // TITAN — ENTERPRISE GOVERNANCE & COMPLIANCE — Sprint 42
  registerGovernanceRoutes(router);

  // PROMETHEUS — AI OBSERVABILITY & AUTONOMOUS OPERATIONS — Sprint 44
  registerPrometheusRoutes(router);

  // HELIOS — ENTERPRISE DATA FABRIC & EVENT MESH — Sprint 45
  registerHeliosRoutes(router);

  // ATLAS CONTROL PLANE — ADMIN IDENTITY & SECURITY — Sprint 46.2
  registerAdminIdentityRoutes(router);

  // ATLAS CONTROL PLANE — FUNCTIONAL MODULES — Sprint 46.3
  registerControlPlaneRoutes(router);

  // ATLAS CONTROL PLANE — OPERATIONS & FLEET MANAGEMENT — Sprint 46.4
  registerFleetRoutes(router);

  // ATLAS FORTRESS — HA & ENTERPRISE RESILIENCE — Sprint 47
  registerChaosRoutes(router);

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    withErrorBoundary(req, res, () => router.dispatch(req, res));
  });

  // Real-time notifications (Notification Engine's WEBSOCKET channel).
  // Ticket-based auth: the browser mints a ticket via the authenticated REST
  // endpoint POST /admin/fleet/notifications/ws-ticket, then connects here
  // with ?ticket=... — a WS handshake can't carry an Authorization header.
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/admin/fleet/ws') {
      socket.destroy();
      return;
    }
    const ticket = url.searchParams.get('ticket');
    const adminUserId = ticket ? wsHub.consumeTicket(ticket) : null;
    if (!adminUserId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wsHub.register(ws));
  });

  return httpServer;
}
