import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '../../modules/orchestrator/execution-engine.js';
import type { Workflow } from '../../modules/orchestrator/types.js';
import { randomUUID } from 'node:crypto';

function makeWorkflow(
  nodes: Workflow['graph']['nodes'],
  edges: Workflow['graph']['edges']
): Workflow {
  return {
    id: randomUUID(),
    name: 'Test Workflow',
    description: '',
    active: true,
    version: 1,
    graph: { nodes, edges },
    triggerType: 'MANUAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    tags: [],
  };
}

describe('executeWorkflow — linear flow', () => {
  it('completes a trigger → transform → log workflow', async () => {
    const wf = makeWorkflow(
      [
        {
          id: 'n1',
          type: 'trigger',
          label: 'Trigger',
          config: { triggerType: 'MANUAL' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          type: 'transform',
          label: 'Transform',
          config: { expression: 'map(input)', outputVar: 'out' },
          position: { x: 0, y: 100 },
        },
        {
          id: 'n3',
          type: 'log',
          label: 'Log',
          config: { level: 'info', message: 'done' },
          position: { x: 0, y: 200 },
        },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]
    );
    const exec = await executeWorkflow(wf, { foo: 'bar' });
    expect(exec.status).toBe('COMPLETED');
    expect(exec.steps.length).toBe(3);
    expect(exec.steps.every((s) => s.status === 'COMPLETED')).toBe(true);
    expect(exec.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('executeWorkflow — condition branching', () => {
  it('follows the true branch', async () => {
    const wf = makeWorkflow(
      [
        {
          id: 'n1',
          type: 'trigger',
          label: 'T',
          config: { triggerType: 'MANUAL' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          type: 'condition',
          label: 'C',
          config: { expression: 'true' },
          position: { x: 0, y: 100 },
        },
        {
          id: 'n3',
          type: 'log',
          label: 'Yes',
          config: { level: 'info', message: 'yes' },
          position: { x: -100, y: 200 },
        },
        {
          id: 'n4',
          type: 'dlq',
          label: 'No',
          config: { reason: 'no' },
          position: { x: 100, y: 200 },
        },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'true' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'false' },
      ]
    );
    const exec = await executeWorkflow(wf);
    expect(exec.status).toBe('COMPLETED');
    const nodeIds = exec.steps.map((s) => s.nodeId);
    expect(nodeIds).toContain('n3');
    expect(nodeIds).not.toContain('n4');
  });

  it('follows the false branch', async () => {
    const wf = makeWorkflow(
      [
        {
          id: 'n1',
          type: 'trigger',
          label: 'T',
          config: { triggerType: 'MANUAL' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          type: 'condition',
          label: 'C',
          config: { expression: 'false' },
          position: { x: 0, y: 100 },
        },
        {
          id: 'n3',
          type: 'log',
          label: 'Yes',
          config: { level: 'info', message: 'y' },
          position: { x: -100, y: 200 },
        },
        {
          id: 'n4',
          type: 'dlq',
          label: 'No',
          config: { reason: 'no' },
          position: { x: 100, y: 200 },
        },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'true' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'false' },
      ]
    );
    const exec = await executeWorkflow(wf);
    const nodeIds = exec.steps.map((s) => s.nodeId);
    expect(nodeIds).toContain('n4');
    expect(nodeIds).not.toContain('n3');
  });
});

describe('executeWorkflow — missing trigger', () => {
  it('fails immediately when there is no trigger node', async () => {
    const wf = makeWorkflow(
      [
        {
          id: 'n1',
          type: 'log',
          label: 'Log',
          config: { level: 'info', message: 'x' },
          position: { x: 0, y: 0 },
        },
      ],
      []
    );
    const exec = await executeWorkflow(wf);
    expect(exec.status).toBe('FAILED');
    expect(exec.error).toMatch(/trigger/i);
  });
});

describe('executeWorkflow — increments counters', () => {
  it('increments executionCount and successCount on success', async () => {
    const wf = makeWorkflow(
      [
        {
          id: 'n1',
          type: 'trigger',
          label: 'T',
          config: { triggerType: 'MANUAL' },
          position: { x: 0, y: 0 },
        },
      ],
      []
    );
    await executeWorkflow(wf);
    expect(wf.executionCount).toBe(1);
    expect(wf.successCount).toBe(1);
    expect(wf.failureCount).toBe(0);
  });
});
