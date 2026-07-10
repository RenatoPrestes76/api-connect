import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import {
  marketplaceStore,
  CONNECTOR_CATALOG,
} from '../../../modules/marketplace/marketplace-store.js';
import { getConnector } from '@seltriva/connector-registry';
import { verifySignature } from '../../../modules/marketplace/security.js';

// GET /api/v1/marketplace/installed
export async function listInstalled(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const installations = marketplaceStore.listInstallations();
  json(res, { total: installations.length, items: installations });
}

// GET /api/v1/marketplace/updates
export async function listUpdates(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const updates = marketplaceStore.listUpdatesAvailable();
  json(res, { total: updates.length, items: updates });
}

// POST /api/v1/marketplace/install
export async function installConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { connectorId?: string; version?: string } | undefined;
  if (!body?.connectorId) {
    apiError(res, 'connectorId is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const connector = getConnector(body.connectorId);
  if (!connector) {
    apiError(res, 'Connector not found', 404, 'NOT_FOUND');
    return;
  }

  const existing = marketplaceStore.getInstallationByConnectorId(body.connectorId);
  if (existing) {
    apiError(res, 'Connector already installed', 409, 'ALREADY_INSTALLED');
    return;
  }

  const version = body.version ?? connector.manifest.version;
  const versionEntry = connector.versions.find((v) => v.version === version);
  if (!versionEntry) {
    apiError(res, `Version ${version} not found`, 404, 'VERSION_NOT_FOUND');
    return;
  }

  // Verify signature before installing
  const sig = verifySignature(
    connector.manifest.id,
    version,
    connector.checksum,
    connector.signature
  );
  if (!sig.valid) {
    apiError(res, `Signature verification failed: ${sig.message}`, 422, 'INVALID_SIGNATURE');
    return;
  }

  const actor = ctx.userId ?? 'api';
  const installation = marketplaceStore.install(body.connectorId, version, actor);
  json(res, installation, 201);
}

// POST /api/v1/marketplace/uninstall
export async function uninstallConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { installationId?: string } | undefined;
  if (!body?.installationId) {
    apiError(res, 'installationId is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const inst = marketplaceStore.getInstallationById(body.installationId);
  if (!inst) {
    apiError(res, 'Installation not found', 404, 'NOT_FOUND');
    return;
  }

  const actor = ctx.userId ?? 'api';
  const removed = marketplaceStore.uninstall(body.installationId, actor);
  json(res, removed);
}

// POST /api/v1/marketplace/update
export async function updateConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { installationId?: string; version?: string } | undefined;
  if (!body?.installationId) {
    apiError(res, 'installationId is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const inst = marketplaceStore.getInstallationById(body.installationId);
  if (!inst) {
    apiError(res, 'Installation not found', 404, 'NOT_FOUND');
    return;
  }

  const connector = getConnector(inst.connectorId);
  if (!connector) {
    apiError(res, 'Connector not found in catalog', 404, 'NOT_FOUND');
    return;
  }

  const toVersion = body.version ?? connector.manifest.version;
  if (inst.version === toVersion) {
    apiError(res, 'Already at target version', 409, 'ALREADY_UP_TO_DATE');
    return;
  }

  const actor = ctx.userId ?? 'api';
  const updated = marketplaceStore.update(body.installationId, toVersion, actor);
  json(res, updated);
}

// POST /api/v1/marketplace/enable
export async function enableConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { installationId?: string } | undefined;
  if (!body?.installationId) {
    apiError(res, 'installationId is required', 400, 'VALIDATION_ERROR');
    return;
  }
  const inst = marketplaceStore.getInstallationById(body.installationId);
  if (!inst) {
    apiError(res, 'Installation not found', 404, 'NOT_FOUND');
    return;
  }

  const actor = ctx.userId ?? 'api';
  json(res, marketplaceStore.setEnabled(body.installationId, true, actor));
}

// POST /api/v1/marketplace/disable
export async function disableConnector(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { installationId?: string } | undefined;
  if (!body?.installationId) {
    apiError(res, 'installationId is required', 400, 'VALIDATION_ERROR');
    return;
  }
  const inst = marketplaceStore.getInstallationById(body.installationId);
  if (!inst) {
    apiError(res, 'Installation not found', 404, 'NOT_FOUND');
    return;
  }

  const actor = ctx.userId ?? 'api';
  json(res, marketplaceStore.setEnabled(body.installationId, false, actor));
}
