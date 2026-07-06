import {
  InMemoryConfigStore,
  InMemoryCredentialStore,
  InMemoryConnectorLogger,
  EventBus,
  ConnectorScheduler,
} from '@seltriva/connector-sdk';
import type { ConnectorContext } from '@seltriva/connector-sdk';
import type {
  DatabaseAdapter, DatabaseHealth, DatabaseSchema, Query,
} from '@seltriva/database-sdk';
import type { Column } from '@seltriva/database-sdk';

export type TestContext = ConnectorContext & { logger: InMemoryConnectorLogger };

export const DEFAULT_CONFIG: Record<string, unknown> = {
  host:            'localhost',
  port:            5432,
  database:        'erp_seltriva',
  username:        'erp_user',
  password:        'erp_pass',
  ssl:             false,
  timeout:         5000,
  pollingInterval: 60_000,
};

// ── Controlled mock data (matches legacy ORION simulated values) ──────────────

const COL = (name: string): Column => ({
  name, type: 'varchar', nullable: true,
  isPrimaryKey: false, isForeignKey: false, isUnique: false,
});

const MOCK_SCHEMA: DatabaseSchema = {
  name: 'erp_test',
  tables: [
    { name: 'produtos',     columns: [COL('codigo'), COL('descricao'), COL('preco_venda'), COL('ativo'), COL('dt_alteracao')], primaryKey: undefined, foreignKeys: [], indexes: [] },
    { name: 'clientes',     columns: [COL('codigo'), COL('razao_social'), COL('email'), COL('cnpj_cpf'), COL('limite_credito'), COL('ativo'), COL('dt_alteracao')], primaryKey: undefined, foreignKeys: [], indexes: [] },
    { name: 'estoque',      columns: [COL('cod_produto'), COL('cod_deposito'), COL('qtd_atual'), COL('qtd_reservada')], primaryKey: undefined, foreignKeys: [], indexes: [] },
    { name: 'pedidos',      columns: [COL('numero'), COL('cod_cliente'), COL('status'), COL('valor_total')], primaryKey: undefined, foreignKeys: [], indexes: [] },
    { name: 'fornecedores', columns: [COL('codigo'), COL('razao_social'), COL('cnpj'), COL('ativo')],       primaryKey: undefined, foreignKeys: [], indexes: [] },
    { name: 'usuarios',     columns: [COL('login'), COL('nome'), COL('email'), COL('perfil'), COL('ativo')], primaryKey: undefined, foreignKeys: [], indexes: [] },
  ],
  relations:   [],
  discoveredAt: new Date(),
};

const MOCK_PRODUCT_ROWS = [
  { codigo: 'PROD-001', descricao: 'Widget A',    preco_venda:  29.99, cod_grupo: 'Electronics', ativo: true  },
  { codigo: 'PROD-002', descricao: 'Widget B',    preco_venda:  49.99, cod_grupo: 'Electronics', ativo: true  },
  { codigo: 'PROD-003', descricao: 'Gadget X',    preco_venda:  99.99, cod_grupo: 'Gadgets',     ativo: true  },
  { codigo: 'PROD-004', descricao: 'Gadget Y',    preco_venda: 149.99, cod_grupo: 'Gadgets',     ativo: false },
  { codigo: 'PROD-005', descricao: 'Component Z', preco_venda:   9.99, cod_grupo: 'Parts',       ativo: true  },
];

const MOCK_CUSTOMER_ROWS = [
  { codigo: 'CUST-001', razao_social: 'Acme Corp',     email: 'acme@example.com',     cnpj_cpf: '12.345.678/0001-00', limite_credito:  50000, ativo: true  },
  { codigo: 'CUST-002', razao_social: 'Globex Corp',   email: 'globex@example.com',   cnpj_cpf: '98.765.432/0001-00', limite_credito: 100000, ativo: true  },
  { codigo: 'CUST-003', razao_social: 'Initech LLC',   email: 'initech@example.com',  cnpj_cpf: '11.222.333/0001-00', limite_credito:  25000, ativo: false },
  { codigo: 'CUST-004', razao_social: 'Umbrella Corp', email: 'umbrella@example.com', cnpj_cpf: '55.666.777/0001-00', limite_credito: 200000, ativo: true  },
];

const MOCK_INVENTORY_ROWS = [
  { produto_codigo: 'PROD-001', deposito: 'WH-A', qtd_atual: 100, qtd_reservada: 10, dt_ultima_saida: null },
  { produto_codigo: 'PROD-001', deposito: 'WH-B', qtd_atual:  50, qtd_reservada:  5, dt_ultima_saida: null },
  { produto_codigo: 'PROD-002', deposito: 'WH-A', qtd_atual:  75, qtd_reservada: 20, dt_ultima_saida: null },
  { produto_codigo: 'PROD-003', deposito: 'WH-A', qtd_atual:  30, qtd_reservada:  3, dt_ultima_saida: null },
  { produto_codigo: 'PROD-005', deposito: 'WH-C', qtd_atual: 200, qtd_reservada: 15, dt_ultima_saida: null },
];

const MOCK_DB_HEALTH: DatabaseHealth = {
  connected: true, latency: 1, databaseVersion: 'PostgreSQL 15.0 (mock)',
  activeConnections: 1, poolUsage: 0.1, status: 'healthy',
};

export function makeMockDb(overrides: Partial<DatabaseAdapter> = {}): DatabaseAdapter {
  return {
    connect:    async () => {},
    disconnect: async () => {},
    reconnect:  async () => {},
    schema:     async () => ({ ...MOCK_SCHEMA, discoveredAt: new Date() }),
    health:     async () => ({ ...MOCK_DB_HEALTH }),
    transaction: async <T>(fn: () => Promise<T>) => fn(),
    execute: async <T>(query: Query): Promise<T[]> => {
      if (query.type === 'SELECT') {
        const sq = query as { type: 'SELECT'; table: string };
        if (sq.table === 'produtos' || sq.table === 'products') return MOCK_PRODUCT_ROWS as T[];
        if (sq.table === 'clientes' || sq.table === 'customers') return MOCK_CUSTOMER_ROWS as T[];
      }
      if (query.type === 'RAW') return MOCK_INVENTORY_ROWS as T[];
      return [];
    },
    ...overrides,
  };
}

export function makeContext(
  connectorId = 'test-erp',
  configOverride?: Record<string, unknown>,
): TestContext {
  const config      = new InMemoryConfigStore(configOverride ?? DEFAULT_CONFIG);
  const credentials = new InMemoryCredentialStore();
  const logger      = new InMemoryConnectorLogger(connectorId);
  const eventBus    = new EventBus();
  const scheduler   = new ConnectorScheduler();
  return { connectorId, config, credentials, logger, eventBus, scheduler };
}

export async function makeContextWithCredentials(
  connectorId = 'test-erp',
  configOverride?: Record<string, unknown>,
): Promise<TestContext> {
  const ctx = makeContext(connectorId, configOverride);
  await ctx.credentials.set('username', 'erp_user');
  await ctx.credentials.set('password', 'erp_pass');
  return ctx;
}
