import { describe, it, expect } from 'vitest';
import { WorkflowValidator } from '../validator.js';
import type { WorkflowGraph } from '../types.js';

const validator = new WorkflowValidator();

function graph(nodes: WorkflowGraph['nodes'], edges: WorkflowGraph['edges']): WorkflowGraph {
  return { nodes, edges };
}

describe('WorkflowValidator', () => {
  it('accepts a valid linear workflow', () => {
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
    const result = validator.validate(g);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects workflow with no trigger', () => {
    const g = graph(
      [
        { id: 'n1', type: 'transform', label: 'Map', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'log', label: 'Log', config: {}, position: { x: 200, y: 0 } },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }]
    );
    const result = validator.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'NO_TRIGGER')).toBe(true);
  });

  it('accepts all entry node types as triggers', () => {
    const types: WorkflowGraph['nodes'][0]['type'][] = [
      'trigger',
      'webhook',
      'schedule',
      'file-watch',
      'email-trigger',
      'api-trigger',
      'queue-trigger',
      'manual-trigger',
    ];
    for (const t of types) {
      const g = graph(
        [
          { id: 'n1', type: t, label: 'Start', config: {}, position: { x: 0, y: 0 } },
          { id: 'n2', type: 'log', label: 'Log', config: {}, position: { x: 200, y: 0 } },
        ],
        [{ id: 'e1', source: 'n1', target: 'n2' }]
      );
      const result = validator.validate(g);
      expect(result.errors.some((e) => e.code === 'NO_TRIGGER')).toBe(false);
    }
  });

  it('rejects orphan nodes', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'transform', label: 'Map', config: {}, position: { x: 200, y: 0 } },
        { id: 'n3', type: 'log', label: 'Orphan', config: {}, position: { x: 400, y: 0 } },
      ],
      [{ id: 'e1', source: 'n1', target: 'n2' }]
    );
    const result = validator.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ORPHAN_NODE' && e.nodeId === 'n3')).toBe(true);
  });

  it('detects cycles', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'transform', label: 'A', config: {}, position: { x: 200, y: 0 } },
        { id: 'n3', type: 'transform', label: 'B', config: {}, position: { x: 400, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n2' }, // cycle
      ]
    );
    const result = validator.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'CYCLE_DETECTED')).toBe(true);
  });

  it('rejects condition node with only one outgoing edge', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'condition', label: 'Check', config: {}, position: { x: 200, y: 0 } },
        { id: 'n3', type: 'log', label: 'Log', config: {}, position: { x: 400, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' }, // only one branch
      ]
    );
    const result = validator.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'CONDITION_NEEDS_TWO_EDGES')).toBe(true);
  });

  it('accepts condition node with two outgoing edges', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        { id: 'n2', type: 'condition', label: 'Check', config: {}, position: { x: 200, y: 0 } },
        { id: 'n3', type: 'log', label: 'Yes', config: {}, position: { x: 400, y: -50 } },
        { id: 'n4', type: 'log', label: 'No', config: {}, position: { x: 400, y: 50 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'true' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'false' },
      ]
    );
    const result = validator.validate(g);
    expect(result.errors.some((e) => e.code === 'CONDITION_NEEDS_TWO_EDGES')).toBe(false);
  });

  it('rejects http node without url config', () => {
    const g = graph(
      [
        { id: 'n1', type: 'trigger', label: 'Start', config: {}, position: { x: 0, y: 0 } },
        {
          id: 'n2',
          type: 'http',
          label: 'Call',
          config: { method: 'GET' },
          position: { x: 200, y: 0 },
        }, // missing url
        { id: 'n3', type: 'log', label: 'Log', config: {}, position: { x: 400, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]
    );
    const result = validator.validate(g);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_CONFIG' && e.nodeId === 'n2')).toBe(true);
  });

  it('passes single-node workflow if it is a trigger', () => {
    const g = graph(
      [{ id: 'n1', type: 'trigger', label: 'Only node', config: {}, position: { x: 0, y: 0 } }],
      []
    );
    const result = validator.validate(g);
    expect(result.errors.some((e) => e.code === 'NO_TRIGGER')).toBe(false);
    expect(result.errors.some((e) => e.code === 'ORPHAN_NODE')).toBe(false);
  });
});
