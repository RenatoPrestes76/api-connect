/**
 * ATLAS HUB — Sprint 28 control-plane endpoints.
 * Registered under /api/v1/hub/**
 * Additive — does not modify Sprint 22–27 routes.
 */
import type { Router } from '../../../http/router.js';
import {
  hubListConnectors,
  hubGetConnector,
  hubStartConnector,
  hubStopConnector,
  hubRestartConnector,
} from './connectors.js';
import { hubListAgents, hubGetAgent, hubRestartAgent } from './agents.js';
import { hubListDatabases, hubGetDatabase } from './databases.js';
import { hubSyncHistory, hubRunSync, hubCancelSync, hubRetrySync } from './sync.js';
import { hubHealth } from './health.js';
import { hubLogs } from './logs.js';
import { hubGetSettings, hubUpdateSettings } from './settings.js';
import { hubListUsers, hubCreateUser, hubUpdateUser, hubDeleteUser } from './users.js';
import { hubDashboard } from './dashboard.js';
import { hubListDiscovery } from './discovery.js';

export function registerHubRoutes(router: Router): void {
  // Dashboard
  router.get('/api/v1/hub/dashboard', hubDashboard);

  // Connectors
  router.get('/api/v1/hub/connectors', hubListConnectors);
  router.get('/api/v1/hub/connectors/:id', hubGetConnector);
  router.post('/api/v1/hub/connectors/:id/start', hubStartConnector);
  router.post('/api/v1/hub/connectors/:id/stop', hubStopConnector);
  router.post('/api/v1/hub/connectors/:id/restart', hubRestartConnector);

  // Agents
  router.get('/api/v1/hub/agents', hubListAgents);
  router.get('/api/v1/hub/agents/:id', hubGetAgent);
  router.post('/api/v1/hub/agents/:id/restart', hubRestartAgent);

  // Databases
  router.get('/api/v1/hub/databases', hubListDatabases);
  router.get('/api/v1/hub/databases/:id', hubGetDatabase);

  // Sync
  router.get('/api/v1/hub/sync/history', hubSyncHistory);
  router.post('/api/v1/hub/sync/run', hubRunSync);
  router.post('/api/v1/hub/sync/:id/cancel', hubCancelSync);
  router.post('/api/v1/hub/sync/:id/retry', hubRetrySync);

  // Health
  router.get('/api/v1/hub/health', hubHealth);

  // Logs
  router.get('/api/v1/hub/logs', hubLogs);

  // Settings
  router.get('/api/v1/hub/settings', hubGetSettings);
  router.put('/api/v1/hub/settings', hubUpdateSettings);

  // Users
  router.get('/api/v1/hub/users', hubListUsers);
  router.post('/api/v1/hub/users', hubCreateUser);
  router.put('/api/v1/hub/users/:id', hubUpdateUser);
  router.delete('/api/v1/hub/users/:id', hubDeleteUser);

  // Discovery (lists PROMETHEUS analysis runs)
  router.get('/api/v1/hub/discovery', hubListDiscovery);
}
