import { randomUUID } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CopilotContext {
  tenantId?: string;
  environmentId?: string;
  connectorId?: string;
  workflowId?: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  context: CopilotContext;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export type CopilotAction = 'chat' | 'diagnose' | 'generate' | 'explain' | 'search';

export interface CopilotAuditLog {
  id: string;
  timestamp: string;
  action: CopilotAction;
  conversationId?: string;
  prompt: string;
  responsePreview: string;
  context: CopilotContext;
  modelUsed: string;
  durationMs?: number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

class CopilotStore {
  conversations: CopilotConversation[] = [];
  auditLogs: CopilotAuditLog[] = [];

  constructor() {
    this._seed();
  }

  getOrCreate(id: string | undefined, context: CopilotContext = {}): CopilotConversation {
    if (id) {
      const existing = this.conversations.find((c) => c.id === id);
      if (existing) {
        existing.updatedAt = new Date().toISOString();
        return existing;
      }
    }
    const now = new Date().toISOString();
    const conv: CopilotConversation = {
      id: id ?? randomUUID(),
      title: 'New Conversation',
      context,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.push(conv);
    return conv;
  }

  get(id: string): CopilotConversation | undefined {
    return this.conversations.find((c) => c.id === id);
  }

  delete(id: string): boolean {
    const idx = this.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.conversations.splice(idx, 1);
    return true;
  }

  updateTitle(id: string, title: string): void {
    const conv = this.conversations.find((c) => c.id === id);
    if (conv) conv.title = title;
  }

  addAuditLog(log: Omit<CopilotAuditLog, 'id' | 'timestamp'>): CopilotAuditLog {
    const entry: CopilotAuditLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  private _seed() {
    const minsAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

    const conv1Id = randomUUID();
    const conv2Id = randomUUID();

    const conv1: CopilotConversation = {
      id: conv1Id,
      title: 'ERP Product Sync Failure Diagnosis',
      context: { connectorId: 'conn-erp-prod', workflowId: 'wf-erp-product-sync' },
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          content: 'Por que o sync de produtos ERP falhou às 14:32?',
          timestamp: minsAgo(45),
        },
        {
          id: randomUUID(),
          role: 'assistant',
          content: `Com base nos logs de execução do workflow **wf-erp-product-sync**, o sync falhou às 14:32 por **connection timeout** no nó HTTP (passo 4/6).

**Causa Raiz:** O endpoint ERP \`/api/products/batch\` retornou timeout após 30s. Causas prováveis:
1. Alta carga no servidor ERP no horário comercial
2. Tamanho do lote muito grande (atual: 500 registros/lote)

**Correções Sugeridas:**
1. Reduzir tamanho do lote para 100: nó \`http-batch\` → \`batchSize: 100\`
2. Aumentar timeout: nó \`http-batch\` → \`timeoutMs: 60000\`
3. Ativar retry com backoff exponencial: \`retryOn: ["timeout", "5xx"]\`

Deseja que eu gere a configuração atualizada do workflow?`,
          timestamp: minsAgo(44),
        },
        {
          id: randomUUID(),
          role: 'user',
          content: 'Sim, gere a configuração atualizada',
          timestamp: minsAgo(43),
        },
        {
          id: randomUUID(),
          role: 'assistant',
          content: `Aqui está a configuração atualizada para o nó HTTP do workflow:

\`\`\`json
{
  "nodeId": "http-batch",
  "type": "http",
  "config": {
    "url": "{{ERP_BASE_URL}}/api/products/batch",
    "method": "POST",
    "batchSize": 100,
    "timeoutMs": 60000,
    "retryOn": ["timeout", "5xx"],
    "maxRetries": 3,
    "retryStrategy": "exponential",
    "retryDelayMs": 1000
  }
}
\`\`\`

Aplique essa configuração no builder do workflow e execute um teste manual para validar.`,
          timestamp: minsAgo(42),
        },
      ],
      createdAt: minsAgo(45),
      updatedAt: minsAgo(42),
    };

    const conv2: CopilotConversation = {
      id: conv2Id,
      title: 'Customer Entity Mapping Generation',
      context: { connectorId: 'conn-erp-prod' },
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          content: 'Generate entity mapping for ERP customers to Atlas Customer entities',
          timestamp: minsAgo(120),
        },
        {
          id: randomUUID(),
          role: 'assistant',
          content: `Here's the entity mapping for **ERP.Cliente → Atlas.Customer**:

\`\`\`json
{
  "entityMapping": {
    "source": "ERP.Cliente",
    "target": "Atlas.Customer",
    "fields": [
      { "source": "CodCliente",  "target": "externalId", "type": "string",   "required": true },
      { "source": "NomeCliente", "target": "name",       "type": "string",   "required": true },
      { "source": "CpfCnpj",    "target": "taxId",      "type": "string",   "transform": "formatBrazilianTaxId" },
      { "source": "Email",       "target": "email",      "type": "string",   "validate": "email" },
      { "source": "Telefone",    "target": "phone",      "type": "string",   "transform": "formatBrazilianPhone" },
      { "source": "DtCadastro",  "target": "createdAt",  "type": "datetime", "transform": "parseISODate" },
      { "source": "Ativo",       "target": "active",     "type": "boolean",  "transform": "booleanFromYN" }
    ],
    "validations": [
      { "field": "taxId",  "rule": "CPF_CNPJ_VALID" },
      { "field": "email",  "rule": "EMAIL_FORMAT" },
      { "field": "phone",  "rule": "BR_PHONE_FORMAT" }
    ]
  }
}
\`\`\`

The mapping includes Brazilian-specific transforms for CPF/CNPJ and phone formatting.`,
          timestamp: minsAgo(119),
        },
      ],
      createdAt: minsAgo(120),
      updatedAt: minsAgo(119),
    };

    this.conversations.push(conv1, conv2);

    const seedLogs: Array<[CopilotAction, string, string, number]> = [
      [
        'chat',
        'Por que o sync de produtos ERP falhou às 14:32?',
        'Com base nos logs, o sync falhou por connection timeout no nó HTTP...',
        5,
      ],
      [
        'diagnose',
        'Quais agentes estão sem heartbeat?',
        'Encontrei 2 agentes sem heartbeat nos últimos 5 minutos: edge-01, edge-03',
        15,
      ],
      [
        'generate',
        'Generate customer entity mapping',
        'Generated mapping: ERP.Cliente → Atlas.Customer with 7 fields and 3 validations',
        22,
      ],
      [
        'chat',
        'How do I configure retry for HTTP nodes?',
        'To configure retry, set retryOn and maxRetries in the node config...',
        38,
      ],
      [
        'explain',
        'Explain the product sync workflow',
        'This workflow triggers on webhook, validates schema, transforms ERP data to Atlas format...',
        55,
      ],
      [
        'search',
        'connectors with errors in the last hour',
        'Found 3 connectors with errors: conn-erp-prod (timeout), conn-bling (auth), conn-tiny (rate limit)',
        67,
      ],
      [
        'generate',
        'SQL to list products updated today',
        'SELECT p.id, p.name, p.updated_at FROM products p WHERE p.updated_at >= CURDATE()...',
        89,
      ],
      [
        'diagnose',
        'Are there active SLA breaches?',
        'Found 1 active SLA breach: ERP Product Sync exceeded 30s (configured SLA: 10s max)',
        102,
      ],
      [
        'chat',
        'What is the current system health?',
        'System health is DEGRADED: 2 open incidents, 5 active alerts, 1 SLA breach today...',
        135,
      ],
      [
        'search',
        'pipelines processing orders',
        'Found 2 pipelines: Order Sync (active, last run 2m ago), Order Fulfillment (paused)',
        178,
      ],
    ];

    seedLogs.forEach(([action, prompt, responsePreview, minutesAgo]) => {
      this.auditLogs.push({
        id: randomUUID(),
        timestamp: minsAgo(minutesAgo),
        action,
        conversationId: minutesAgo <= 22 ? conv1Id : conv2Id,
        prompt,
        responsePreview: responsePreview.substring(0, 120),
        context: {},
        modelUsed: 'demo',
        durationMs: Math.floor(Math.random() * 2000 + 400),
      });
    });
  }
}

export const copilotStore = new CopilotStore();
