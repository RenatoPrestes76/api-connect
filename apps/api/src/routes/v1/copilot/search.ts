import Anthropic from '@anthropic-ai/sdk';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type EntityType = 'apis' | 'connectors' | 'logs' | 'pipelines' | 'schemas' | 'workflows' | 'agents';

interface SearchRequest {
  query: string;
  entities?: EntityType[];
  limit?: number;
}

interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  description: string;
  relevance: number;
  metadata?: Record<string, unknown>;
  lastUpdated?: string;
}

// Seeded platform entities for demo semantic search
const PLATFORM_ENTITIES: Array<Omit<SearchResult, 'relevance'>> = [
  {
    id: 'conn-erp-prod',
    type: 'connectors',
    title: 'ERP Connector (Production)',
    description:
      'Seltriva ERP connector for production environment. Handles products, customers, orders.',
    metadata: { status: 'DEGRADED', env: 'production' },
    lastUpdated: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'conn-bling',
    type: 'connectors',
    title: 'Bling Connector',
    description: 'Bling e-commerce connector for order management and inventory.',
    metadata: { status: 'HEALTHY' },
    lastUpdated: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: 'conn-tiny',
    type: 'connectors',
    title: 'Tiny ERP Connector',
    description: 'Tiny ERP integration for small-to-medium business e-commerce.',
    metadata: { status: 'ERROR', lastError: 'auth_expired' },
    lastUpdated: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 'wf-erp-product',
    type: 'workflows',
    title: 'ERP Product Sync',
    description:
      'Webhook-triggered workflow: syncs products from ERP to Atlas with transform and retry.',
    metadata: { active: true, executions: 142 },
    lastUpdated: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    id: 'wf-order-fulfill',
    type: 'workflows',
    title: 'Order Fulfillment Pipeline',
    description:
      'Processes new orders from e-commerce: validates, transforms, posts to ERP, notifies team.',
    metadata: { active: true, executions: 87 },
    lastUpdated: new Date(Date.now() - 25 * 60_000).toISOString(),
  },
  {
    id: 'wf-inv-sync',
    type: 'workflows',
    title: 'Inventory Sync',
    description: 'Hourly CRON sync of inventory levels from all ERPs to Atlas master catalog.',
    metadata: { active: false, executions: 56 },
    lastUpdated: new Date(Date.now() - 60 * 60_000).toISOString(),
  },
  {
    id: 'schema-produto',
    type: 'schemas',
    title: 'ERP.Produto Schema',
    description:
      'Schema do produto no ERP: CodProduto, DescProduto, PrecoVenda, Estoque, Ativo, DtCriacao.',
    metadata: { fields: 12, version: '3.2' },
    lastUpdated: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: 'schema-cliente',
    type: 'schemas',
    title: 'ERP.Cliente Schema',
    description: 'Schema do cliente: CodCliente, NomeCliente, CpfCnpj, Email, Telefone, Endereco.',
    metadata: { fields: 18, version: '2.1' },
    lastUpdated: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: 'schema-pedido',
    type: 'schemas',
    title: 'ERP.Pedido Schema',
    description: 'Schema do pedido: CodPedido, CodCliente, Itens[], ValorTotal, Status, DtEmissao.',
    metadata: { fields: 9, version: '1.8' },
    lastUpdated: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 'api-products',
    type: 'apis',
    title: 'Atlas Products API',
    description: 'REST API /api/v1/products — CRUD operations on the Atlas product catalog.',
    metadata: { methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    lastUpdated: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 'api-customers',
    type: 'apis',
    title: 'Atlas Customers API',
    description: 'REST API /api/v1/customers — customer management with CPF/CNPJ validation.',
    metadata: { methods: ['GET', 'POST', 'PUT'] },
    lastUpdated: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 'agent-edge-01',
    type: 'agents',
    title: 'Edge Agent 01 (SP)',
    description:
      'Edge agent running in São Paulo datacenter. Handles ERP connector and local file sync.',
    metadata: { status: 'ONLINE', version: '2.4.1' },
    lastUpdated: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: 'agent-edge-02',
    type: 'agents',
    title: 'Edge Agent 02 (RJ)',
    description: 'Edge agent running in Rio de Janeiro office. Handles Bling and Tiny connectors.',
    metadata: { status: 'ONLINE', version: '2.4.1' },
    lastUpdated: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
  {
    id: 'agent-edge-03',
    type: 'agents',
    title: 'Edge Agent 03 (MG)',
    description: 'Edge agent in Minas Gerais. Currently offline — no heartbeat in 12 minutes.',
    metadata: { status: 'OFFLINE', lastSeen: '12min ago' },
    lastUpdated: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: 'log-sync-err-001',
    type: 'logs',
    title: 'ERP Sync Timeout Error',
    description: 'Connection timeout on wf-erp-product-sync step http-batch. Retry 3/3 failed.',
    metadata: { level: 'ERROR', workflow: 'wf-erp-product' },
    lastUpdated: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'log-auth-err-002',
    type: 'logs',
    title: 'Bling Auth Token Expired',
    description: 'Authentication error on Bling connector. Token expired at 14:02. Needs refresh.',
    metadata: { level: 'ERROR', connector: 'conn-bling' },
    lastUpdated: new Date(Date.now() - 35 * 60_000).toISOString(),
  },
];

function semanticScore(query: string, entity: Omit<SearchResult, 'relevance'>): number {
  const q = query.toLowerCase();
  const text = [entity.title, entity.description, entity.id, entity.type].join(' ').toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const matches = words.filter((w) => text.includes(w)).length;
  return words.length > 0 ? matches / words.length : 0;
}

function demoSearch(query: string, entities?: EntityType[], limit = 10): SearchResult[] {
  let pool = PLATFORM_ENTITIES;
  if (entities && entities.length > 0) {
    pool = pool.filter((e) => entities.includes(e.type));
  }
  return pool
    .map((e) => ({ ...e, relevance: Math.min(1, semanticScore(query, e) + Math.random() * 0.2) }))
    .filter((e) => e.relevance > 0.05)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

export async function search(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { query, entities, limit = 10 } = ctx.body as SearchRequest;

  if (!query || typeof query !== 'string' || !query.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'query is required' }));
    return;
  }

  const t0 = Date.now();
  let results: SearchResult[];
  let modelUsed = 'demo';

  if (anthropic) {
    // With a real deployment, we'd use embeddings + vector store.
    // For now, use the demo search as a baseline and ask Claude to rank/explain.
    const candidates = demoSearch(query, entities, 20);
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        system:
          'You are a semantic search engine for the Atlas Connect platform. Re-rank the provided search candidates by relevance to the query. Return JSON: { "rankedIds": ["id1", "id2", ...] } with the IDs ordered by relevance (most relevant first). Include only IDs that are genuinely relevant.',
        messages: [
          {
            role: 'user',
            content: `Query: "${query}"\n\nCandidates:\n${JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, description: c.description })))}`,
          },
        ],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { rankedIds?: string[] }) : null;
      if (parsed?.rankedIds && Array.isArray(parsed.rankedIds)) {
        const ranked = parsed.rankedIds
          .map((id, i) => candidates.find((c) => c.id === id))
          .filter((c): c is SearchResult => Boolean(c))
          .map((c, i) => ({ ...c, relevance: 1 - i * 0.05 }))
          .slice(0, limit);
        results = ranked.length > 0 ? ranked : candidates.slice(0, limit);
        modelUsed = 'claude-opus-4-8';
      } else {
        results = candidates.slice(0, limit);
      }
    } catch {
      results = candidates.slice(0, limit);
    }
  } else {
    results = demoSearch(query, entities, limit);
  }

  copilotStore.addAuditLog({
    action: 'search',
    prompt: query.trim().slice(0, 200),
    responsePreview: `Found ${results.length} results`,
    context: {},
    modelUsed,
    durationMs: Date.now() - t0,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ query, results, total: results.length, model: modelUsed }));
}
