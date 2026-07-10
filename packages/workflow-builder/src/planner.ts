import type { WorkflowPlan, WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType } from './types.js';

export function buildSystemPrompt(): string {
  return `Você é um especialista em integração de sistemas e iPaaS (Integration Platform as a Service).
Seu papel é converter descrições em linguagem natural de fluxos de integração em grafos de workflow estruturados.

Você DEVE responder APENAS com um JSON válido no seguinte formato (sem texto antes ou depois do JSON):
{
  "name": "Nome do Workflow",
  "description": "Descrição em uma linha",
  "reasoning": "Explicação da abordagem escolhida",
  "confidence": 0.0,
  "graph": {
    "nodes": [
      {
        "id": "n1",
        "type": "trigger_type",
        "label": "Rótulo do Nó",
        "config": {},
        "position": { "x": 100, "y": 100 }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2", "label": "opcional" }
    ]
  }
}

Tipos de nó disponíveis por categoria:

ENTRADA: trigger, webhook, schedule, file-watch, email-trigger, api-trigger, queue-trigger, manual-trigger
PROCESSAMENTO: transform, validate, condition, loop, aggregate, filter, merge, split, delay, retry
IA: ai-classify, ai-extract, ai-generate, ai-translate, ai-summarize, ai-embed
SAÍDA: http, notification, log, dlq, database-write, file-write

Regras:
1. Todo workflow deve começar com um nó de ENTRADA
2. Use nós de IA (ai-*) quando o contexto envolver classificação, geração ou análise inteligente
3. Inclua sempre um nó "log" no final para auditoria
4. Para integrações com sistemas externos, use "http" com método e url apropriados
5. O campo "confidence" deve ser entre 0.0 e 1.0, refletindo sua confiança no plano gerado
6. Posicione os nós com x crescente da esquerda para direita e y variando para paralelos`;
}

export function parsePlanFromText(text: string): WorkflowPlan | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const raw = JSON.parse(match[0]) as {
      name?: string;
      description?: string;
      reasoning?: string;
      confidence?: number;
      graph?: WorkflowGraph;
    };

    if (!raw.graph?.nodes?.length) return null;

    return {
      name: raw.name ?? 'Workflow Gerado por IA',
      description: raw.description ?? '',
      reasoning: raw.reasoning ?? '',
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.8,
      graph: raw.graph,
    };
  } catch {
    return null;
  }
}

export function demoPlan(prompt: string): WorkflowPlan {
  const lower = prompt.toLowerCase();

  // Detect intent keywords
  const isSync = lower.includes('sincroniz') || lower.includes('sync');
  const isOrder = lower.includes('pedido') || lower.includes('order');
  const isBI = lower.includes('relatório') || lower.includes('bi') || lower.includes('analytics');
  const isOnboarding =
    lower.includes('onboarding') || lower.includes('cadastro') || lower.includes('cliente novo');
  const isInventory = lower.includes('estoque') || lower.includes('inventory');
  const isEmail = lower.includes('email') || lower.includes('notif');

  if (isOrder) {
    return buildOrderPlan(prompt);
  } else if (isBI) {
    return buildBIPlan(prompt);
  } else if (isOnboarding) {
    return buildOnboardingPlan(prompt);
  } else if (isInventory) {
    return buildInventoryPlan(prompt);
  } else {
    return buildGenericSyncPlan(prompt, isSync, isEmail);
  }
}

