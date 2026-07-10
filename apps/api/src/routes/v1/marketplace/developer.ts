import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { marketplaceStore } from '../../../modules/marketplace/marketplace-store.js';
import { CONNECTOR_CATALOG } from '@seltriva/connector-registry';

// POST /api/v1/marketplace/publish
export async function publishConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as
    | {
        connectorId?: string;
        name?: string;
        version?: string;
        description?: string;
        category?: string;
        author?: string;
      }
    | undefined;

  if (!body?.connectorId || !body?.name || !body?.version) {
    apiError(res, 'connectorId, name, and version are required', 400, 'VALIDATION_ERROR');
    return;
  }

  // In demo mode we accept but don't persist to catalog (read-only seed)
  const existing = CONNECTOR_CATALOG.find((c) => c.manifest.id === body.connectorId);
  const status = existing ? 'update-submitted' : 'pending-review';

  const actor = ctx.userId ?? 'api';
  marketplaceStore.recordPublish(body.connectorId, body.name, body.version, actor);

  json(
    res,
    {
      status,
      connectorId: body.connectorId,
      version: body.version,
      message: existing
        ? `Version ${body.version} submitted for review. Current version remains active.`
        : `Connector ${body.name} submitted for review. Estimated review time: 3–5 business days.`,
      submittedAt: new Date().toISOString(),
    },
    202
  );
}
