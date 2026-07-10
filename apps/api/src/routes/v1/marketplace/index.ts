import type { Router } from '../../../http/router.js';
import {
  listConnectors,
  getConnectorById,
  listCategories,
  searchConnectorRoute,
  verifyConnector,
} from './catalog.js';
import {
  listInstalled,
  listUpdates,
  installConnector,
  uninstallConnector,
  updateConnector,
  enableConnector,
  disableConnector,
} from './install.js';
import { publishConnector } from './developer.js';
import { listMarketplaceAudit } from './audit.js';

export function registerMarketplaceRoutes(router: Router): void {
  // Catalog
  router.get('/api/v1/marketplace/connectors', listConnectors);
  router.get('/api/v1/marketplace/connectors/:id', getConnectorById);
  router.get('/api/v1/marketplace/connectors/:id/verify', verifyConnector);
  router.get('/api/v1/marketplace/categories', listCategories);
  router.get('/api/v1/marketplace/search', searchConnectorRoute);

  // Installations
  router.get('/api/v1/marketplace/installed', listInstalled);
  router.get('/api/v1/marketplace/updates', listUpdates);
  router.post('/api/v1/marketplace/install', installConnector);
  router.post('/api/v1/marketplace/uninstall', uninstallConnector);
  router.post('/api/v1/marketplace/update', updateConnector);
  router.post('/api/v1/marketplace/enable', enableConnector);
  router.post('/api/v1/marketplace/disable', disableConnector);

  // Developer portal
  router.post('/api/v1/marketplace/publish', publishConnector);

  // Audit trail
  router.get('/api/v1/marketplace/audit', listMarketplaceAudit);
}
