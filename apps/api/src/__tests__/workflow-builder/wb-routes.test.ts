import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestServer } from './helpers.js';
import { startServer, stopServer, get, post } from './helpers.js';

let srv: TestServer;

beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await stopServer(srv.server);
});

// ─── Templates ────────────────────────────────────────────────────────────────

describe('GET /api/v1/workflow-builder/templates', () => {
  it('returns 10 templates', async () => {
    const { status, body } = await get<unknown[]>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates'
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(10);
  });

  it('each template has required fields', async () => {
    const { body } = await get<Array<Record<string, unknown>>>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates'
    );
    const tpl = body[0]!;
    expect(tpl).toHaveProperty('id');
    expect(tpl).toHaveProperty('name');
    expect(tpl).toHaveProperty('description');
    expect(tpl).toHaveProperty('category');
    expect(tpl).toHaveProperty('tags');
    expect(tpl).toHaveProperty('graph');
  });

  it('filters by category', async () => {
    const { status, body } = await get<Array<{ category: string }>>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates?category=Integra%C3%A7%C3%A3o%20ERP'
    );
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((t) => t.category === 'Integração ERP')).toBe(true);
  });
});

describe('GET /api/v1/workflow-builder/templates/:id', () => {
  it('returns a single template', async () => {
    const { status, body } = await get<{ id: string }>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates/tpl-erp-ecommerce'
    );
    expect(status).toBe(200);
    expect(body.id).toBe('tpl-erp-ecommerce');
  });

  it('returns 404 for unknown template', async () => {
    const { status } = await get<unknown>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates/non-existent'
    );
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/workflow-builder/templates/:id/use', () => {
  it('creates a workflow from a template', async () => {
    const { status, body } = await post<{
      id: string;
      name: string;
      graph: { nodes: unknown[]; edges: unknown[] };
    }>(srv.baseUrl, '/api/v1/workflow-builder/templates/tpl-erp-ecommerce/use', {
      name: 'My ERP Sync',
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('My ERP Sync');
    expect(body.graph.nodes.length).toBeGreaterThan(0);
  });

  it('uses template name when no name provided', async () => {
    const { status, body } = await post<{ name: string }>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates/tpl-erp-wms/use',
      {}
    );
    expect(status).toBe(201);
    expect(body.name).toBeTruthy();
  });
});

// ─── Validate ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/orchestrator/workflows/validate', () => {
  it('validates a valid graph', async () => {
    const graph = {
      nodes: [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'log', label: 'Log', config: {}, position: { x: 200, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    };
    const { status, body } = await post<{ valid: boolean; errors: unknown[] }>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows/validate',
      { graph }
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it('returns validation errors for invalid graph', async () => {
    const graph = {
      nodes: [{ id: 'n1', type: 'log', label: 'Log', config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    };
    const { status, body } = await post<{ valid: boolean; errors: Array<{ code: string }> }>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows/validate',
      { graph }
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors.some((e) => e.code === 'NO_TRIGGER')).toBe(true);
  });

  it('returns 400 when graph is missing', async () => {
    const { status } = await post<unknown>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows/validate',
      {}
    );
    expect(status).toBe(400);
  });
});

// ─── Plan ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/orchestrator/workflows/plan', () => {
  it('returns a plan for a given prompt', async () => {
    const { status, body } = await post<{
      plan: { name: string; graph: { nodes: unknown[] }; confidence: number };
      model: string;
    }>(srv.baseUrl, '/api/v1/orchestrator/workflows/plan', {
      prompt: 'Sincronizar produtos do ERP para o e-commerce a cada 5 minutos',
    });
    expect(status).toBe(200);
    expect(body.plan.name).toBeTruthy();
    expect(body.plan.graph.nodes.length).toBeGreaterThan(0);
    expect(body.plan.confidence).toBeGreaterThan(0);
    expect(body.model).toBeTruthy();
  });

  it('returns a plan for order-related prompt', async () => {
    const { status, body } = await post<{ plan: { name: string } }>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows/plan',
      { prompt: 'processar pedido de venda com validação e NF-e' }
    );
    expect(status).toBe(200);
    expect(body.plan.name.toLowerCase()).toMatch(/pedido|order|process/i);
  });

  it('returns 400 when prompt is missing', async () => {
    const { status } = await post<unknown>(srv.baseUrl, '/api/v1/orchestrator/workflows/plan', {});
    expect(status).toBe(400);
  });
});

// ─── Simulate ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/orchestrator/workflows/:id/simulate', () => {
  let workflowId: string;

  beforeAll(async () => {
    // Create a workflow from a template to simulate
    const { body } = await post<{ id: string }>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates/tpl-order-processing/use',
      {}
    );
    workflowId = body.id;
  });

  it('runs a dry-run simulation and returns steps', async () => {
    const { status, body } = await post<{
      success: boolean;
      steps: Array<{ nodeId: string; status: string }>;
      totalMs: number;
    }>(srv.baseUrl, `/api/v1/orchestrator/workflows/${workflowId}/simulate`, { input: {} });
    expect(status).toBe(200);
    expect(typeof body.success).toBe('boolean');
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps.length).toBeGreaterThan(0);
    expect(typeof body.totalMs).toBe('number');
  });

  it('returns 404 for unknown workflow', async () => {
    const { status } = await post<unknown>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows/does-not-exist/simulate',
      {}
    );
    expect(status).toBe(404);
  });
});

// ─── Versions ─────────────────────────────────────────────────────────────────

describe('Workflow versions', () => {
  let workflowId: string;

  beforeAll(async () => {
    const { body } = await post<{ id: string }>(
      srv.baseUrl,
      '/api/v1/workflow-builder/templates/tpl-erp-crm/use',
      {}
    );
    workflowId = body.id;
  });

  it('starts with no saved versions', async () => {
    const { status, body } = await get<unknown[]>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/wb-versions`
    );
    expect(status).toBe(200);
    expect(body).toHaveLength(0);
  });

  it('saves a version', async () => {
    const { status, body } = await post<{ id: string; version: number; note: string }>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/wb-versions`,
      { note: 'Initial save', author: 'test' }
    );
    expect(status).toBe(201);
    expect(body.version).toBe(1);
    expect(body.note).toBe('Initial save');
  });

  it('lists saved versions', async () => {
    const { body } = await get<Array<{ version: number }>>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/wb-versions`
    );
    expect(body).toHaveLength(1);
    expect(body[0]!.version).toBe(1);
  });

  it('saves a second version', async () => {
    const { body } = await post<{ version: number }>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/wb-versions`,
      { note: 'Second checkpoint' }
    );
    expect(body.version).toBe(2);
  });

  it('rollback returns to specified version', async () => {
    const { status, body } = await post<{ success: boolean; rolledBackTo: number }>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/versions/1/rollback`,
      {}
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.rolledBackTo).toBe(1);
  });

  it('rollback auto-saves current graph as new version', async () => {
    const { body } = await get<unknown[]>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/wb-versions`
    );
    // 2 manually saved + 1 auto-saved before rollback = 3
    expect(body.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 404 for rollback to non-existent version', async () => {
    const { status } = await post<unknown>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${workflowId}/versions/999/rollback`,
      {}
    );
    expect(status).toBe(404);
  });
});
