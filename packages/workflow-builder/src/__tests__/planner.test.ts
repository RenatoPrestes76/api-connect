import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, parsePlanFromText, demoPlan, planToGraph } from '../planner.js';

describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes all 4 node categories', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('ENTRADA');
    expect(prompt).toContain('PROCESSAMENTO');
    expect(prompt).toContain('IA');
    expect(prompt).toContain('SAÍDA');
  });
});

describe('parsePlanFromText', () => {
  it('parses a valid JSON plan', () => {
    const text = `Here is the workflow:
{
  "name": "Test Workflow",
  "description": "A test",
  "reasoning": "Simple flow",
  "confidence": 0.9,
  "graph": {
    "nodes": [
      { "id": "n1", "type": "trigger", "label": "Start", "config": {}, "position": { "x": 0, "y": 0 } },
      { "id": "n2", "type": "log",     "label": "Log",   "config": {}, "position": { "x": 200, "y": 0 } }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2" }
    ]
  }
}`;
    const plan = parsePlanFromText(text);
    expect(plan).not.toBeNull();
    expect(plan?.name).toBe('Test Workflow');
    expect(plan?.confidence).toBe(0.9);
    expect(plan?.graph.nodes).toHaveLength(2);
    expect(plan?.graph.edges).toHaveLength(1);
  });

  it('returns null when no JSON found', () => {
    expect(parsePlanFromText('No JSON here at all')).toBeNull();
  });

  it('returns null when JSON has no nodes', () => {
    const text = `{ "name": "Empty", "graph": { "nodes": [], "edges": [] } }`;
    expect(parsePlanFromText(text)).toBeNull();
  });

  it('defaults confidence to 0.8 when not provided', () => {
    const text = `{
      "name": "Plan",
      "graph": {
        "nodes": [{ "id": "n1", "type": "trigger", "label": "T", "config": {}, "position": { "x": 0, "y": 0 } }],
        "edges": []
      }
    }`;
    const plan = parsePlanFromText(text);
    expect(plan?.confidence).toBe(0.8);
  });
});

describe('demoPlan', () => {
  it('generates a plan for order-related prompts', () => {
    const plan = demoPlan('criar fluxo para processar pedido de venda');
    expect(plan.name.toLowerCase()).toContain('pedido');
    expect(plan.graph.nodes.length).toBeGreaterThan(2);
  });

  it('generates a plan for inventory-related prompts', () => {
    const plan = demoPlan('sincronizar estoque entre ERP e WMS');
    expect(plan.graph.nodes.some((n) => n.type === 'schedule' || n.type === 'trigger')).toBe(true);
  });

  it('generates a plan for BI-related prompts', () => {
    const plan = demoPlan('pipeline de relatório e analytics para BI');
    expect(plan.graph.nodes.some((n) => n.type === 'ai-summarize')).toBe(true);
  });

  it('generates a plan for onboarding prompts', () => {
    const plan = demoPlan('onboarding de novo cliente com IA');
    expect(plan.graph.nodes.some((n) => n.type.startsWith('ai-'))).toBe(true);
  });

  it('always returns a graph with at least one trigger', () => {
    const ENTRY = new Set([
      'trigger',
      'webhook',
      'schedule',
      'file-watch',
      'email-trigger',
      'api-trigger',
      'queue-trigger',
      'manual-trigger',
    ]);
    const prompts = [
      'processar pedidos',
      'sincronizar estoque',
      'pipeline de BI',
      'onboarding de clientes',
      'integrar sistemas',
    ];
    for (const p of prompts) {
      const plan = demoPlan(p);
      expect(plan.graph.nodes.some((n) => ENTRY.has(n.type))).toBe(true);
    }
  });

  it('confidence is between 0 and 1', () => {
    const plan = demoPlan('integrar ERP com sistema externo');
    expect(plan.confidence).toBeGreaterThan(0);
    expect(plan.confidence).toBeLessThanOrEqual(1);
  });
});

describe('planToGraph', () => {
  it('returns the graph from the plan', () => {
    const plan = demoPlan('processar pedidos');
    const g = planToGraph(plan);
    expect(g).toBe(plan.graph);
  });
});
