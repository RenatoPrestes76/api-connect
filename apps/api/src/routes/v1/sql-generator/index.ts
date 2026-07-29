import type { Router } from '../../../http/router.js';
import { registerSqlGeneratorGenerateRoute } from './generate.js';
import { registerSqlGeneratorExplainRoute } from './explain.js';
import { registerSqlGeneratorGetRoute } from './get.js';

export function registerSqlGeneratorRoutes(router: Router): void {
  registerSqlGeneratorGenerateRoute(router);
  registerSqlGeneratorExplainRoute(router);
  registerSqlGeneratorGetRoute(router);
}
