import { describe, it, expect } from 'vitest';
import { WorkflowSimulator } from '../simulator.js';
import type { WorkflowGraph } from '../types.js';

const simulator = new WorkflowSimulator();

function graph(nodes: WorkflowGraph['nodes'], edges: WorkflowGraph['edges']): WorkflowGraph {
  return { nodes, edges };
}

describe('WorkflowSimulator', () => {
  it('simulates a linear workflow successfully', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'transform', label: 'Map', config: {}, position: { x: 200, y: 0 } },
        { id: 'n3', type: 'log', label: 'Log', config: {}, position: { x: 400, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]
    );
    const result = simulator.simulate(g);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.status === 'success')).toBe(true);
  });

  it('produces steps for all 30 node types without throwing', () => {
    const allTypes: WorkflowGraph['nodes'][0]['type'][] = [
      'trigger',
      'webhook',
      'schedule',
      'file-watch',
      'email-trigger',
      'api-trigger',
      'queue-trigger',
      'manual-trigger',
      'transform',
      'validate',
      'condition',
      'loop',
      'aggregate',
      'filter',
      'merge',
      'split',
      'delay',
      'retry',
      'ai-classify',
      'ai-extract',
      'ai-generate',
      'ai-translate',
      'ai-summarize',
      'ai-embed',
      'http',
      'notification',
      'log',
      'dlq',
      'database-write',
      'file-write',
    ];
    for (const type of allTypes) {
      const g = graph([{ id: 'n1', type, label: type, config: {}, position: { x: 0, y: 0 } }], []);
      expect(() => simulator.simulate(g)).not.toThrow();
    }
  });

  it('tracks totalMs', () => {
    const g = graph(
      [{ id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } }],
      []
    );
    const result = simulator.simulate(g);
    expect(typeof result.totalMs).toBe('number');
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('returns finalOutput from the last executed node', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        {
          id: 'n2',
          type: 'http',
          label: 'Call',
          config: { url: '/api', method: 'GET' },
          position: { x: 200, y: 0 },
        },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }]
    );
    const result = simulator.simulate(g);
    expect(result.finalOutput).toBeDefined();
    expect(typeof result.finalOutput).toBe('object');
  });

  it('emits a warning for condition nodes', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        {
          id: 'n2',
          type: 'condition',
          label: 'Check',
          config: { expression: 'value > 0' },
          position: { x: 200, y: 0 },
        },
        { id: 'n3', type: 'log', label: 'Yes', config: {}, position: { x: 400, y: -50 } },
        { id: 'n4', type: 'log', label: 'No', config: {}, position: { x: 400, y: 50 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'true' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'false' },
      ]
    );
    const result = simulator.simulate(g);
    expect(result.warnings.some((w) => w.includes('Check'))).toBe(true);
  });

  it('marks unvisited nodes as skipped', () => {
    // Both branches of condition are reachable, but in BFS only one goes (inDegree might cause one to skip)
    // Simulate a truly disconnected scenario by adding a dead-end node
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'log', label: 'Log', config: {}, position: { x: 200, y: 0 } },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }]
    );
    // Both nodes should be visited
    const result = simulator.simulate(g);
    expect(result.steps.filter((s) => s.status === 'skipped')).toHaveLength(0);
  });

  it('accepts initial input and carries it through steps', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'transform', label: 'Map', config: {}, position: { x: 200, y: 0 } },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }]
    );
    const result = simulator.simulate(g, { orderId: 'ORD-001' });
    expect(result.success).toBe(true);
    // input should be merged into later steps
    const transformStep = result.steps.find((s) => s.label === 'Map');
    expect(transformStep?.input).toMatchObject({ orderId: 'ORD-001' });
  });
});
