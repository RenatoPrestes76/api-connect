import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';
import type { CopilotContext, CopilotMessage } from '../../../modules/ai-copilot/copilot-store.js';

// ─── Claude client (null when no API key) ─────────────────────────────────────

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const COPILOT_SYSTEM = `You are Atlas Copilot, an AI assistant embedded in the Atlas Connect enterprise integration platform.

Atlas Connect is an iPaaS (Integration Platform as a Service) for Brazilian enterprise integrations.

Platform:
- Workflow orchestration (visual pipeline builder)
- ERP connectors (Seltriva, Bling, Tiny, Totvs, SAP, etc.)
- Real-time observability: metrics, alerts, incidents, SLA monitoring, audit trail
- Discovery AI: schema inference and semantic entity mapping
- Agent-based edge integration for on-premises ERPs

Workflow node types: trigger, transform, validate, http, condition, delay, retry, notification, log, dlq

Your role:
1. Diagnose integration failures and suggest step-by-step fixes
2. Generate entity mappings, field transforms, and validation rules
3. Write SQL queries scoped to the tenant's data
4. Generate workflow pipelines from natural language descriptions
5. Explain existing mappings and pipelines in plain language
6. Answer questions about platform status, agents, connectors, and metrics

Always respond in the same language as the user's message (Portuguese or English).
When generating configurations or code, use JSON/TypeScript format with clear field names.
Be concise and actionable — administrators need fast answers during incidents.`;

// ─── Demo responses (used when ANTHROPIC_API_KEY is absent) ──────────────────

function demoResponse(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('falhou') || m.includes('fail') || m.includes('erro') || m.includes('error')) {
    return `Com base nos logs de execução, identifico as causas mais comuns de falha:

**Causas prováveis:**
1. **Connection timeout** — Endpoint ERP sobrecarregado
2. **Token expirado** — Credenciais do connector desatualizadas
3. **Schema inválido** — ERP retornou estrutura inesperada

**Próximos passos:**
1. Verifique os logs do workflow no painel de Execuções
2. Confirme que as credenciais do connector estão válidas
3. Teste o endpoint ERP diretamente

Quer que eu diagnostique um workflow específico?`;
  }

  if (
    m.includes('heartbeat') ||
    m.includes('offline') ||
    m.includes('agente') ||
    m.includes('agent')
  ) {
    return `Verificando status dos agentes...

**Agentes com heartbeat atrasado:**
- \`agent-edge-01\` — Último heartbeat há 8 min (AVISO)
- \`agent-edge-03\` — Último heartbeat há 12 min (OFFLINE)

**Ações recomendadas:**
1. Reiniciar agent-edge-01: \`atlas agent restart edge-01\`
2. Verificar conectividade de agent-edge-03
3. Checar firewall entre o host do agente e o Atlas Hub`;
  }

  if (m.includes('sql') || m.includes('query') || m.includes('consulta')) {
    return `Aqui está uma query SQL de exemplo:

\`\`\`sql
-- Produtos atualizados nas últimas 24 horas
SELECT
  p.id,
  p.external_id,
  p.name,
  p.updated_at,
  c.name AS connector
FROM products p
JOIN connectors c ON c.id = p.connector_id
WHERE p.tenant_id = :tenantId
  AND p.updated_at >= NOW() - INTERVAL 1 DAY
ORDER BY p.updated_at DESC
LIMIT 100;
\`\`\`

Ajuste o filtro \`:tenantId\` com o ID do seu tenant.`;
  }

  if (m.includes('mapping') || m.includes('mapeamento') || m.includes('entidade')) {
    return `Aqui está um exemplo de mapeamento de entidades:

\`\`\`json
{
  "entityMapping": {
    "source": "ERP.Produto",
    "target": "Atlas.Product",
    "fields": [
      { "source": "CodProduto", "target": "externalId", "type": "string",  "required": true },
      { "source": "DescProduto","target": "name",       "type": "string",  "required": true },
      { "source": "PrecoVenda", "target": "price",      "type": "decimal", "transform": "parseCurrency" },
      { "source": "Estoque",    "target": "stock",      "type": "integer"  },
      { "source": "Ativo",      "target": "active",     "type": "boolean", "transform": "booleanFromYN" }
    ]
  }
}
\`\`\``;
  }

  if (m.includes('workflow') || m.includes('fluxo') || m.includes('pipeline')) {
    return `Para criar um workflow de sincronização, use a seguinte estrutura:

\`\`\`json
{
  "name": "ERP → Atlas Sync",
  "triggerType": "WEBHOOK",
  "graph": {
    "nodes": [
      { "id": "n1", "type": "trigger",  "label": "Webhook Trigger" },
      { "id": "n2", "type": "validate", "label": "Schema Validation" },
      { "id": "n3", "type": "transform","label": "ERP → Atlas Mapping" },
      { "id": "n4", "type": "http",     "label": "POST to Atlas API" },
      { "id": "n5", "type": "notification","label": "Slack Summary" }
    ],
    "edges": [
      { "source": "n1", "target": "n2" },
      { "source": "n2", "target": "n3" },
      { "source": "n3", "target": "n4" },
      { "source": "n4", "target": "n5" }
    ]
  }
}
\`\`\`

Posso gerar a configuração completa com retry e DLQ. Qual é o cenário específico?`;
  }

  if (m.includes('sla') || m.includes('breach') || m.includes('violação')) {
    return `Verificando SLA breaches ativos...

**Status atual:**
- ERP Product Sync: **BREACH** — 35s (SLA: 10s máx) 🔴
- Customer Sync: OK — 4.2s (SLA: 30s máx) ✅
- Inventory Sync: WARN — 8.8s (SLA: 10s máx) 🟡

**Ação recomendada para ERP Product Sync:**
1. Verificar carga no servidor ERP
2. Reduzir tamanho do lote de 500 para 100 registros
3. Ativar cache local para reduzir latência`;
  }

  if (m.includes('health') || m.includes('saúde') || m.includes('status')) {
    return `**Status do sistema Atlas Connect:**

| Componente         | Status     | Detalhes              |
|-------------------|------------|-----------------------|
| API Gateway        | ✅ OK      | 99.9% disponibilidade |
| Orchestrator       | ✅ OK      | 12 workflows ativos   |
| Observatory        | ✅ OK      | 288 métricas coletadas|
| Agentes Edge       | ⚠️ AVISO   | 2/8 agentes offline   |
| Connectors ERP     | ⚠️ AVISO   | 1/4 com latência alta |
| Fila de Jobs       | ✅ OK      | 3 jobs pendentes      |

**Incidentes abertos:** 2 (1 crítico, 1 warning)
**Alertas ativos:** 5`;
  }

  return `Entendido. Posso ajudar com:

- **Diagnóstico** de falhas em workflows e connectors
- **Geração** de mappings de entidades, SQL e pipelines
- **Explicação** de workflows e configurações existentes
- **Busca semântica** em logs, pipelines e schemas
- **Status** do sistema, agentes e SLAs

Qual é a sua necessidade específica?`;
}

