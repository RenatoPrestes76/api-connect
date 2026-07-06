/**
 * PROMETHEUS Discovery AI — route registrar
 *
 * Mounts all /api/v1/discovery/* endpoints onto the shared router.
 * No database or external service dependencies — the PrometheusStore is
 * an in-memory singleton, and the DatabaseScanner runs purely in-process.
 */
import type { Router } from '../../../http/router.js';
import { prometheusStore }          from '../../../services/prometheus-store.js';
import { createAnalyzeSchemaHandler } from './analyze-schema.js';
import { createEntitiesHandler }    from './entities.js';
import { createSuggestionsHandler } from './suggestions.js';
import { createGraphHandler }       from './graph.js';

export function registerDiscoveryRoutes(router: Router): void {
  const store = prometheusStore;

  router.post('/api/v1/discovery/analyze-schema', createAnalyzeSchemaHandler(store));
  router.get('/api/v1/discovery/entities',        createEntitiesHandler(store));
  router.get('/api/v1/discovery/suggestions',     createSuggestionsHandler(store));
  router.get('/api/v1/discovery/graph',           createGraphHandler(store));
}
