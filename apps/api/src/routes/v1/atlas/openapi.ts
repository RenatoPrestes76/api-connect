import type { ServerResponse } from 'node:http';
import type { RouteContext }    from '../../../http/router.js';
import { json }                 from '../../../http/router.js';
import { atlasOpenApiSpec }     from '../../../openapi/atlas-spec.js';

export function atlasOpenApiHandler(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, atlasOpenApiSpec);
  return Promise.resolve();
}
