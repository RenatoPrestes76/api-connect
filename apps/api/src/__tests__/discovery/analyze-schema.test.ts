import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSchema } from '@seltriva/database-sdk';
import { PrometheusStore }           from '../../services/prometheus-store.js';
import { createAnalyzeSchemaHandler } from '../../routes/v1/discovery/analyze-schema.js';
import { createEntitiesHandler }     from '../../routes/v1/discovery/entities.js';
import { createSuggestionsHandler }  from '../../routes/v1/discovery/suggestions.js';
import { createGraphHandler }        from '../../routes/v1/discovery/graph.js';

// ─── Minimal ERP schema (subset of Sprint 27 SIGMA schema) ───────────────────

const ERP_SCHEMA: DatabaseSchema = {
  name: 'erp_seltriva',
  tables: [
    {
      name: 'produtos',
      columns: [
        { name: 'id',           type: 'serial',  nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'codigo',       type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: true  },
        { name: 'descricao',    type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'preco_venda',  type: 'numeric', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'cod_grupo',    type: 'varchar', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'ativo',        type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'dt_alteracao', type: 'timestamp', nullable: true, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey: { columns: ['id'] }, foreignKeys: [], indexes: [],
    },
    {
      name: 'clientes',
      columns: [
        { name: 'id',             type: 'serial',  nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'razao_social',   type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'cnpj_cpf',      type: 'varchar', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'limite_credito', type: 'numeric', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'ativo',          type: 'boolean', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey: { columns: ['id'] }, foreignKeys: [], indexes: [],
    },
    {
      name: 'estoque',
      columns: [
        { name: 'id',             type: 'serial',  nullable: false, isPrimaryKey: true,  isForeignKey: false, isUnique: true  },
        { name: 'cod_produto',    type: 'integer', nullable: false, isPrimaryKey: false, isForeignKey: true,  isUnique: false },
        { name: 'cod_deposito',   type: 'varchar', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'qtd_atual',      type: 'numeric', nullable: false, isPrimaryKey: false, isForeignKey: false, isUnique: false },
        { name: 'qtd_reservada',  type: 'numeric', nullable: true,  isPrimaryKey: false, isForeignKey: false, isUnique: false },
      ],
      primaryKey: { columns: ['id'] },
      foreignKeys: [{ column: 'cod_produto', referencedTable: 'produtos', referencedColumn: 'id' }],
      indexes: [],
    },
  ],
  relations:    [],
  discoveredAt: new Date(),
};

// ─── Mock RouteContext / ServerResponse helpers ───────────────────────────────

function makeCtx(query: Record<string, string> = {}, body: unknown = undefined) {
  return {
    params:    {},
    query:     new URLSearchParams(query),
    body,
    rawUrl:    '/api/v1/discovery/analyze-schema',
    pathname:  '/api/v1/discovery/analyze-schema',
    method:    'POST',
    headers:   {},
    requestId: 'test-req-id',
  };
}

function makeRes() {
  let capturedStatus = 200;
  let capturedBody   = '';
  return {
    headersSent: false,
    writeHead: (_status: number) => { capturedStatus = _status; },
    end: (body: string) => { capturedBody = body; },
    get status() { return capturedStatus; },
    get json()   { return JSON.parse(capturedBody); },
  } as unknown as ReturnType<typeof import('node:http').createServer> & {
    status: number; json: unknown;
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /discovery/analyze-schema', () => {
  let store: PrometheusStore;

  beforeEach(() => { store = new PrometheusStore(); });

  it('returns 400 when body is missing', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, undefined), res as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when schema.tables is not an array', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: { name: 'x', tables: 'bad' } }), res as never);
    expect(res.status).toBe(400);
  });

  it('returns 200 with analysisId for a valid schema', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    expect(res.status).toBe(200);
    const body = res.json as Record<string, unknown>;
    expect(typeof body['analysisId']).toBe('string');
    expect(body['database']).toBe('erp_seltriva');
  });

  it('stores the result so subsequent GETs work', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const { analysisId } = res.json as { analysisId: string };
    expect(store.get(analysisId)).toBeDefined();
  });

  it('returns summary with tablesFound = 3', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const body = res.json as { summary: { tablesFound: number } };
    expect(body.summary.tablesFound).toBe(3);
  });

  it('returns entities array sorted by confidence descending', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const { entities } = res.json as { entities: Array<{ confidence: number }> };
    expect(entities.length).toBeGreaterThan(0);
    for (let i = 1; i < entities.length; i++) {
      expect(entities[i - 1]!.confidence).toBeGreaterThanOrEqual(entities[i]!.confidence);
    }
  });

  it('classifies produtos table as PRODUCT entity', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const { entities } = res.json as { entities: Array<{ entity: string; table: string }> };
    const prod = entities.find((e) => e.table.endsWith('.produtos'));
    expect(prod?.entity).toBe('PRODUCT');
  });

  it('classifies clientes table as CUSTOMER entity', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const { entities } = res.json as { entities: Array<{ entity: string; table: string }> };
    const cust = entities.find((e) => e.table.endsWith('.clientes'));
    expect(cust?.entity).toBe('CUSTOMER');
  });

  it('classifies estoque table as INVENTORY entity', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    const { entities } = res.json as { entities: Array<{ entity: string; table: string }> };
    const inv = entities.find((e) => e.table.endsWith('.estoque'));
    expect(inv?.entity).toBe('INVENTORY');
  });

  it('honours source metadata in the response', async () => {
    const handler = createAnalyzeSchemaHandler(store);
    const res     = makeRes();
    await handler(makeCtx({}, {
      schema: ERP_SCHEMA,
      source: { host: 'erp.local', port: 5435, database: 'erp_custom' },
    }), res as never);
    const body = res.json as { database: string; host: string; port: number };
    expect(body.database).toBe('erp_custom');
    expect(body.host).toBe('erp.local');
    expect(body.port).toBe(5435);
  });
});

