import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestOrchestratorServer } from './helpers.js';
import { startOrchestratorServer, stopServer, get, post, put, del } from './helpers.js';
import type { Workflow, WorkflowExecution } from '../../modules/orchestrator/types.js';

let srv: TestOrchestratorServer;

beforeAll(async () => {
  srv = await startOrchestratorServer();
});
afterAll(async () => {
  await stopServer(srv.server);
});

// ─── Workflows ────────────────────────────────────────────────────────────────

describe('GET /api/v1/orchestrator/workflows', () => {
  it('returns seeded workflows array', async () => {
    const { status, body } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
  });

  it('each workflow has required fields', async () => {
    const { body } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const wf = body[0]!;
    expect(wf).toHaveProperty('id');
    expect(wf).toHaveProperty('name');
    expect(wf).toHaveProperty('active');
    expect(wf).toHaveProperty('triggerType');
    expect(wf).toHaveProperty('graph');
    expect(wf.graph).toHaveProperty('nodes');
    expect(wf.graph).toHaveProperty('edges');
  });
});

describe('GET /api/v1/orchestrator/workflows/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/orchestrator/workflows/nonexistent');
    expect(status).toBe(404);
  });

  it('returns workflow by id', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const id = list[0]!.id;
    const { status, body } = await get<Workflow>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${id}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(id);
  });
});

describe('POST /api/v1/orchestrator/workflows', () => {
  it('returns 400 when name missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/orchestrator/workflows', {
      triggerType: 'MANUAL',
    });
    expect(status).toBe(400);
  });

  it('creates a new workflow', async () => {
    const { status, body } = await post<Workflow>(srv.baseUrl, '/api/v1/orchestrator/workflows', {
      name: 'Test Workflow',
      triggerType: 'MANUAL',
      description: 'Test',
      tags: ['test'],
    });
    expect(status).toBe(201);
    expect(body.name).toBe('Test Workflow');
    expect(body.triggerType).toBe('MANUAL');
    expect(body.active).toBe(false);
    expect(body.version).toBe(1);
  });
});

describe('PUT /api/v1/orchestrator/workflows/:id', () => {
  it('updates workflow name', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const id = list[0]!.id;
    const { status, body } = await put<Workflow>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${id}`,
      {
        name: 'Updated Name',
      }
    );
    expect(status).toBe(200);
    expect(body.name).toBe('Updated Name');
  });

  it('bumps version when graph changes', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const wf = list[0]!;
    const prevVersion = wf.version;
    const newGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Trigger',
          config: { triggerType: 'MANUAL' },
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    };
    const { body } = await put<Workflow>(srv.baseUrl, `/api/v1/orchestrator/workflows/${wf.id}`, {
      graph: newGraph,
    });
    expect(body.version).toBe(prevVersion + 1);
  });
});

describe('POST /api/v1/orchestrator/workflows/:id/activate', () => {
  it('activates a workflow', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const inactive = list.find((w) => !w.active);
    if (!inactive) return; // all active — skip
    const { status, body } = await post<Workflow>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${inactive.id}/activate`
    );
    expect(status).toBe(200);
    expect(body.active).toBe(true);
  });
});

