import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../http/router.js';
import { json, apiError, paginated } from '../../http/router.js';
import { prisma } from '../../services/prisma.js';
import type { PluginStatus } from '@prisma/client';

/**
 * ATLAS master audit — the three `:orgId`-scoped handlers below used to
 * resolve `orgId` as `ctx.params['orgId'] ?? ctx.orgId`, letting a
 * client-supplied URL param override the caller's real, session-derived
 * organization with no ownership check at all — any authenticated user
 * could list/install/uninstall plugins for ANY organization by id. Fixed
 * by requiring the URL's :orgId to match the caller's own ctx.orgId;
 * the URL param is kept only because these routes are also mounted
 * directly under /api/v1/organizations/:orgId/plugins* (server.ts), not
 * because a client is allowed to pick a different org than its own.
 */
function resolveOwnOrgId(ctx: RouteContext, res: ServerResponse): string | null {
  const paramOrgId = ctx.params['orgId'];
  if (!ctx.orgId) {
    apiError(
      res,
      'Authenticated session has no associated organization',
      403,
      'ORGANIZATION_NOT_LINKED'
    );
    return null;
  }
  if (paramOrgId && paramOrgId !== ctx.orgId) {
    apiError(res, 'Organization not found', 404, 'NOT_FOUND');
    return null;
  }
  return ctx.orgId;
}

// GET /api/v1/plugins
export async function listPlugins(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const page = Number(ctx.query.get('page') ?? '1');
  const pageSize = Math.min(Number(ctx.query.get('pageSize') ?? '20'), 100);
  const search = ctx.query.get('search') ?? undefined;
  const category = ctx.query.get('category') ?? undefined;
  const status = (ctx.query.get('status') as PluginStatus | null) ?? 'PUBLISHED';

  const where = {
    deletedAt: null,
    status,
    ...(category && { category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { slug: { contains: search, mode: 'insensitive' as const } },
        { tags: { has: search } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.plugin.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        version: true,
        category: true,
        tags: true,
        status: true,
        iconUrl: true,
        homepage: true,
        createdAt: true,
        _count: { select: { organizations: true } },
      },
    }),
    prisma.plugin.count({ where }),
  ]);

  paginated(res, items, total, page, pageSize);
}

// GET /api/v1/plugins/:id
export async function getPlugin(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) {
    apiError(res, 'Missing id', 400, 'BAD_REQUEST');
    return;
  }

  const plugin = await prisma.plugin.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id }, { slug: id }],
    },
    include: {
      versions: {
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        select: { id: true, version: true, changelog: true, publishedAt: true },
      },
      _count: { select: { organizations: true } },
    },
  });

  if (!plugin) {
    apiError(res, 'Plugin not found', 404, 'NOT_FOUND');
    return;
  }

  json(res, { data: plugin });
}

// GET /api/v1/organizations/:orgId/plugins
export async function listInstalledPlugins(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const orgId = resolveOwnOrgId(ctx, res);
  if (!orgId) return;

  const installed = await prisma.organizationPlugin.findMany({
    where: { organizationId: orgId },
    include: {
      plugin: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          category: true,
          iconUrl: true,
        },
      },
    },
    orderBy: { installedAt: 'desc' },
  });

  json(res, { data: installed, meta: { total: installed.length } });
}

// POST /api/v1/organizations/:orgId/plugins/:pluginId/install
export async function installPlugin(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const orgId = resolveOwnOrgId(ctx, res);
  const { pluginId } = ctx.params;

  if (!orgId || !pluginId) {
    if (orgId) apiError(res, 'Plugin ID required', 400, 'BAD_REQUEST');
    return;
  }

  const plugin = await prisma.plugin.findFirst({
    where: { id: pluginId, status: 'PUBLISHED', deletedAt: null },
  });

  if (!plugin) {
    apiError(res, 'Plugin not found or not published', 404, 'NOT_FOUND');
    return;
  }

  const existing = await prisma.organizationPlugin.findUnique({
    where: { organizationId_pluginId: { organizationId: orgId, pluginId } },
  });

  if (existing) {
    apiError(res, 'Plugin already installed', 409, 'CONFLICT');
    return;
  }

  const body = ctx.body as Record<string, unknown> | undefined;

  const installed = await prisma.organizationPlugin.create({
    data: {
      organizationId: orgId,
      pluginId,
      version: plugin.version,
      config: body?.['config'] ? JSON.parse(JSON.stringify(body['config'])) : undefined,
      enabled: true,
    },
  });

  json(res, { data: installed }, 201);
}

// DELETE /api/v1/organizations/:orgId/plugins/:pluginId
export async function uninstallPlugin(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const orgId = resolveOwnOrgId(ctx, res);
  const { pluginId } = ctx.params;

  if (!orgId || !pluginId) {
    if (orgId) apiError(res, 'Plugin ID required', 400, 'BAD_REQUEST');
    return;
  }

  await prisma.organizationPlugin.deleteMany({
    where: { organizationId: orgId, pluginId },
  });

  json(res, { success: true });
}