describe('GET /discovery/entities', () => {
  let store: PrometheusStore;
  let analysisId: string;

  beforeEach(async () => {
    store = new PrometheusStore();
    const handler = createAnalyzeSchemaHandler(store);
    const res = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    ({ analysisId } = res.json as { analysisId: string });
  });

  it('returns 400 without analysisId', async () => {
    const handler = createEntitiesHandler(store);
    const res = makeRes();
    await handler(makeCtx({}), res as never);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown analysisId', async () => {
    const handler = createEntitiesHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId: 'not-a-real-id' }), res as never);
    expect(res.status).toBe(404);
  });

  it('returns entities list for valid analysisId', async () => {
    const handler = createEntitiesHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId }), res as never);
    expect(res.status).toBe(200);
    const body = res.json as { entities: unknown[]; total: number };
    expect(body.entities.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.entities.length);
  });

  it('filters by entity type via ?entity=PRODUCT', async () => {
    const handler = createEntitiesHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId, entity: 'PRODUCT' }), res as never);
    const { entities } = res.json as { entities: Array<{ entity: string }> };
    for (const e of entities) {
      expect(e.entity).toBe('PRODUCT');
    }
  });

  it('filters by minConfidence', async () => {
    const handler = createEntitiesHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId, minConfidence: '70' }), res as never);
    const { entities } = res.json as { entities: Array<{ confidence: number }> };
    for (const e of entities) {
      expect(e.confidence).toBeGreaterThanOrEqual(70);
    }
  });
});

describe('GET /discovery/suggestions', () => {
  let store: PrometheusStore;
  let analysisId: string;

  beforeEach(async () => {
    store = new PrometheusStore();
    const handler = createAnalyzeSchemaHandler(store);
    const res = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    ({ analysisId } = res.json as { analysisId: string });
  });

  it('returns 400 without analysisId', async () => {
    const handler = createSuggestionsHandler(store);
    const res = makeRes();
    await handler(makeCtx({}), res as never);
    expect(res.status).toBe(400);
  });

  it('returns suggestions for valid analysisId', async () => {
    const handler = createSuggestionsHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId }), res as never);
    expect(res.status).toBe(200);
    const body = res.json as { suggestions: unknown[] };
    expect(body.suggestions).toBeDefined();
  });

  it('filters by priority', async () => {
    const handler = createSuggestionsHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId, priority: '1' }), res as never);
    const { suggestions } = res.json as { suggestions: Array<{ priority: number }> };
    for (const s of suggestions) {
      expect(s.priority).toBe(1);
    }
  });

  it('fieldMapping is a plain object (JSON-serializable)', async () => {
    const handler = createSuggestionsHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId }), res as never);
    const { suggestions } = res.json as { suggestions: Array<{ fieldMapping: unknown }> };
    for (const s of suggestions) {
      expect(s.fieldMapping).toBeDefined();
      expect(typeof s.fieldMapping).toBe('object');
      expect(s.fieldMapping instanceof Map).toBe(false);
    }
  });
});

describe('GET /discovery/graph', () => {
  let store: PrometheusStore;
  let analysisId: string;

  beforeEach(async () => {
    store = new PrometheusStore();
    const handler = createAnalyzeSchemaHandler(store);
    const res = makeRes();
    await handler(makeCtx({}, { schema: ERP_SCHEMA }), res as never);
    ({ analysisId } = res.json as { analysisId: string });
  });

  it('returns 400 without analysisId', async () => {
    const handler = createGraphHandler(store);
    const res = makeRes();
    await handler(makeCtx({}), res as never);
    expect(res.status).toBe(400);
  });

  it('returns graph with nodes and edges', async () => {
    const handler = createGraphHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId }), res as never);
    expect(res.status).toBe(200);
    const { graph } = res.json as { graph: { nodes: unknown[]; edges: unknown[]; stats: { nodeCount: number } } };
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.stats.nodeCount).toBe(graph.nodes.length);
  });

  it('graph nodes have required shape', async () => {
    const handler = createGraphHandler(store);
    const res = makeRes();
    await handler(makeCtx({ analysisId }), res as never);
    const { graph } = res.json as { graph: { nodes: Array<{ id: string; entity: string; confidence: number }> } };
    for (const node of graph.nodes) {
      expect(typeof node.id).toBe('string');
      expect(typeof node.entity).toBe('string');
      expect(typeof node.confidence).toBe('number');
    }
  });
});
