import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import {
  marketplaceStore,
  CONNECTOR_CATALOG,
} from '../../../modules/marketplace/marketplace-store.js';
import {
  CONNECTOR_CATEGORIES,
  searchConnectors,
  listByCategory,
} from '@seltriva/connector-registry';
import { verifySignature } from '../../../modules/marketplace/security.js';

// GET /api/v1/marketplace/connectors
export async function listConnectors(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const q = ctx.query.get('q') ?? '';
  const category = ctx.query.get('category') ?? '';
  const featured = ctx.query.get('featured') ?? '';
  const limitStr = ctx.query.get('limit') ?? '20';
  const offsetStr = ctx.query.get('offset') ?? '0';
  const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
  const offset = Math.max(0, parseInt(offsetStr, 10) || 0);

  let connectors = q ? searchConnectors(q, 100) : [...CONNECTOR_CATALOG];

  if (category) {
    connectors = connectors.filter((c) => c.manifest.category === category);
  }
  if (featured === 'true') {
    connectors = connectors.filter((c) => c.featured);
  }

  // Annotate with installed status
  const installed = marketplaceStore.listInstallations();
  const installedMap = new Map(installed.map((i) => [i.connectorId, i]));

  const annotated = connectors.map((c) => {
    const inst = installedMap.get(c.manifest.id);
    const hasUpdate = inst && inst.version !== c.manifest.version;
    return {
      ...c,
      status: inst ? (hasUpdate ? 'update-available' : 'installed') : c.status,
      installedVersion: inst?.version,
    };
  });

  const page = annotated.slice(offset, offset + limit);
  json(res, { total: annotated.length, offset, limit, items: page });
}

// GET /api/v1/marketplace/connectors/:id
export async function getConnectorById(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const connector = CONNECTOR_CATALOG.find((c) => c.manifest.id === ctx.params['id']);
  if (!connector) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }

  const inst = marketplaceStore.getInstallationByConnectorId(connector.manifest.id);
  const hasUpdate = inst && inst.version !== connector.manifest.version;
  json(res, {
    ...connector,
    status: inst ? (hasUpdate ? 'update-available' : 'installed') : connector.status,
    installedVersion: inst?.version,
    installationId: inst?.id,
  });
}

// GET /api/v1/marketplace/categories
export async function listCategories(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const counts = Object.fromEntries(
    CONNECTOR_CATEGORIES.map((cat) => {
      const items = listByCategory(cat);
      return [cat, items.length];
    })
  );
  json(res, { categories: CONNECTOR_CATEGORIES, counts });
}

// GET /api/v1/marketplace/search
export async function searchConnectorRoute(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const q = ctx.query.get('q') ?? '';
  const limitStr = ctx.query.get('limit') ?? '10';
  const limit = Math.min(50, Math.max(1, parseInt(limitStr, 10) || 10));
  if (!q.trim()) {
    json(res, { results: [] });
    return;
  }
  const results = searchConnectors(q, limit);
  json(res, { results });
}

// GET /api/v1/marketplace/connectors/:id/verify
export async function verifyConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const connector = CONNECTOR_CATALOG.find((c) => c.manifest.id === ctx.params['id']);
  if (!connector) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }
  const result = verifySignature(
    connector.manifest.id,
    connector.manifest.version,
    connector.checksum,
    connector.signature
  );
  json(res, result);
}
