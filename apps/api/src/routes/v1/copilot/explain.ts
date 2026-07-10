import Anthropic from '@anthropic-ai/sdk';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type ExplainType = 'mapping' | 'pipeline' | 'workflow' | 'query';

interface ExplainRequest {
  type: ExplainType;
  id?: string;
  content?: Record<string, unknown>;
  description?: string;
}

interface ExplainResult {
  summary: string;
  explanation: string;
  components?: Array<{ name: string; description: string; type?: string }>;
  warnings?: string[];
}

function demoExplain(type: ExplainType, content?: Record<string, unknown>): ExplainResult {
  if (type === 'mapping') {
    return {
      summary: 'Entity mapping that transforms ERP entities to Atlas format',
      explanation: `Este mapeamento de entidades converte registros do formato ERP proprietário para o schema padronizado do Atlas Connect.

**Campos mapeados:**
- \`CodProduto\` → \`externalId\`: Identificador único no sistema de origem
- \`DescProduto\` → \`name\`: Nome/descrição do produto
- \`PrecoVenda\` → \`price\`: Preço formatado como decimal (centavos divididos por 100)
- \`Ativo\` → \`active\`: Converte 'S'/'N' para boolean true/false

**Transforms aplicados:**
- \`parseCurrency\`: Converte de formato BR (1.234,56) para float (1234.56)
- \`booleanFromYN\`: Converte flags S/N usadas pelo ERP para boolean

**Validações:**
- \`externalId\` é obrigatório — sem ele o registro não pode ser rastreado
- \`price\` deve ser >= 0 — evita inserção de preços negativos`,
      components: [
        {
          name: 'Field Mapping',
          description: 'Maps source ERP fields to Atlas target schema',
          type: 'mapping',
        },
        {
          name: 'Transform Rules',
          description: 'Data transformation functions (currency, boolean, date)',
          type: 'transform',
        },
        {
          name: 'Validation Rules',
          description: 'Constraints applied before writing to Atlas',
          type: 'validation',
        },
      ],
    };
  }

  if (type === 'workflow' || type === 'pipeline') {
    return {
      summary: 'ERP synchronization workflow with validation, transform, and retry',
      explanation: `Este workflow sincroniza dados do ERP para o Atlas Connect em 5 etapas:

**1. Trigger (Webhook)**
Ativado quando o ERP envia uma notificação via webhook POST. O payload contém os dados da entidade criada ou atualizada.

**2. Validate (Schema Validation)**
Valida o payload contra o schema esperado. Campos obrigatórios são verificados; tipos são coercidos quando possível.

**3. Transform (ERP → Atlas Mapping)**
Aplica o mapeamento de campos para converter do formato ERP para o schema Atlas. Transforms de moeda e data são executados aqui.

**4. HTTP (POST to Atlas API)**
Envia os dados transformados para a API do Atlas. Configurado com:
- Timeout: 30s
- Retry: 3 tentativas com backoff exponencial (1s, 2s, 4s)
- Retry em: timeout, 5xx errors

**5. Notification (Slack Summary)**
Envia resumo do resultado para o canal #integrations no Slack.

**Tratamento de erros:** Falhas após todas as retentativas são enviadas para a DLQ para análise manual.`,
      components: [
        {
          name: 'Webhook Trigger',
          description: 'Entry point — fires on ERP push event',
          type: 'trigger',
        },
        {
          name: 'Schema Validator',
          description: 'Ensures payload matches expected contract',
          type: 'validate',
        },
        {
          name: 'ERP Transform',
          description: 'Maps ERP schema fields to Atlas format',
          type: 'transform',
        },
        {
          name: 'API Call',
          description: 'Sends data to Atlas with retry and timeout',
          type: 'http',
        },
        {
          name: 'Slack Alert',
          description: 'Notifies team on success or failure',
          type: 'notification',
        },
      ],
      warnings: content
        ? []
        : ['No content provided — explanation is based on a typical ERP sync workflow pattern.'],
    };
  }

  return {
    summary: `${type} explanation`,
    explanation: `This ${type} configuration defines integration logic for the Atlas Connect platform. Provide the actual content or ID for a more specific explanation.`,
    components: [],
  };
}

export async function explain(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { type, id, content, description } = ctx.body as ExplainRequest;

  if (!type || !['mapping', 'pipeline', 'workflow', 'query'].includes(type)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'type must be one of: mapping, pipeline, workflow, query' }));
    return;
  }

  const t0 = Date.now();
  let result: ExplainResult;
  let modelUsed = 'demo';

  const contentStr = content ? JSON.stringify(content, null, 2) : (description ?? `a ${type}`);

  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: `You are an expert in the Atlas Connect integration platform. Explain the provided ${type} configuration clearly for platform administrators. Respond with JSON matching: { "summary": "one sentence", "explanation": "detailed markdown explanation", "components": [{"name":"...","description":"...","type":"..."}], "warnings": ["optional warnings"] }`,
        messages: [
          {
            role: 'user',
            content: `Explain this ${type}${id ? ` (id: ${id})` : ''}:\n${contentStr}`,
          },
        ],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      result = jsonMatch ? (JSON.parse(jsonMatch[0]) as ExplainResult) : demoExplain(type, content);
      modelUsed = 'claude-opus-4-8';
    } catch {
      result = demoExplain(type, content);
    }
  } else {
    result = demoExplain(type, content);
  }

  copilotStore.addAuditLog({
    action: 'explain',
    prompt: `[${type}${id ? `:${id}` : ''}] explain`,
    responsePreview: result.summary.slice(0, 120),
    context: {},
    modelUsed,
    durationMs: Date.now() - t0,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...result, model: modelUsed }));
}
