import Anthropic from '@anthropic-ai/sdk';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type GenerateType = 'mapping' | 'sql' | 'flow';

interface GenerateRequest {
  type: GenerateType;
  description: string;
  context?: {
    sourceSchema?: Record<string, unknown>;
    targetSchema?: Record<string, unknown>;
    tenantId?: string;
    existingFields?: string[];
  };
}

interface GenerateResult {
  type: GenerateType;
  title: string;
  description: string;
  result: Record<string, unknown> | string;
  code?: string;
  language?: string;
}

function demoGenerate(type: GenerateType, description: string): GenerateResult {
  if (type === 'mapping') {
    return {
      type,
      title: 'Entity Mapping',
      description: `Generated mapping based on: "${description}"`,
      result: {
        entityMapping: {
          source: 'ERP.Entidade',
          target: 'Atlas.Entity',
          fields: [
            { source: 'CodEntidade', target: 'externalId', type: 'string', required: true },
            { source: 'NomeEntidade', target: 'name', type: 'string', required: true },
            { source: 'Ativo', target: 'active', type: 'boolean', transform: 'booleanFromYN' },
            {
              source: 'DtCriacao',
              target: 'createdAt',
              type: 'datetime',
              transform: 'parseISODate',
            },
          ],
          validations: [
            { field: 'externalId', rule: 'REQUIRED' },
            { field: 'name', rule: 'MIN_LENGTH:2' },
          ],
          transformRules: [
            { name: 'booleanFromYN', expression: "value === 'S' ? true : false" },
            { name: 'parseISODate', expression: 'new Date(value).toISOString()' },
          ],
        },
      },
      code: JSON.stringify(
        { entityMapping: { source: 'ERP.Entidade', target: 'Atlas.Entity' } },
        null,
        2
      ),
      language: 'json',
    };
  }

  if (type === 'sql') {
    const table = description.toLowerCase().includes('product')
      ? 'products'
      : description.toLowerCase().includes('customer') ||
          description.toLowerCase().includes('cliente')
        ? 'customers'
        : description.toLowerCase().includes('order') ||
            description.toLowerCase().includes('pedido')
          ? 'orders'
          : 'entities';

    return {
      type,
      title: `SQL Query — ${table}`,
      description: `Generated SQL based on: "${description}"`,
      result: { table, filters: ['tenant_id', 'updated_at'], orderBy: 'updated_at DESC' },
      code: `-- ${description}
SELECT
  e.id,
  e.external_id,
  e.name,
  e.status,
  e.updated_at,
  c.name AS connector_name
FROM ${table} e
JOIN connectors c ON c.id = e.connector_id
WHERE e.tenant_id = :tenantId
  AND e.updated_at >= NOW() - INTERVAL 1 DAY
  AND e.status != 'deleted'
ORDER BY e.updated_at DESC
LIMIT :limit OFFSET :offset;`,
      language: 'sql',
    };
  }

  // flow
  return {
    type,
    title: 'Workflow Pipeline',
    description: `Generated pipeline based on: "${description}"`,
    result: {
      name: description.slice(0, 50),
      triggerType: 'WEBHOOK',
      graph: {
        nodes: [
          {
            id: 'n1',
            type: 'trigger',
            label: 'Webhook Trigger',
            config: { event: 'entity.created' },
          },
          { id: 'n2', type: 'validate', label: 'Schema Validation', config: { strict: true } },
          {
            id: 'n3',
            type: 'transform',
            label: 'ERP → Atlas Mapping',
            config: { mapping: 'auto' },
          },
          {
            id: 'n4',
            type: 'http',
            label: 'POST to Atlas API',
            config: { method: 'POST', retryOn: ['timeout', '5xx'], maxRetries: 3 },
          },
          {
            id: 'n5',
            type: 'condition',
            label: 'Check Response',
            config: { expression: 'statusCode === 200' },
          },
          {
            id: 'n6',
            type: 'notification',
            label: 'Slack Success',
            config: { channel: '#integrations' },
          },
          { id: 'n7', type: 'dlq', label: 'Dead Letter Queue', config: { retentionDays: 7 } },
        ],
        edges: [
          { source: 'n1', target: 'n2' },
          { source: 'n2', target: 'n3' },
          { source: 'n3', target: 'n4' },
          { source: 'n4', target: 'n5' },
          { source: 'n5', target: 'n6', label: 'true' },
          { source: 'n5', target: 'n7', label: 'false' },
        ],
      },
    },
    code: JSON.stringify({ name: description.slice(0, 50), triggerType: 'WEBHOOK' }, null, 2),
    language: 'json',
  };
}

export async function generate(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { type, description, context } = ctx.body as GenerateRequest;

  if (!type || !['mapping', 'sql', 'flow'].includes(type)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'type must be one of: mapping, sql, flow' }));
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'description is required' }));
    return;
  }

  const t0 = Date.now();
  let result: GenerateResult;
  let modelUsed = 'demo';

  if (anthropic) {
    const systemMap: Record<GenerateType, string> = {
      mapping:
        'Generate an entity mapping configuration in JSON format for the Atlas Connect platform. Return only valid JSON with entityMapping, fields, validations, and transformRules.',
      sql: 'Generate a SQL query for the Atlas Connect platform. Return JSON with: { "title": "...", "code": "SQL code here", "language": "sql", "description": "..." }. The SQL must be safe, use parameterized :variables, and filter by tenant_id.',
      flow: 'Generate a workflow pipeline configuration in JSON for the Atlas Connect platform. Return JSON with name, triggerType, and graph (nodes array + edges array). Node types: trigger, transform, validate, http, condition, delay, retry, notification, log, dlq.',
    };
    const contextStr = context ? JSON.stringify(context) : 'none';
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 8192,
        thinking: { type: 'adaptive' },
        system: systemMap[type],
        messages: [
          { role: 'user', content: `Generate ${type}: ${description}\nContext: ${contextStr}` },
        ],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : null;
      result = {
        type,
        title: (parsed?.['title'] as string | undefined) ?? `Generated ${type}`,
        description: (parsed?.['description'] as string | undefined) ?? description,
        result: parsed ?? {},
        code: (parsed?.['code'] as string | undefined) ?? text,
        language: type === 'sql' ? 'sql' : 'json',
      };
      modelUsed = 'claude-opus-4-8';
    } catch {
      result = demoGenerate(type, description);
    }
  } else {
    result = demoGenerate(type, description);
  }

  copilotStore.addAuditLog({
    action: 'generate',
    prompt: `[${type}] ${description.trim().slice(0, 200)}`,
    responsePreview: result.title,
    context: {},
    modelUsed,
    durationMs: Date.now() - t0,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...result, model: modelUsed }));
}
