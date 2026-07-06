import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../http/router.js';
import { json, apiError, paginated } from '../../http/router.js';
import { OrganizationService } from '../../services/organization.service.js';

// GET /api/v1/organizations
export async function listOrganizations(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const page = Number(ctx.query.get('page') ?? '1');
  const pageSize = Math.min(Number(ctx.query.get('pageSize') ?? '20'), 100);
  const search = ctx.query.get('search') ?? undefined;

  const { items, total } = await OrganizationService.list({ page, pageSize, search });
  paginated(res, items, total, page, pageSize);
}

// GET /api/v1/organizations/:id
export async function getOrganization(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const org = await OrganizationService.findById(id);
  if (!org) { apiError(res, 'Organization not found', 404, 'NOT_FOUND'); return; }

  json(res, { data: org });
}

// POST /api/v1/organizations
export async function createOrganization(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Record<string, unknown> | undefined;

  if (!body?.slug || !body?.name) {
    apiError(res, 'slug and name are required', 400, 'VALIDATION_ERROR');
    return;
  }

  // Check slug uniqueness
  const existing = await OrganizationService.findBySlug(body.slug as string);
  if (existing) {
    apiError(res, 'Slug already in use', 409, 'CONFLICT');
    return;
  }

  const org = await OrganizationService.create({
    slug: body.slug as string,
    name: body.name as string,
    tier: body.tier as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' | undefined,
  });

  json(res, { data: org }, 201);
}

// PUT /api/v1/organizations/:id
export async function updateOrganization(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const body = ctx.body as Record<string, unknown> | undefined;
  if (!body) { apiError(res, 'Body required', 400, 'BAD_REQUEST'); return; }

  const org = await OrganizationService.findById(id);
  if (!org) { apiError(res, 'Organization not found', 404, 'NOT_FOUND'); return; }

  const updated = await OrganizationService.update(id, {
    name: body['name'] as string | undefined,
    logoUrl: body['logoUrl'] as string | undefined,
    settings: body['settings'] as Record<string, unknown> | undefined,
  });

  json(res, { data: updated });
}

// DELETE /api/v1/organizations/:id
export async function deleteOrganization(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const org = await OrganizationService.findById(id);
  if (!org) { apiError(res, 'Organization not found', 404, 'NOT_FOUND'); return; }

  await OrganizationService.softDelete(id);
  json(res, { success: true });
}

// GET /api/v1/organizations/:id/workspaces
export async function listOrgWorkspaces(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const workspaces = await OrganizationService.getWorkspaces(id);
  json(res, { data: workspaces, meta: { total: workspaces.length } });
}

// GET /api/v1/organizations/:id/members
export async function listOrgMembers(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const members = await OrganizationService.getMembers(id);
  json(res, { data: members, meta: { total: members.length } });
}
