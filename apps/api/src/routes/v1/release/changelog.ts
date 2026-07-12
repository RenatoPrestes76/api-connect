import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { releaseStore } from '../../../modules/release/release-store.js';

export function registerChangelogRoutes(router: { get: Function }): void {
  router.get('/api/v1/release/changelog', (ctx: RouteContext, res: ServerResponse) => {
    const q = ctx.query.get('q');
    const versions = q ? releaseStore.changelog.search(q) : releaseStore.changelog.list();
    json(res, { total: versions.length, versions });
  });

  router.get('/api/v1/release/changelog/latest', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, releaseStore.changelog.getLatest());
  });

  router.get('/api/v1/release/changelog/:version', (ctx: RouteContext, res: ServerResponse) => {
    const v = releaseStore.changelog.get(ctx.params['version']!);
    if (!v) return apiError(res, 'Version not found in changelog', 404, 'NOT_FOUND');
    json(res, v);
  });
}