function buildOrderPlan(prompt: string): WorkflowPlan {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'webhook',
      label: 'Receber Pedido',
      config: { path: '/order' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'n2',
      type: 'validate',
      label: 'Validar Pedido',
      config: { schema: 'order' },
      position: { x: 300, y: 100 },
    },
    {
      id: 'n3',
      type: 'http',
      label: 'Reservar Estoque',
      config: { method: 'POST', url: '/wms/reserve' },
      position: { x: 500, y: 100 },
    },
    {
      id: 'n4',
      type: 'condition',
      label: 'Aprovado?',
      config: { expression: 'reserved === true' },
      position: { x: 700, y: 100 },
    },
    {
      id: 'n5',
      type: 'http',
      label: 'Gerar NF-e',
      config: { method: 'POST', url: '/fiscal/nfe' },
      position: { x: 900, y: 50 },
    },
    {
      id: 'n6',
      type: 'notification',
      label: 'Confirmar ao Cliente',
      config: { channel: 'email' },
      position: { x: 1100, y: 50 },
    },
    {
      id: 'n7',
      type: 'notification',
      label: 'Alerta Sem Estoque',
      config: { channel: 'slack' },
      position: { x: 900, y: 200 },
    },
    {
      id: 'n8',
      type: 'log',
      label: 'Log Pedido',
      config: { level: 'info' },
      position: { x: 1300, y: 100 },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5', label: 'true' },
    { id: 'e5', source: 'n4', target: 'n7', label: 'false' },
    { id: 'e6', source: 'n5', target: 'n6' },
    { id: 'e7', source: 'n6', target: 'n8' },
    { id: 'e8', source: 'n7', target: 'n8' },
  ];
  return {
    name: 'Pipeline de Processamento de Pedidos',
    description: 'Recebe pedidos via webhook, valida, reserva estoque e emite NF-e.',
    reasoning:
      'Fluxo sequencial com webhook de entrada, validação, reserva de estoque condicional e notificação ao cliente.',
    confidence: 0.88,
    graph: { nodes, edges },
  };
}

function buildBIPlan(prompt: string): WorkflowPlan {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'schedule',
      label: 'ETL Noturno',
      config: { cron: '0 2 * * *' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'n2',
      type: 'http',
      label: 'Extrair do ERP',
      config: { method: 'GET', url: '/erp/data' },
      position: { x: 300, y: 100 },
    },
    {
      id: 'n3',
      type: 'transform',
      label: 'Transformar Dados',
      config: { mapping: 'erp_to_dw' },
      position: { x: 500, y: 100 },
    },
    {
      id: 'n4',
      type: 'ai-summarize',
      label: 'Gerar Insights IA',
      config: { model: 'claude-opus-4-8' },
      position: { x: 700, y: 100 },
    },
    {
      id: 'n5',
      type: 'database-write',
      label: 'Gravar no DW',
      config: { table: 'fact_sales' },
      position: { x: 900, y: 100 },
    },
    {
      id: 'n6',
      type: 'notification',
      label: 'Relatório por Email',
      config: { channel: 'email' },
      position: { x: 1100, y: 100 },
    },
    {
      id: 'n7',
      type: 'log',
      label: 'Log ETL',
      config: { level: 'info' },
      position: { x: 1300, y: 100 },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6' },
    { id: 'e6', source: 'n6', target: 'n7' },
  ];
  return {
    name: 'Pipeline ETL para BI',
    description:
      'Extrai dados do ERP, transforma, gera insights com IA e carrega no data warehouse.',
    reasoning: 'Agendamento noturno com ETL completo e sumário inteligente gerado por Claude.',
    confidence: 0.85,
    graph: { nodes, edges },
  };
}

function buildOnboardingPlan(prompt: string): WorkflowPlan {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'webhook',
      label: 'Novo Cadastro',
      config: { path: '/signup' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'n2',
      type: 'ai-classify',
      label: 'Segmentar Cliente',
      config: { model: 'claude-opus-4-8', task: 'segment' },
      position: { x: 300, y: 100 },
    },
    {
      id: 'n3',
      type: 'ai-extract',
      label: 'Extrair Perfil',
      config: { model: 'claude-opus-4-8', fields: ['industry'] },
      position: { x: 500, y: 100 },
    },
    {
      id: 'n4',
      type: 'http',
      label: 'Criar no CRM',
      config: { method: 'POST', url: '/crm/contacts' },
      position: { x: 700, y: 100 },
    },
    {
      id: 'n5',
      type: 'ai-generate',
      label: 'E-mail Personalizado',
      config: { model: 'claude-opus-4-8', template: 'welcome' },
      position: { x: 900, y: 100 },
    },
    {
      id: 'n6',
      type: 'notification',
      label: 'Enviar Boas-Vindas',
      config: { channel: 'email' },
      position: { x: 1100, y: 100 },
    },
    {
      id: 'n7',
      type: 'log',
      label: 'Log Onboarding',
      config: { level: 'info' },
      position: { x: 1300, y: 100 },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6' },
    { id: 'e6', source: 'n6', target: 'n7' },
  ];
  return {
    name: 'Onboarding Inteligente de Clientes',
    description:
      'Classifica e extrai perfil do cliente com IA, cria no CRM e envia e-mail personalizado.',
    reasoning: 'Uso de múltiplos nós de IA para personalizar a jornada de onboarding do cliente.',
    confidence: 0.9,
    graph: { nodes, edges },
  };
}

