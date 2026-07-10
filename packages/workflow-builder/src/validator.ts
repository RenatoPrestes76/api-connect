import type { WorkflowGraph, ValidationResult, ValidationError } from './types.js';

export class WorkflowValidator {
  validate(graph: WorkflowGraph): ValidationResult {
    const errors: ValidationError[] = [];

    this.checkHasTrigger(graph, errors);
    this.checkOrphanNodes(graph, errors);
    this.checkNoCycles(graph, errors);
    this.checkConditionEdges(graph, errors);
    this.checkRequiredConfig(graph, errors);

    return { valid: errors.length === 0, errors };
  }

  private checkHasTrigger(graph: WorkflowGraph, errors: ValidationError[]): void {
    const TRIGGER_TYPES = new Set([
      'trigger',
      'webhook',
      'schedule',
      'file-watch',
      'email-trigger',
      'api-trigger',
      'queue-trigger',
      'manual-trigger',
    ]);
    const hasTrigger = graph.nodes.some((n) => TRIGGER_TYPES.has(n.type));
    if (!hasTrigger) {
      errors.push({
        code: 'NO_TRIGGER',
        message:
          'O workflow precisa de pelo menos um nó de entrada (trigger, webhook, schedule, etc.)',
      });
    }
  }

  private checkOrphanNodes(graph: WorkflowGraph, errors: ValidationError[]): void {
    if (graph.nodes.length <= 1) return;

    const connected = new Set<string>();
    for (const edge of graph.edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }

    for (const node of graph.nodes) {
      if (!connected.has(node.id)) {
        errors.push({
          code: 'ORPHAN_NODE',
          message: `Nó "${node.label}" (${node.id}) está isolado — conecte-o ao fluxo.`,
          nodeId: node.id,
        });
      }
    }
  }

  private checkNoCycles(graph: WorkflowGraph, errors: ValidationError[]): void {
    const adj = new Map<string, string[]>();
    for (const node of graph.nodes) adj.set(node.id, []);
    for (const edge of graph.edges) adj.get(edge.source)?.push(edge.target);

    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    for (const node of graph.nodes) color.set(node.id, WHITE);

    const dfs = (id: string): boolean => {
      color.set(id, GRAY);
      for (const next of adj.get(id) ?? []) {
        if (color.get(next) === GRAY) return true;
        if (color.get(next) === WHITE && dfs(next)) return true;
      }
      color.set(id, BLACK);
      return false;
    };

    for (const node of graph.nodes) {
      if (color.get(node.id) === WHITE && dfs(node.id)) {
        errors.push({
          code: 'CYCLE_DETECTED',
          message: 'O workflow contém um ciclo. Workflows devem ser grafos acíclicos (DAG).',
          nodeId: node.id,
        });
        break;
      }
    }
  }

  private checkConditionEdges(graph: WorkflowGraph, errors: ValidationError[]): void {
    const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
    for (const node of conditionNodes) {
      const outgoing = graph.edges.filter((e) => e.source === node.id);
      if (outgoing.length < 2) {
        errors.push({
          code: 'CONDITION_NEEDS_TWO_EDGES',
          message: `Nó de condição "${node.label}" precisa de pelo menos 2 arestas de saída (true/false).`,
          nodeId: node.id,
        });
      }
    }
  }

  private checkRequiredConfig(graph: WorkflowGraph, errors: ValidationError[]): void {
    const REQUIRED: Record<string, string[]> = {
      http: ['url'],
      webhook: ['path'],
      schedule: ['cron'],
      'database-write': ['table'],
      'file-write': ['path'],
      'ai-classify': ['task'],
      'ai-extract': ['fields'],
      'ai-generate': ['template'],
    };

    for (const node of graph.nodes) {
      const required = REQUIRED[node.type];
      if (!required) continue;
      for (const field of required) {
        if (!node.config[field]) {
          errors.push({
            code: 'MISSING_CONFIG',
            message: `Nó "${node.label}" precisa configurar o campo "${field}".`,
            nodeId: node.id,
          });
        }
      }
    }
  }
}

export const workflowValidator = new WorkflowValidator();