// ─── Chat endpoint ────────────────────────────────────────────────────────────

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: CopilotContext;
}

export async function chat(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { message, conversationId, context } = ctx.body as ChatRequest;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'message is required' }));
    return;
  }

  const t0 = Date.now();
  const conv = copilotStore.getOrCreate(conversationId, context ?? {});

  const userMsg: CopilotMessage = {
    id: randomUUID(),
    role: 'user',
    content: message.trim(),
    timestamp: new Date().toISOString(),
  };
  conv.messages.push(userMsg);

  // Derive conversation title from first user message
  if (conv.messages.filter((m) => m.role === 'user').length === 1) {
    copilotStore.updateTitle(
      conv.id,
      message.trim().slice(0, 60) + (message.length > 60 ? '…' : '')
    );
  }

  let content: string;
  let modelUsed = 'demo';

  if (anthropic) {
    // Build history for Claude (exclude last user message — already added)
    const history = conv.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    history.push({ role: 'user', content: message.trim() });

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        system: COPILOT_SYSTEM,
        messages: history,
      });
      const final = await stream.finalMessage();
      content = final.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      modelUsed = 'claude-opus-4-8';
    } catch (err) {
      const errMsg = err instanceof Anthropic.APIError ? err.message : 'AI service error';
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errMsg }));
      return;
    }
  } else {
    content = demoResponse(message);
  }

  const assistantMsg: CopilotMessage = {
    id: randomUUID(),
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
  conv.messages.push(assistantMsg);
  conv.updatedAt = new Date().toISOString();

  copilotStore.addAuditLog({
    action: 'chat',
    conversationId: conv.id,
    prompt: message.trim().slice(0, 200),
    responsePreview: content.slice(0, 120),
    context: context ?? {},
    modelUsed,
    durationMs: Date.now() - t0,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      conversationId: conv.id,
      messageId: assistantMsg.id,
      content,
      model: modelUsed,
    })
  );
}

// ─── Conversation history endpoints ──────────────────────────────────────────

export async function listConversations(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const items = [...copilotStore.conversations]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map(({ id, title, context, createdAt, updatedAt, messages }) => ({
      id,
      title,
      context,
      createdAt,
      updatedAt,
      messageCount: messages.length,
      lastMessage: messages.at(-1)?.content.slice(0, 80),
    }));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total: items.length }));
}

export async function getConversation(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const conv = copilotStore.get(ctx.params?.id ?? '');
  if (!conv) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Conversation not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(conv));
}

export async function deleteConversation(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const deleted = copilotStore.delete(ctx.params?.id ?? '');
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Conversation not found' }));
    return;
  }
  res.writeHead(204);
  res.end();
}
