import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { releaseStore } from '../../../modules/release/release-store.js';
import { sbomByType, sbomVulnerableComponents } from '@seltriva/release';

export function registerSBOMRoutes(router: Router): void {
  router.get('/api/v1/release/sbom', async (_ctx: RouteContext, res: ServerResponse) => {
    json(res, releaseStore.getSBOM());
  });

  router.get(
    '/api/v1/release/sbom/vulnerabilities',
    async (_ctx: RouteContext, res: ServerResponse) => {
      const sbom = releaseStore.getSBOM();
      const vulnerable = sbomVulnerableComponents(sbom);
      json(res, {
        total: sbom.totalComponents,
        totalVulnerabilities: sbom.totalVulnerabilities,
        vulnerableComponents: vulnerable,
      });
    }
  );

  router.get('/api/v1/release/sbom/components', async (ctx: RouteContext, res: ServerResponse) => {
    const type = ctx.query.get('type') as 'runtime' | 'dev' | 'transitive' | null;
    const sbom = releaseStore.getSBOM();
    const components = type ? sbomByType(sbom, type) : sbom.components;
    json(res, { total: components.length, components });
  });
}