function buildInventoryPlan(prompt: string): WorkflowPlan {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'schedule',
      label: 'Sync Horário',
      config: { cron: '0 * * * *' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'n2',
      type: 'http',
      label: 'Buscar Estoque ERP',
      config: { method: 'GET', url: '/erp/stock' },
      position: { x: 300, y: 100 },
    },
    {
      id: 'n3',
      type: 'validate',
      label: 'Validar Quantidades',
      config: { schema: 'stock' },
      position: { x: 500, y: 100 },
    },
    {
      id: 'n4',
      type: 'transform',
      label: 'Formatar para Canais',
      config: { mapping: 'stock_to_channels' },
      position: { x: 700, y: 100 },
    },
    {
      id: 'n5',
      type: 'http',
      label: 'Atualizar Ecommerce',
      config: { method: 'PUT', url: '/ecom/stock' },
      position: { x: 900, y: 50 },
    },
    {
      id: 'n6',
      type: 'http',
      label: 'Atualizar WMS',
      config: { method: 'PUT', url: '/wms/stock' },
      position: { x: 900, y: 200 },
    },
    {
      id: 'n7',
      type: 'log',
      label: 'Log Sync Estoque',
      config: { level: 'info' },
      position: { x: 1100, y: 125 },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n4', target: 'n6' },
    { id: 'e6', source: 'n5', target: 'n7' },
    { id: 'e7', source: 'n6', target: 'n7' },
  ];
  return {
    name: 'Sincronização de Estoque Multi-Canal',
    description: 'Sincroniza estoque do ERP para e-commerce e WMS a cada hora.',
    reasoning: 'Agendamento horário com split de atualização paralela para múltiplos destinos.',
    confidence: 0.87,
    graph: { nodes, edges },
  };
}

function buildGenericSyncPlan(prompt: string, isSync: boolean, isEmail: boolean): WorkflowPlan {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'trigger',
      label: 'Disparador',
      config: { event: 'data.changed' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'n2',
      type: 'http',
      label: 'Buscar Dados',
      config: { method: 'GET', url: '/source/data' },
      position: { x: 300, y: 100 },
    },
    {
      id: 'n3',
      type: 'transform',
      label: 'Transformar',
      config: { mapping: 'source_to_dest' },
      position: { x: 500, y: 100 },
    },
    {
      id: 'n4',
      type: 'validate',
      label: 'Validar',
      config: { schema: 'destination_schema' },
      position: { x: 700, y: 100 },
    },
    {
      id: 'n5',
      type: 'http',
      label: 'Enviar ao Destino',
      config: { method: 'POST', url: '/dest/data' },
      position: { x: 900, y: 100 },
    },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
  ];

  if (isEmail) {
    nodes.push({
      id: 'n6',
      type: 'notification',
      label: 'Notificar por Email',
      config: { channel: 'email' },
      position: { x: 1100, y: 100 },
    });
    edges.push({ id: 'e5', source: 'n5', target: 'n6' });
    nodes.push({
      id: 'n7',
      type: 'log',
      label: 'Log',
      config: { level: 'info' },
      position: { x: 1300, y: 100 },
    });
    edges.push({ id: 'e6', source: 'n6', target: 'n7' });
  } else {
    nodes.push({
      id: 'n6',
      type: 'log',
      label: 'Log',
      config: { level: 'info' },
      position: { x: 1100, y: 100 },
    });
    edges.push({ id: 'e5', source: 'n5', target: 'n6' });
  }

  return {
    name: isSync ? 'Fluxo de Sincronização' : 'Fluxo de Integração',
    description: `Integração gerada com base em: "${prompt.slice(0, 80)}..."`,
    reasoning:
      'Fluxo genérico de integração com trigger, transformação, validação e envio ao destino.',
    confidence: 0.75,
    graph: { nodes, edges },
  };
}

export function planToGraph(plan: WorkflowPlan): WorkflowGraph {
  return plan.graph;
}