describe('POST /api/v1/orchestrator/workflows/:id/deactivate', () => {
  it('deactivates a workflow', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const active = list.find((w) => w.active);
    if (!active) return;
    const { status, body } = await post<Workflow>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${active.id}/deactivate`
    );
    expect(status).toBe(200);
    expect(body.active).toBe(false);
  });
});

describe('POST /api/v1/orchestrator/workflows/:id/run', () => {
  it('starts execution and returns 202', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const id = list[0]!.id;
    const { status } = await post(srv.baseUrl, `/api/v1/orchestrator/workflows/${id}/run`, {
      input: { test: true },
    });
    expect(status).toBe(202);
  });

  it('returns 404 for unknown workflow', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/orchestrator/workflows/nope/run');
    expect(status).toBe(404);
  });
});

describe('GET /api/v1/orchestrator/workflows/:id/versions', () => {
  it('returns version history', async () => {
    const { body: list } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const id = list[0]!.id;
    const { status, body } = await get<unknown[]>(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${id}/versions`
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /api/v1/orchestrator/workflows/:id', () => {
  it('deletes a workflow', async () => {
    const { status: createStatus, body: created } = await post<Workflow>(
      srv.baseUrl,
      '/api/v1/orchestrator/workflows',
      {
        name: 'To Delete',
        triggerType: 'MANUAL',
      }
    );
    expect(createStatus).toBe(201);
    const { status } = await del(srv.baseUrl, `/api/v1/orchestrator/workflows/${created.id}`);
    expect(status).toBe(204);
    const { status: getStatus } = await get(
      srv.baseUrl,
      `/api/v1/orchestrator/workflows/${created.id}`
    );
    expect(getStatus).toBe(404);
  });
});

// ─── Executions ───────────────────────────────────────────────────────────────

describe('GET /api/v1/orchestrator/executions', () => {
  it('returns paginated executions', async () => {
    const { status, body } = await get<{ data: WorkflowExecution[]; total: number }>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions'
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('filters by workflowId', async () => {
    const { body: wfList } = await get<Workflow[]>(srv.baseUrl, '/api/v1/orchestrator/workflows');
    const id = wfList[0]!.id;
    const { body } = await get<{ data: WorkflowExecution[]; total: number }>(
      srv.baseUrl,
      `/api/v1/orchestrator/executions?workflowId=${id}`
    );
    body.data.forEach((e) => expect(e.workflowId).toBe(id));
  });

  it('filters by status', async () => {
    const { body } = await get<{ data: WorkflowExecution[]; total: number }>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions?status=COMPLETED'
    );
    body.data.forEach((e) => expect(e.status).toBe('COMPLETED'));
  });

  it('respects limit/offset', async () => {
    const { body } = await get<{ data: WorkflowExecution[]; total: number }>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions?limit=5&offset=0'
    );
    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /api/v1/orchestrator/executions/stats', () => {
  it('returns execution statistics', async () => {
    const { status, body } = await get<Record<string, number>>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions/stats'
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('completed');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('avgDurationMs');
  });
});

describe('GET /api/v1/orchestrator/executions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/orchestrator/executions/nope');
    expect(status).toBe(404);
  });

  it('returns execution with steps', async () => {
    const { body: page } = await get<{ data: WorkflowExecution[] }>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions?limit=1'
    );
    const id = page.data[0]?.id;
    if (!id) return;
    const { status, body } = await get<WorkflowExecution>(
      srv.baseUrl,
      `/api/v1/orchestrator/executions/${id}`
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.steps)).toBe(true);
  });
});

describe('POST /api/v1/orchestrator/executions/:id/cancel', () => {
  it('returns 409 when execution is not running', async () => {
    const { body: page } = await get<{ data: WorkflowExecution[] }>(
      srv.baseUrl,
      '/api/v1/orchestrator/executions?status=COMPLETED&limit=1'
    );
    const id = page.data[0]?.id;
    if (!id) return;
    const { status } = await post(srv.baseUrl, `/api/v1/orchestrator/executions/${id}/cancel`);
    expect(status).toBe(409);
  });
});

// ─── Queue ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/orchestrator/queue', () => {
  it('returns queue state', async () => {
    const { status, body } = await get<{ queue: unknown[]; depth: number }>(
      srv.baseUrl,
      '/api/v1/orchestrator/queue'
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('queue');
    expect(body).toHaveProperty('depth');
  });
});

describe('GET /api/v1/orchestrator/queue/dlq', () => {
  it('returns DLQ state', async () => {
    const { status, body } = await get<{ dlq: unknown[]; depth: number }>(
      srv.baseUrl,
      '/api/v1/orchestrator/queue/dlq'
    );
    expect(status).toBe(200);
    expect(body).toHaveProperty('dlq');
    expect(body).toHaveProperty('depth');
  });
});

describe('POST /api/v1/orchestrator/queue/dlq/:jobId/retry', () => {
  it('returns 404 for unknown job', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/orchestrator/queue/dlq/nonexistent/retry');
    expect(status).toBe(404);
  });

  it('moves DLQ job back to queue', async () => {
    const { body: dlqState } = await get<{ dlq: Array<{ id: string }> }>(
      srv.baseUrl,
      '/api/v1/orchestrator/queue/dlq'
    );
    if (dlqState.dlq.length === 0) return;
    const jobId = dlqState.dlq[0]!.id;
    const { status } = await post(srv.baseUrl, `/api/v1/orchestrator/queue/dlq/${jobId}/retry`);
    expect(status).toBe(200);
  });
});

describe('DELETE /api/v1/orchestrator/queue/dlq', () => {
  it('purges DLQ', async () => {
    const { status, body } = (await del(srv.baseUrl, '/api/v1/orchestrator/queue/dlq')) as {
      status: number;
      body?: unknown;
    };
    void body;
    expect(status).toBe(200);
  });
});
