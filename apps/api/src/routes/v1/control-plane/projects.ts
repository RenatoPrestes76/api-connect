import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { Project } from '../../../modules/control-plane/types.js';

export function registerProjectRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/control-plane/projects',
    requirePermission('projects.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const projects = controlPlaneStore.listProjects({ organizationId, status });
      json(res, { projects, total: projects.length });
    })
  );

  router.get(
    '/admin/control-plane/projects/:id',
    requirePermission('projects.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const project = controlPlaneStore.getProject(ctx.params?.id as string);
      if (!project) return apiError(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
      json(res, project);
    })
  );

  router.post(
    '/admin/control-plane/projects',
    requirePermission('projects.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | { organizationId?: string; name?: string; slug?: string; description?: string }
        | undefined;
      if (!body?.organizationId || !body?.name || !body?.slug) {
        return apiError(res, 'organizationId, name and slug are required', 400, 'MISSING_FIELDS');
      }
      const result = controlPlaneStore.createProject({
        organizationId: body.organizationId,
        name: body.name,
        slug: body.slug,
        description: body.description,
      });
      if (result === 'ORGANIZATION_NOT_FOUND') {
        return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      }
      adminIdentityStore.recordAudit({
        action: 'CREATE_PROJECT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.id,
      });
      json(res, result, 201);
    })
  );

  router.patch(
    '/admin/control-plane/projects/:id',
    requirePermission('projects.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | Partial<Pick<Project, 'name' | 'status' | 'description'>>
        | undefined;
      const project = controlPlaneStore.updateProject(ctx.params?.id as string, body ?? {});
      if (!project) return apiError(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'UPDATE_PROJECT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: project.id,
        metadata: body as Record<string, unknown>,
      });
      json(res, project);
    })
  );

  router.delete(
    '/admin/control-plane/projects/:id',
    requirePermission('projects.delete')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = controlPlaneStore.deleteProject(id);
      if (!ok) return apiError(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_PROJECT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );
}
