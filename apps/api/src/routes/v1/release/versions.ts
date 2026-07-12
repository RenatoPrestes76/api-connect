import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { releaseStore } from '../../../modules/release/release-store.js';

export function registerVersionRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/release/versions', (_ctx: RouteContext, res: ServerResponse) => {
    const versions = releaseStore.versions.list();
    json(res, { total: versions.length, current: releaseStore.versions.current(), versions });
  });

  router.get('/api/v1/release/versions/current', (_ctx: RouteContext, res: ServerResponse) => {
    const current = releaseStore.versions.current();
    if (!current) return apiError(res, 'No current version', 404, 'NOT_FOUND');
    json(res, current);
  });

  router.get('/api/v1/release/versions/:version', (ctx: RouteContext, res: ServerResponse) => {
    const version = releaseStore.versions.get(ctx.params['version']!);
    if (!version) return apiError(res, 'Version not found', 404, 'NOT_FOUND');
    json(res, version);
  });

  router.post(
    '/api/v1/release/versions/:version/certify',
    (ctx: RouteContext, res: ServerResponse) => {
      const certifiedBy = (ctx.body as any)?.certifiedBy as string | undefined;
      if (!certifiedBy) {
        return apiError(res, '"certifiedBy" is required', 400, 'MISSING_FIELD');
      }
      const version = releaseStore.versions.certify(ctx.params['version']!, certifiedBy);
      if (!version) return apiError(res, 'Version not found', 404, 'NOT_FOUND');
      json(res, version);
    }
  );
}
