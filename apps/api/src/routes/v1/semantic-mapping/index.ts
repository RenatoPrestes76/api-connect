import type { Router } from '../../../http/router.js';
import { registerSemanticMappingAnalyzeRoute } from './analyze.js';
import { registerSemanticMappingEntitiesRoute } from './entities.js';
import { registerSemanticMappingReviewRoute } from './review.js';
import { registerSemanticMappingApproveRoute } from './approve.js';

export function registerSemanticMappingRoutes(router: Router): void {
  registerSemanticMappingAnalyzeRoute(router);
  registerSemanticMappingEntitiesRoute(router);
  registerSemanticMappingReviewRoute(router);
  registerSemanticMappingApproveRoute(router);
}
