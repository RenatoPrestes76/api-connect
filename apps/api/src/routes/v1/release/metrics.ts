import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { releaseStore } from '../../../modules/release/release-store.js';

export function registerGoLiveMetricsRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/release/metrics', (_ctx: RouteContext, res: ServerResponse) => {
    const snap = releaseStore.goLive.snapshot();
    json(res, {
      ...snap,
      metricsMet: releaseStore.goLive.metricsMet(),
      allCriticalMet: releaseStore.goLive.allCriticalMet(),
    });
  });

  router.post('/api/v1/release/metrics', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    releaseStore.goLive.update(body);
    json(res, releaseStore.goLive.snapshot());
  });
}
