import type { WorkflowGraph, WorkflowNode, SimulationResult, SimulationStep } from './types.js';

const MOCK_PAYLOADS: Record<string, Record<string, unknown>> = {
  trigger: { event: 'product.updated', productId: 'PROD-001', timestamp: new Date().toISOString() },
  webhook: { method: 'POST', path: '/webhook', body: { id: 'REQ-001', data: { key: 'value' } } },
  schedule: { triggeredAt: new Date().toISOString(), cron: '*/5 * * * *' },
  'file-watch': { file: '/uploads/data.csv', event: 'created', size: 1024 },
  'email-trigger': {
    from: 'remetente@empresa.com',
    subject: 'Novo Pedido #1234',
    body: 'Pedido recebido...',
  },
  'api-trigger': { endpoint: '/api/trigger', payload: { action: 'sync' } },
  'queue-trigger': { queue: 'orders', messageId: 'MSG-001', payload: { orderId: 'ORD-001' } },
  'manual-trigger': { triggeredBy: 'user@empresa.com', reason: 'Manual sync requested' },
  transform: { mapped: true, records: 5, fields: ['id', 'name', 'price', 'stock'] },
  validate: { valid: true, errors: [], checkedFields: 12 },
  condition: { result: true, expression: 'evaluated', value: 42 },
  loop: { iterations: 3, results: [{ id: 1 }, { id: 2 }, { id: 3 }] },
  aggregate: { count: 150, sum: 45000, avg: 300, min: 10, max: 2500 },
  filter: { matched: 12, filtered: 3, total: 15 },
  merge: { sources: 2, records: 25, mergedAt: new Date().toISOString() },
  split: { branches: 3, distributed: [10, 8, 7] },
  delay: { delayedMs: 5000, resumedAt: new Date().toISOString() },
  retry: { attempts: 1, succeeded: true },
  'ai-classify': { classification: 'premium_customer', confidence: 0.94, model: 'claude-opus-4-8' },
  'ai-extract': {
    extracted: { name: 'Empresa LTDA', industry: 'retail', size: 'medium' },
    confidence: 0.91,
  },
  'ai-generate': {
    generated: 'Conteúdo gerado pela IA com base no contexto fornecido.',
    tokens: 256,
    model: 'claude-opus-4-8',
  },
  'ai-translate': {
    translated: 'Content translated to English.',
    sourceLang: 'pt',
    targetLang: 'en',
  },
  'ai-summarize': {
    summary: 'Resumo gerado: 3 produtos atualizados, 2 com divergência de estoque.',
    model: 'claude-opus-4-8',
  },
  'ai-embed': { dimensions: 1536, similarity: 0.87, index: 'products' },
  http: { status: 200, ok: true, responseTime: 142, body: { success: true } },
  notification: {
    sent: true,
    channel: 'email',
    recipients: 1,
    deliveredAt: new Date().toISOString(),
  },
  log: { logged: true, level: 'info', timestamp: new Date().toISOString() },
  dlq: {
    queued: true,
    messageId: 'DLQ-001',
    retryAfter: new Date(Date.now() + 60000).toISOString(),
  },
  'database-write': { inserted: 5, updated: 3, errors: 0 },
  'file-write': { written: true, bytes: 2048, path: '/output/result.json' },
};

export class WorkflowSimulator {
  simulate(graph: WorkflowGraph, input: Record<string, unknown> = {}): SimulationResult {
    const start = Date.now();
    const steps: SimulationStep[] = [];
    const warnings: string[] = [];

    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }
    for (const edge of graph.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      adj.get(edge.source)?.push(edge.target);
    }

    // BFS from trigger nodes
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const visited = new Set<string>();
    let currentInput: Record<string, unknown> = { ...input };
    let finalOutput: Record<string, unknown> = {};

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeMap.get(id);
      if (!node) continue;

      const step = this.executeNode(node, currentInput, warnings);
      steps.push(step);

      if (step.status === 'success') {
        currentInput = { ...currentInput, ...step.output };
        finalOutput = step.output;
      }

      for (const next of adj.get(id) ?? []) {
        const remaining = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, remaining);
        if (remaining === 0) queue.push(next);
      }
    }

    // Warn about unvisited nodes (could be unreachable condition branches)
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        warnings.push(
          `Nó "${node.label}" não foi atingido durante a simulação (possível ramo de condição).`
        );
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          label: node.label,
          input: {},
          output: {},
          status: 'skipped',
          durationMs: 0,
        });
      }
    }

    return {
      success: steps.every((s) => s.status !== 'error'),
      steps,
      totalMs: Date.now() - start,
      finalOutput,
      warnings,
    };
  }

  private executeNode(
    node: WorkflowNode,
    input: Record<string, unknown>,
    warnings: string[]
  ): SimulationStep {
    const stepStart = Date.now();
    try {
      const mockOutput = MOCK_PAYLOADS[node.type] ?? { processed: true };
      const output = { ...mockOutput };

      if (node.type === 'condition') {
        const expr = (node.config['expression'] as string) ?? 'true';
        output['_conditionResult'] = expr.includes('errors') ? false : true;
        warnings.push(
          `Condição "${node.label}" avaliada como ${output['_conditionResult']} (simulação).`
        );
      }

      return {
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        input,
        output,
        status: 'success',
        durationMs: Date.now() - stepStart + Math.floor(Math.random() * 50),
      };
    } catch (err) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        input,
        output: {},
        status: 'error',
        durationMs: Date.now() - stepStart,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const workflowSimulator = new WorkflowSimulator();
