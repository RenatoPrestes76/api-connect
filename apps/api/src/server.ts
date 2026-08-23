/**
 * HTTP server factory — wires router, middleware, and all routes.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { createLogger } from '@seltriva/logger';
import { Router, apiError } from './http/router.js';
import { MissingTenantError } from './http/tenant.js';
import { authMiddleware } from './middleware/auth.js';
import { securityHeaders } from './middleware/security-headers.js';
import { gatewayMiddleware } from './middleware/gateway.js';
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
import { registerConnectorRegistryRoutes } from './routes/v1/connector-registry/index.js';
import { registerRuntimeRegistrationRoutes } from './routes/v1/runtime-registration/index.js';
import { registerConnectorManagementRoutes } from './routes/v1/connector-management/index.js';
import { registerJobOrchestrationRoutes } from './routes/v1/job-orchestration/index.js';
import { registerMessageDeliveryRoutes } from './routes/v1/message-delivery/index.js';
import { registerErpConnectivityRoutes } from './routes/v1/erp-connectivity/index.js';
import { registerRuntimeConnectorExecutionRoutes } from './routes/v1/runtime-connector-execution/index.js';
import { registerErpMetadataRoutes } from './routes/v1/erp-metadata/index.js';
import { registerSemanticMappingRoutes } from './routes/v1/semantic-mapping/index.js';
import { registerCanonicalModelRoutes } from './routes/v1/canonical-model/index.js';
import { registerQueryPlannerRoutes } from './routes/v1/query-planner/index.js';
import { registerSqlGeneratorRoutes } from './routes/v1/sql-generator/index.js';
import { registerQueryExecutionRoutes } from './routes/v1/query-execution/index.js';
import { wsHub } from './modules/fleet-ops/websocket-hub.js';
import { healthHandler } from './routes/health.js';
import { liveHandler, readyHandler } from './routes/live-ready.js';
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

const requestLog = createLogger('api');

function requestLogger(
  ctx: Parameters<Parameters<Router['use']>[0]>[0],
  req: IncomingMessage,
  _res: ServerResponse,
  next: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  const result = next();
  result
    .then(() => {
      requestLog.info('request completed', {
        requestId: ctx.requestId,
        method: req.method,
        url: req.url,
        durationMs: Date.now() - start,
      });
    })
    .catch(() => undefined); // failures are logged by withErrorBoundary instead
  return result;
}

// ─── Global Error Boundary ───────────────────────────────────────────────────

// Exported for direct unit testing — this is the last line of defense
// between an unexpected exception anywhere in a route handler/middleware and
// the process crashing or a connection hanging, so it needs coverage that
// doesn't depend on finding an existing route willing to throw.
export async function withErrorBoundary(
  req: IncomingMessage,
  res: ServerResponse,
  handler: () => Promise<void>
): Promise<void> {
  try {
    await handler();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const code = (err as { code?: string }).code;
    // The router sets this header as the very first thing it does per
    // request (before routing/middleware/handler), so it's available here
    // even when the failure happened before a route ever matched — letting
    // this log line be correlated with the per-request access log emitted
    // by requestLogger above via the same requestId.
    requestLog.error('request failed', {
      requestId: res.getHeader('X-Request-Id'),
      method: req.method,
      url: req.url,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (!res.headersSent) {
      if (err instanceof MissingTenantError) {
        apiError(res, err.message, err.status, err.code);
      } else if (code === 'P2002') {
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
): Server {
  const router = new Router();

  // Middleware
  router.use(requestLogger);
  router.use(securityHeaders);
  router.use(authMiddleware);
  router.use(gatewayMiddleware);
  if (atlasDeps) {
    router.use(createAgentAuthMiddleware(atlasDeps.accessTokenRepo));
  }

  // Health
  router.get('/health', healthHandler);
  router.get('/api/v1/health', healthHandler);
  router.get('/live', liveHandler);
  router.get('/api/v1/live', liveHandler);
  router.get('/ready', readyHandler);
  router.get('/api/v1/ready', readyHandler);

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

  // CONNECTOR REGISTRY — Sprint 46.6
  registerConnectorRegistryRoutes(router);

  // ATLAS RUNTIME REGISTRATION & PROVISIONING — Sprint 46.3
  registerRuntimeRegistrationRoutes(router);

  // CONNECTOR LIFECYCLE MANAGEMENT — Sprint 46.4
  registerConnectorManagementRoutes(router);

  // REMOTE COMMAND & JOB ORCHESTRATION — Sprint 46.5
  registerJobOrchestrationRoutes(router);

  // RELIABLE MESSAGE DELIVERY & EXECUTION ENGINE
  registerMessageDeliveryRoutes(router);

  // SECURE ERP CONNECTIVITY ENGINE
  registerErpConnectivityRoutes(router);

  // RUNTIME CONNECTOR EXECUTION ENGINE
  registerRuntimeConnectorExecutionRoutes(router);

  // UNIVERSAL ERP METADATA DISCOVERY ENGINE
  registerErpMetadataRoutes(router);

  // INTELLIGENT ERP SEMANTIC MAPPING ENGINE
  registerSemanticMappingRoutes(router);

  // CANONICAL BUSINESS MODEL ENGINE
  registerCanonicalModelRoutes(router);

  // UNIVERSAL QUERY PLANNING ENGINE
  registerQueryPlannerRoutes(router);

  // UNIVERSAL SQL GENERATION ENGINE
  registerSqlGeneratorRoutes(router);

  // UNIVERSAL QUERY EXECUTION ENGINE
  registerQueryExecutionRoutes(router);

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
