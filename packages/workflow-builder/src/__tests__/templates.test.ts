import { describe, it, expect } from 'vitest';
import { WORKFLOW_TEMPLATES, getTemplate, listTemplates } from '../templates.js';

describe('WORKFLOW_TEMPLATES', () => {
  it('has exactly 10 templates', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(10);
  });

  it('every template has required fields', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(Array.isArray(tpl.tags)).toBe(true);
      expect(tpl.graph.nodes.length).toBeGreaterThan(0);
      expect(tpl.graph.edges.length).toBeGreaterThan(0);
    }
  });

  it('all template IDs are unique', () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has at least one entry-type node', () => {
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
    for (const tpl of WORKFLOW_TEMPLATES) {
      const hasEntry = tpl.graph.nodes.some((n) => ENTRY.has(n.type));
      expect(hasEntry, `${tpl.id} should have an entry node`).toBe(true);
    }
  });

  it('every template edge references valid node IDs', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      const nodeIds = new Set(tpl.graph.nodes.map((n) => n.id));
      for (const edge of tpl.graph.edges) {
        expect(
          nodeIds.has(edge.source),
          `edge ${edge.id} source ${edge.source} missing in ${tpl.id}`
        ).toBe(true);
        expect(
          nodeIds.has(edge.target),
          `edge ${edge.id} target ${edge.target} missing in ${tpl.id}`
        ).toBe(true);
      }
    }
  });
});

describe('getTemplate', () => {
  it('returns template by id', () => {
    const tpl = getTemplate('tpl-erp-ecommerce');
    expect(tpl).toBeDefined();
    expect(tpl?.id).toBe('tpl-erp-ecommerce');
  });

  it('returns undefined for unknown id', () => {
    expect(getTemplate('non-existent')).toBeUndefined();
  });
});

describe('listTemplates', () => {
  it('returns all templates when no category filter', () => {
    expect(listTemplates()).toHaveLength(10);
  });

  it('filters by category', () => {
    const erp = listTemplates('Integração ERP');
    expect(erp.length).toBeGreaterThan(0);
    expect(erp.every((t) => t.category === 'Integração ERP')).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    expect(listTemplates('Unknown Category')).toHaveLength(0);
  });
});
