import type { Router } from '../../../http/router.js';
import { planWorkflow } from './plan.js';
import { listTemplates, getTemplateById, useTemplate } from './templates.js';
import { simulateWorkflow } from './simulate.js';
import { validateWorkflow } from './validate.js';
import { rollbackWorkflow } from './rollback.js';
import { listWorkflowVersions, saveWorkflowVersion } from './versions.js';

export function registerWorkflowBuilderRoutes(router: Router): void {
  // AI Planner
  router.post('/api/v1/orchestrator/workflows/plan', planWorkflow);

  // Validation
  router.post('/api/v1/orchestrator/workflows/validate', validateWorkflow);

  // Templates
  router.get('/api/v1/workflow-builder/templates', listTemplates);
  router.get('/api/v1/workflow-builder/templates/:id', getTemplateById);
  router.post('/api/v1/workflow-builder/templates/:id/use', useTemplate);

  // Simulate
  router.post('/api/v1/orchestrator/workflows/:id/simulate', simulateWorkflow);

  // Versions
  router.get('/api/v1/orchestrator/workflows/:id/wb-versions', listWorkflowVersions);
  router.post('/api/v1/orchestrator/workflows/:id/wb-versions', saveWorkflowVersion);

  // Rollback
  router.post('/api/v1/orchestrator/workflows/:id/versions/:version/rollback', rollbackWorkflow);
}
