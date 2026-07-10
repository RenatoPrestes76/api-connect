import type {
  MarketplaceConnector,
  ConnectorManifest,
  ConnectorReview,
  ConnectorVersion,
} from './types.js';
export { CONNECTOR_CATEGORIES } from './types.js';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function reviews(
  items: Array<{ author: string; rating: number; comment: string; daysAgo: number }>
): ConnectorReview[] {
  return items.map((r, i) => ({
    id: `rv-${i}`,
    author: r.author,
    rating: r.rating,
    comment: r.comment,
    createdAt: daysAgo(r.daysAgo),
  }));
}

function avgRating(rs: ConnectorReview[]): number {
  if (!rs.length) return 0;
  return Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10;
}

function connector(
  manifest: ConnectorManifest,
  versions: ConnectorVersion[],
  reviewList: ConnectorReview[],
  downloads: number,
  featured = false
): MarketplaceConnector {
  const checksum = `cs-${manifest.id}-${manifest.version}`;
  const signature = `sig-${checksum}-atlas`;
  return {
    manifest,
    status: 'available',
    publishedAt: daysAgo(180),
    updatedAt: daysAgo(7),
    downloads,
    rating: avgRating(reviewList),
    reviewCount: reviewList.length,
    reviews: reviewList,
    versions,
    checksum,
    signature,
    verified: true,
    featured,
  };
}

// ─── ERP (4) ──────────────────────────────────────────────────────────────────

const erpSeltrivas = connector(
  {
    id: 'seltriva-erp',
    name: 'Seltriva ERP',
    version: '3.1.0',
    description:
      'Conector oficial para o Seltriva ERP — sincronização bidirecional de produtos, pedidos, clientes e estoque.',
    category: 'ERP',
    author: 'Seltriva',
    license: 'Apache-2.0',
    homepage: 'https://seltriva.com/connectors/erp',
    keywords: ['erp', 'seltriva', 'produtos', 'pedidos'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '3.1.0',
      releasedAt: daysAgo(7),
      changelog: 'Suporte a NF-e 4.0 e paginação cursor-based.',
      breaking: false,
    },
    {
      version: '3.0.0',
      releasedAt: daysAgo(60),
      changelog: 'API v3: autenticação OAuth 2.0 + streaming.',
      breaking: true,
    },
    {
      version: '2.5.0',
      releasedAt: daysAgo(120),
      changelog: 'Sync incremental de inventário.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Carlos M.',
      rating: 5,
      comment: 'Perfeito para nossa operação de e-commerce.',
      daysAgo: 14,
    },
    { author: 'Ana P.', rating: 4, comment: 'Estável e bem documentado.', daysAgo: 30 },
    {
      author: 'Roberto F.',
      rating: 5,
      comment: 'Indispensável, integra tudo que precisamos.',
      daysAgo: 45,
    },
  ]),
  12_450,
  true
);

const sapBusinessOne = connector(
  {
    id: 'sap-business-one',
    name: 'SAP Business One',
    version: '2.3.0',
    description:
      'Integração completa com SAP Business One via Service Layer API — mestres de dados e transações.',
    category: 'ERP',
    author: 'Seltriva Partners',
    license: 'MIT',
    keywords: ['sap', 'b1', 'erp', 'service-layer'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 1.0, memoryMb: 512 },
  },
  [
    {
      version: '2.3.0',
      releasedAt: daysAgo(14),
      changelog: 'Suporte ao SAP B1 10.0 FP2306.',
      breaking: false,
    },
    {
      version: '2.2.0',
      releasedAt: daysAgo(90),
      changelog: 'Autenticação via B1 Session e SSL.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Marcos T.',
      rating: 4,
      comment: 'Bom suporte a ODATA, some edge cases ainda pendentes.',
      daysAgo: 20,
    },
    {
      author: 'Julia S.',
      rating: 5,
      comment: 'Sincronizamos 50k produtos sem problemas.',
      daysAgo: 60,
    },
  ]),
  4_320
);

const totvsProtheus = connector(
  {
    id: 'totvs-protheus',
    name: 'TOTVS Protheus',
    version: '1.8.0',
    description:
      'Conector para TOTVS Protheus — integração via REST API e ADVPL para módulos SIGAEST, SIGAFAT e SIGACOM.',
    category: 'ERP',
    author: 'Community',
    license: 'MIT',
    keywords: ['totvs', 'protheus', 'advpl', 'sigaest'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 384 },
  },
  [
    {
      version: '1.8.0',
      releasedAt: daysAgo(21),
      changelog: 'Compatibilidade com Protheus 12.1.2310.',
      breaking: false,
    },
    {
      version: '1.7.0',
      releasedAt: daysAgo(80),
      changelog: 'Módulo SIGACOM adicionado.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Diego N.',
      rating: 4,
      comment: 'Funciona bem para SIGAEST. Aguardando suporte ao SIGAFIN.',
      daysAgo: 10,
    },
    {
      author: 'Camila R.',
      rating: 3,
      comment: 'Documentação poderia ser mais detalhada.',
      daysAgo: 35,
    },
  ]),
  2_180
);

const oracleNetsuite = connector(
  {
    id: 'oracle-netsuite',
    name: 'Oracle NetSuite',
    version: '2.0.1',
    description:
      'Integração com Oracle NetSuite via SuiteQL e REST Web Services para finanças, estoque e CRM.',
    category: 'ERP',
    author: 'Seltriva Partners',
    license: 'Apache-2.0',
    keywords: ['netsuite', 'oracle', 'suiteql', 'cloud-erp'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '2.0.1',
      releasedAt: daysAgo(5),
      changelog: 'Correção de rate limiting em SuiteQL.',
      breaking: false,
    },
    {
      version: '2.0.0',
      releasedAt: daysAgo(45),
      changelog: 'Migração para REST WS 2023.2.',
      breaking: true,
    },
  ],
  reviews([
    {
      author: 'Patricia L.',
      rating: 5,
      comment: 'Integração com módulo financeiro impecável.',
      daysAgo: 8,
    },
    {
      author: 'Fernando K.',
      rating: 4,
      comment: 'SuiteQL muito poderoso via este conector.',
      daysAgo: 40,
    },
  ]),
  1_850
);

// ─── CRM (3) ──────────────────────────────────────────────────────────────────

const salesforce = connector(
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    version: '4.2.0',
    description:
      'Sincroniza leads, oportunidades, contas e objetos customizados com Salesforce via API REST e Bulk API 2.0.',
    category: 'CRM',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['salesforce', 'crm', 'leads', 'sfdc'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '4.2.0',
      releasedAt: daysAgo(10),
      changelog: 'Suporte Bulk API 2.0 para 100k+ registros.',
      breaking: false,
    },
    {
      version: '4.1.0',
      releasedAt: daysAgo(60),
      changelog: 'OAuth JWT para Connected Apps.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Bianca T.',
      rating: 5,
      comment: 'Bulk API funciona perfeitamente para nosso volume.',
      daysAgo: 12,
    },
    {
      author: 'Rodrigo M.',
      rating: 5,
      comment: 'Mapeamento de objetos customizados muito flexível.',
      daysAgo: 25,
    },
    {
      author: 'Letícia P.',
      rating: 4,
      comment: 'Estável. Seria ótimo ter suporte a Platform Events.',
      daysAgo: 50,
    },
  ]),
  8_730,
  true
);

const hubspot = connector(
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    version: '2.1.0',
    description:
      'Integração bidirecional com HubSpot — contatos, negócios, empresas, formulários e e-mails de marketing.',
    category: 'CRM',
    author: 'Community',
    license: 'MIT',
    keywords: ['hubspot', 'crm', 'marketing', 'contacts'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.1.0',
      releasedAt: daysAgo(18),
      changelog: 'Suporte a HubSpot Workflows via API de automação.',
      breaking: false,
    },
    {
      version: '2.0.0',
      releasedAt: daysAgo(75),
      changelog: 'Migração para HubSpot API v3.',
      breaking: true,
    },
  ],
  reviews([
    {
      author: 'Amanda C.',
      rating: 4,
      comment: 'Integração com formulários muito prática.',
      daysAgo: 22,
    },
    {
      author: 'Bruno G.',
      rating: 5,
      comment: 'Sincronizou 200k contatos em minutos.',
      daysAgo: 55,
    },
  ]),
  3_670
);

const pipedrive = connector(
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    version: '1.5.0',
    description:
      'Conector para Pipedrive CRM — pipeline de vendas, atividades, organizações e deals.',
    category: 'CRM',
    author: 'Community',
    license: 'MIT',
    keywords: ['pipedrive', 'crm', 'sales', 'pipeline'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '1.5.0',
      releasedAt: daysAgo(30),
      changelog: 'Suporte a webhooks nativos do Pipedrive.',
      breaking: false,
    },
    {
      version: '1.4.0',
      releasedAt: daysAgo(90),
      changelog: 'Rate limiting automático com retry.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Lucas F.',
      rating: 4,
      comment: 'Simples e eficiente para sync de deals.',
      daysAgo: 35,
    },
    {
      author: 'Sofia A.',
      rating: 4,
      comment: 'Ótimo para equipes pequenas de vendas.',
      daysAgo: 65,
    },
  ]),
  1_290
);

// ─── E-commerce (3) ───────────────────────────────────────────────────────────

const shopify = connector(
  {
    id: 'shopify',
    name: 'Shopify',
    version: '3.4.0',
    description:
      'Integração completa com Shopify — produtos, variantes, pedidos, clientes, metafields e GraphQL Admin API.',
    category: 'E-commerce',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['shopify', 'ecommerce', 'products', 'orders', 'graphql'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '3.4.0',
      releasedAt: daysAgo(6),
      changelog: 'Suporte à API 2024-01, cost-based throttling.',
      breaking: false,
    },
    {
      version: '3.3.0',
      releasedAt: daysAgo(45),
      changelog: 'Metafields e Bulk Operations.',
      breaking: false,
    },
    {
      version: '3.0.0',
      releasedAt: daysAgo(120),
      changelog: 'Migração para GraphQL Admin API.',
      breaking: true,
    },
  ],
  reviews([
    {
      author: 'Fernanda O.',
      rating: 5,
      comment: 'Melhor conector Shopify que já usei.',
      daysAgo: 8,
    },
    {
      author: 'Gustavo P.',
      rating: 5,
      comment: 'Bulk Operations economizou horas de processamento.',
      daysAgo: 20,
    },
    {
      author: 'Isabela M.',
      rating: 4,
      comment: 'Estável. Aguardando suporte a Shopify Markets.',
      daysAgo: 40,
    },
  ]),
  7_120,
  true
);

const woocommerce = connector(
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    version: '2.2.0',
    description: 'Sincroniza produtos, pedidos e clientes com WooCommerce via REST API v3.',
    category: 'E-commerce',
    author: 'Community',
    license: 'MIT',
    keywords: ['woocommerce', 'wordpress', 'ecommerce'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.2.0',
      releasedAt: daysAgo(25),
      changelog: 'Suporte a WooCommerce 8.x.',
      breaking: false,
    },
    {
      version: '2.1.0',
      releasedAt: daysAgo(85),
      changelog: 'Batch update de estoque.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Thiago S.',
      rating: 4,
      comment: 'Funciona muito bem para lojas de médio porte.',
      daysAgo: 28,
    },
    {
      author: 'Mariana B.',
      rating: 3,
      comment: 'Limitações na paginação para catálogos grandes.',
      daysAgo: 70,
    },
  ]),
  2_840
);

const vtex = connector(
  {
    id: 'vtex',
    name: 'VTEX',
    version: '2.5.0',
    description:
      'Conector oficial VTEX — catálogo, pedidos, pricing, estoque e políticas comerciais via VTEX IO.',
    category: 'E-commerce',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['vtex', 'ecommerce', 'brasil', 'catalog', 'pricing'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '2.5.0',
      releasedAt: daysAgo(12),
      changelog: 'Suporte à VTEX API v2 e políticas comerciais dinâmicas.',
      breaking: false,
    },
    {
      version: '2.4.0',
      releasedAt: daysAgo(55),
      changelog: 'Gestão de sellers e comissões.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Renata C.',
      rating: 5,
      comment: 'Essencial para operações omnichannel no Brasil.',
      daysAgo: 15,
    },
    {
      author: 'Pedro H.',
      rating: 4,
      comment: 'Integração com pricing muito robusta.',
      daysAgo: 50,
    },
  ]),
  5_430,
  true
);

// ─── Marketplace (4) ──────────────────────────────────────────────────────────

const mercadoLivre = connector(
  {
    id: 'mercado-livre',
    name: 'Mercado Livre',
    version: '4.0.0',
    description:
      'Publicação, gestão de anúncios, preços, estoque e pedidos no Mercado Livre via MercadoLibre API.',
    category: 'Marketplace',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['mercadolivre', 'marketplace', 'anuncios', 'brasil'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '4.0.0',
      releasedAt: daysAgo(3),
      changelog: 'Suporte a anúncios Plus e Premium + flexibilização de frete.',
      breaking: false,
    },
    {
      version: '3.5.0',
      releasedAt: daysAgo(50),
      changelog: 'Gestão de perguntas e respostas automática.',
      breaking: false,
    },
    {
      version: '3.0.0',
      releasedAt: daysAgo(150),
      changelog: 'Migração para API Flex Shipping.',
      breaking: true,
    },
  ],
  reviews([
    { author: 'André M.', rating: 5, comment: 'Indispensável para quem vende no ML.', daysAgo: 5 },
    {
      author: 'Vanessa R.',
      rating: 5,
      comment: 'Gestão de estoque em tempo real perfeita.',
      daysAgo: 22,
    },
    {
      author: 'Eduardo F.',
      rating: 4,
      comment: 'Estável, apenas alguns edge cases na integração com Full.',
      daysAgo: 45,
    },
  ]),
  15_230,
  true
);

const amazonSeller = connector(
  {
    id: 'amazon-seller',
    name: 'Amazon Seller',
    version: '2.1.0',
    description:
      'Integração com Amazon Selling Partner API (SP-API) — listagens, pedidos, inventário e relatórios FBA.',
    category: 'Marketplace',
    author: 'Seltriva Partners',
    license: 'MIT',
    keywords: ['amazon', 'sp-api', 'fba', 'marketplace'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 384 },
  },
  [
    {
      version: '2.1.0',
      releasedAt: daysAgo(20),
      changelog: 'Relatórios FBA assíncronos e IAM Role.',
      breaking: false,
    },
    {
      version: '2.0.0',
      releasedAt: daysAgo(90),
      changelog: 'Migração para SP-API (deprecação MWS).',
      breaking: true,
    },
  ],
  reviews([
    {
      author: 'Claudia T.',
      rating: 4,
      comment: 'SP-API bem implementado, migração do MWS tranquila.',
      daysAgo: 25,
    },
    {
      author: 'Ricardo S.',
      rating: 5,
      comment: 'Relatórios FBA economizaram horas de análise.',
      daysAgo: 60,
    },
  ]),
  6_890
);

const shopee = connector(
  {
    id: 'shopee',
    name: 'Shopee',
    version: '1.6.0',
    description: 'Gestão de produtos, pedidos e logística na Shopee via Shopee Open API v2.',
    category: 'Marketplace',
    author: 'Community',
    license: 'MIT',
    keywords: ['shopee', 'marketplace', 'brasil', 'logistica'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '1.6.0',
      releasedAt: daysAgo(15),
      changelog: 'Suporte a promoções e vouchers da Shopee.',
      breaking: false,
    },
    {
      version: '1.5.0',
      releasedAt: daysAgo(70),
      changelog: 'Rastreamento de envios integrado.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Natalia G.',
      rating: 4,
      comment: 'Funciona bem para catálogos até 10k SKUs.',
      daysAgo: 18,
    },
    {
      author: 'Felipe A.',
      rating: 3,
      comment: 'Algumas inconsistências na API de promoções da Shopee.',
      daysAgo: 40,
    },
  ]),
  3_120
);

const magazineLuiza = connector(
  {
    id: 'magazine-luiza',
    name: 'Magazine Luiza',
    version: '1.2.0',
    description:
      'Integração com o marketplace Magazine Luiza — produtos, pedidos e logística via Magalu API.',
    category: 'Marketplace',
    author: 'Community',
    license: 'MIT',
    keywords: ['magalu', 'magazine-luiza', 'marketplace', 'brasil'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '1.2.0',
      releasedAt: daysAgo(40),
      changelog: 'Suporte à API de Pedidos v3 da Magalu.',
      breaking: false,
    },
    {
      version: '1.1.0',
      releasedAt: daysAgo(100),
      changelog: 'Integração com fulfillment Magalu.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Juliana C.',
      rating: 4,
      comment: 'Estável e prático para gestão de pedidos.',
      daysAgo: 45,
    },
    {
      author: 'Henrique O.',
      rating: 4,
      comment: 'Fulfillment da Magalu integrado sem problemas.',
      daysAgo: 90,
    },
  ]),
  2_010
);

// ─── WMS (2) ──────────────────────────────────────────────────────────────────

const inforWms = connector(
  {
    id: 'infor-wms',
    name: 'Infor WMS',
    version: '1.3.0',
    description:
      'Integração com Infor WMS — movimentações de estoque, recebimento, separação e expedição.',
    category: 'WMS',
    author: 'Seltriva Partners',
    license: 'Apache-2.0',
    keywords: ['infor', 'wms', 'warehouse', 'estoque'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '1.3.0',
      releasedAt: daysAgo(30),
      changelog: 'Suporte a Infor WMS 11.3.',
      breaking: false,
    },
    {
      version: '1.2.0',
      releasedAt: daysAgo(90),
      changelog: 'Integração com módulo de separação por ondas.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Marcos P.',
      rating: 4,
      comment: 'Movimentações de estoque em tempo real.',
      daysAgo: 35,
    },
    { author: 'Silvia T.', rating: 4, comment: 'Boa cobertura das APIs do Infor.', daysAgo: 80 },
  ]),
  1_100
);

const manhattanWms = connector(
  {
    id: 'manhattan-wms',
    name: 'Manhattan WMS',
    version: '1.1.0',
    description:
      'Conector para Manhattan Active WMS — integrações via REST API para operações de armazém empresariais.',
    category: 'WMS',
    author: 'Seltriva Partners',
    license: 'Apache-2.0',
    keywords: ['manhattan', 'wms', 'warehouse', 'enterprise'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 384 },
  },
  [
    {
      version: '1.1.0',
      releasedAt: daysAgo(45),
      changelog: 'Suporte a Active WMS 2024.',
      breaking: false,
    },
    {
      version: '1.0.0',
      releasedAt: daysAgo(130),
      changelog: 'Lançamento inicial.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Roberto B.',
      rating: 5,
      comment: 'Enterprise-grade, suporte excelente.',
      daysAgo: 50,
    },
    {
      author: 'Cristina M.',
      rating: 4,
      comment: 'Estável em ambientes de alta demanda.',
      daysAgo: 110,
    },
  ]),
  760
);

// ─── Banco de dados (4) ───────────────────────────────────────────────────────

const postgresql = connector(
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    version: '3.0.0',
    description:
      'Leitura e escrita em bancos PostgreSQL com suporte a streaming CDC via logical replication.',
    category: 'Banco de dados',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['postgresql', 'postgres', 'sql', 'cdc'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '3.0.0',
      releasedAt: daysAgo(8),
      changelog: 'CDC via pgoutput (logical replication).',
      breaking: true,
    },
    {
      version: '2.5.0',
      releasedAt: daysAgo(60),
      changelog: 'Pool de conexões e prepared statements.',
      breaking: false,
    },
    {
      version: '2.4.0',
      releasedAt: daysAgo(110),
      changelog: 'Suporte a JSONB e arrays.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Tiago O.',
      rating: 5,
      comment: 'CDC muito útil para replicação em tempo real.',
      daysAgo: 10,
    },
    {
      author: 'Priya K.',
      rating: 5,
      comment: 'Best-in-class para integrações com Postgres.',
      daysAgo: 30,
    },
    {
      author: 'Daniel F.',
      rating: 4,
      comment: 'Excelente, queremos suporte a particionamento.',
      daysAgo: 55,
    },
  ]),
  9_540,
  true
);

const mysql = connector(
  {
    id: 'mysql',
    name: 'MySQL / MariaDB',
    version: '2.4.0',
    description:
      'Conector para MySQL e MariaDB com suporte a binlog CDC, batch queries e prepared statements.',
    category: 'Banco de dados',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['mysql', 'mariadb', 'sql', 'binlog'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '2.4.0',
      releasedAt: daysAgo(12),
      changelog: 'MariaDB 11.x e MySQL 8.2 suportados.',
      breaking: false,
    },
    {
      version: '2.3.0',
      releasedAt: daysAgo(65),
      changelog: 'Binlog CDC com retry automático.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Ellen S.',
      rating: 4,
      comment: 'Binlog CDC funciona bem para replicação.',
      daysAgo: 15,
    },
    { author: 'Carlos V.', rating: 5, comment: 'Compatível com MariaDB sem ajustes.', daysAgo: 45 },
  ]),
  6_780
);

const sqlServer = connector(
  {
    id: 'sql-server',
    name: 'SQL Server',
    version: '2.2.0',
    description:
      'Integração com Microsoft SQL Server e Azure SQL — CDC via Change Data Capture nativo do SQL Server.',
    category: 'Banco de dados',
    author: 'Seltriva Partners',
    license: 'MIT',
    keywords: ['sqlserver', 'mssql', 'azure-sql', 'cdc'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 384 },
  },
  [
    {
      version: '2.2.0',
      releasedAt: daysAgo(20),
      changelog: 'Suporte a Azure SQL Managed Instance.',
      breaking: false,
    },
    {
      version: '2.1.0',
      releasedAt: daysAgo(75),
      changelog: 'Always Encrypted para dados sensíveis.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Miguel C.',
      rating: 4,
      comment: 'CDC nativo do SQL Server bem aproveitado.',
      daysAgo: 25,
    },
    { author: 'Larissa T.', rating: 4, comment: 'Funciona bem com Azure SQL.', daysAgo: 70 },
  ]),
  4_210
);

const mongodb = connector(
  {
    id: 'mongodb',
    name: 'MongoDB',
    version: '2.0.0',
    description: 'Leitura e escrita em coleções MongoDB com Change Streams para CDC em tempo real.',
    category: 'Banco de dados',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['mongodb', 'nosql', 'change-streams', 'atlas'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['read:data', 'write:data', 'access:credentials', 'access:network'],
    resourceLimits: { cpuCores: 0.5, memoryMb: 256 },
  },
  [
    {
      version: '2.0.0',
      releasedAt: daysAgo(14),
      changelog: 'Change Streams + suporte MongoDB Atlas.',
      breaking: true,
    },
    {
      version: '1.5.0',
      releasedAt: daysAgo(80),
      changelog: 'Aggregation pipeline no mapeamento.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Ines R.',
      rating: 4,
      comment: 'Change Streams excelente para eventos em tempo real.',
      daysAgo: 16,
    },
    {
      author: 'Bruno O.',
      rating: 5,
      comment: 'Atlas + Change Streams: a combinação perfeita.',
      daysAgo: 45,
    },
  ]),
  5_120
);

// ─── APIs REST (2) ────────────────────────────────────────────────────────────

const genericRest = connector(
  {
    id: 'generic-rest',
    name: 'Generic REST',
    version: '2.0.0',
    description:
      'Conector universal para qualquer API REST — autenticação flexível, mapeamento de resposta e retry.',
    category: 'APIs REST',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['rest', 'http', 'api', 'generic', 'universal'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.0.0',
      releasedAt: daysAgo(22),
      changelog: 'Suporte a autenticação OAuth 2.0, Basic, Bearer e API Key.',
      breaking: false,
    },
    {
      version: '1.9.0',
      releasedAt: daysAgo(90),
      changelog: 'Retry com backoff exponencial.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Valeria M.',
      rating: 5,
      comment: 'Conectou um sistema legado que não tinha conector específico.',
      daysAgo: 28,
    },
    {
      author: 'Gilberto T.',
      rating: 4,
      comment: 'Muito flexível, autenticação customizável.',
      daysAgo: 60,
    },
  ]),
  11_200,
  true
);

const openapi = connector(
  {
    id: 'openapi',
    name: 'OpenAPI / Swagger',
    version: '1.4.0',
    description:
      'Gera conectores automaticamente a partir de especificações OpenAPI 3.0 / Swagger 2.0.',
    category: 'APIs REST',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['openapi', 'swagger', 'api', 'codegen'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '1.4.0',
      releasedAt: daysAgo(35),
      changelog: 'Geração automática de tipos TypeScript da spec.',
      breaking: false,
    },
    {
      version: '1.3.0',
      releasedAt: daysAgo(100),
      changelog: 'Suporte a OpenAPI 3.1.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Maya L.',
      rating: 5,
      comment: 'Integrei uma API complexa em minutos com a spec existente.',
      daysAgo: 40,
    },
    {
      author: 'Victor P.',
      rating: 4,
      comment: 'Geração de tipos muito boa, algumas edge cases no 3.1.',
      daysAgo: 80,
    },
  ]),
  4_650
);

// ─── GraphQL (2) ──────────────────────────────────────────────────────────────

const apolloGraphql = connector(
  {
    id: 'apollo-graphql',
    name: 'Apollo GraphQL',
    version: '2.1.0',
    description:
      'Executa queries e mutations GraphQL contra qualquer schema Apollo Server — subscriptions via WebSocket.',
    category: 'GraphQL',
    author: 'Community',
    license: 'MIT',
    keywords: ['graphql', 'apollo', 'queries', 'subscriptions'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.1.0',
      releasedAt: daysAgo(28),
      changelog: 'Subscriptions via WebSocket com reconexão automática.',
      breaking: false,
    },
    {
      version: '2.0.0',
      releasedAt: daysAgo(95),
      changelog: 'Suporte a fragments e inline variables.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Sarah K.',
      rating: 4,
      comment: 'Queries e mutations funcionam perfeitamente.',
      daysAgo: 30,
    },
    {
      author: 'Thiago M.',
      rating: 5,
      comment: 'Subscriptions em tempo real muito estável.',
      daysAgo: 65,
    },
  ]),
  2_340
);

const hasura = connector(
  {
    id: 'hasura',
    name: 'Hasura GraphQL',
    version: '1.3.0',
    description:
      'Integração com Hasura GraphQL Engine — event triggers, actions e subscriptions em tempo real.',
    category: 'GraphQL',
    author: 'Community',
    license: 'MIT',
    keywords: ['hasura', 'graphql', 'realtime', 'postgres'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '1.3.0',
      releasedAt: daysAgo(42),
      changelog: 'Event triggers com retry e DLQ automático.',
      breaking: false,
    },
    {
      version: '1.2.0',
      releasedAt: daysAgo(110),
      changelog: 'Suporte a Hasura Cloud e autenticação JWT.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Lena P.',
      rating: 5,
      comment: 'Event triggers perfeitos para arquitetura event-driven.',
      daysAgo: 50,
    },
    {
      author: 'Diego L.',
      rating: 4,
      comment: 'Integração com Hasura Cloud sem fricção.',
      daysAgo: 90,
    },
  ]),
  1_780
);

// ─── Mensageria (3) ───────────────────────────────────────────────────────────

const rabbitmq = connector(
  {
    id: 'rabbitmq',
    name: 'RabbitMQ',
    version: '2.2.0',
    description:
      'Producer e Consumer para RabbitMQ — exchanges, queues, dead-letter, prefetch e ACK manual.',
    category: 'Mensageria',
    author: 'Seltriva',
    license: 'MIT',
    keywords: ['rabbitmq', 'amqp', 'messaging', 'queue'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.2.0',
      releasedAt: daysAgo(18),
      changelog: 'Suporte a Quorum Queues e RabbitMQ 3.13.',
      breaking: false,
    },
    {
      version: '2.1.0',
      releasedAt: daysAgo(75),
      changelog: 'Prefetch e ACK manual com retry.',
      breaking: false,
    },
  ],
  reviews([
    { author: 'Paulo N.', rating: 5, comment: 'Dead-letter handling excelente.', daysAgo: 22 },
    { author: 'Aline T.', rating: 4, comment: 'Quorum Queues funcionando bem.', daysAgo: 55 },
  ]),
  5_890
);

const apacheKafka = connector(
  {
    id: 'apache-kafka',
    name: 'Apache Kafka',
    version: '3.1.0',
    description:
      'Producer e Consumer Kafka — schema registry, compactação, consumer groups e exatamente-uma-vez.',
    category: 'Mensageria',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['kafka', 'streaming', 'consumer', 'producer', 'schema-registry'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 1.0, memoryMb: 512 },
  },
  [
    {
      version: '3.1.0',
      releasedAt: daysAgo(9),
      changelog: 'Exactly-once semantics e suporte ao Kafka 3.7.',
      breaking: false,
    },
    {
      version: '3.0.0',
      releasedAt: daysAgo(60),
      changelog: 'Schema Registry Avro e JSON Schema.',
      breaking: true,
    },
    {
      version: '2.5.0',
      releasedAt: daysAgo(130),
      changelog: 'Consumer groups com rebalanceamento automático.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Omar S.',
      rating: 5,
      comment: 'Schema Registry + exactly-once: produção-pronto.',
      daysAgo: 12,
    },
    {
      author: 'Beatriz A.',
      rating: 5,
      comment: 'Processamos 1M msgs/s sem problemas.',
      daysAgo: 35,
    },
    {
      author: 'Leandro F.',
      rating: 4,
      comment: 'Configuração inicial requer conhecimento do Kafka.',
      daysAgo: 70,
    },
  ]),
  7_340,
  true
);

const awsSqs = connector(
  {
    id: 'aws-sqs',
    name: 'AWS SQS',
    version: '2.0.0',
    description:
      'Producer e Consumer para AWS SQS — Standard e FIFO, long polling, visibilidade e dead-letter queue.',
    category: 'Mensageria',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['aws', 'sqs', 'queue', 'fifo', 'cloud'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.0.0',
      releasedAt: daysAgo(16),
      changelog: 'Suporte FIFO com deduplicação e IAM Role assumido.',
      breaking: false,
    },
    {
      version: '1.5.0',
      releasedAt: daysAgo(80),
      changelog: 'Long polling e message batch (10 msgs).',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Nathan C.',
      rating: 4,
      comment: 'FIFO com deduplicação muito confiável.',
      daysAgo: 20,
    },
    {
      author: 'Debora M.',
      rating: 5,
      comment: 'Integração com IAM Role perfeita para segurança.',
      daysAgo: 55,
    },
  ]),
  4_430
);

// ─── Armazenamento em nuvem (3) ───────────────────────────────────────────────

const awsS3 = connector(
  {
    id: 'aws-s3',
    name: 'AWS S3',
    version: '3.0.0',
    description:
      'Leitura, escrita e streaming de objetos no AWS S3 — multipart upload, presigned URLs e eventos S3.',
    category: 'Armazenamento em nuvem',
    author: 'Seltriva',
    license: 'Apache-2.0',
    keywords: ['aws', 's3', 'storage', 'cloud', 'objects'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '3.0.0',
      releasedAt: daysAgo(11),
      changelog: 'Streaming multipart upload e S3 Express One Zone.',
      breaking: false,
    },
    {
      version: '2.5.0',
      releasedAt: daysAgo(70),
      changelog: 'Presigned URLs e eventos S3 → workflow trigger.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Karla B.',
      rating: 5,
      comment: 'Multipart upload para arquivos grandes perfeito.',
      daysAgo: 14,
    },
    {
      author: 'James O.',
      rating: 5,
      comment: 'S3 events como workflow trigger mudou nossa arquitetura.',
      daysAgo: 40,
    },
    {
      author: 'Miriam T.',
      rating: 4,
      comment: 'Excelente, queremos suporte a S3 Glacier.',
      daysAgo: 70,
    },
  ]),
  8_920,
  true
);

const googleCloudStorage = connector(
  {
    id: 'google-cloud-storage',
    name: 'Google Cloud Storage',
    version: '2.1.0',
    description:
      'Integração com GCS — upload, download, gerenciamento de buckets e notificações via Pub/Sub.',
    category: 'Armazenamento em nuvem',
    author: 'Seltriva Partners',
    license: 'Apache-2.0',
    keywords: ['gcs', 'google', 'cloud', 'storage', 'buckets'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.1.0',
      releasedAt: daysAgo(25),
      changelog: 'Notificações GCS → Pub/Sub → workflow trigger.',
      breaking: false,
    },
    {
      version: '2.0.0',
      releasedAt: daysAgo(85),
      changelog: 'Autenticação via Workload Identity Federation.',
      breaking: false,
    },
  ],
  reviews([
    { author: 'Anita K.', rating: 4, comment: 'Notificações Pub/Sub muito úteis.', daysAgo: 30 },
    {
      author: 'Marco S.',
      rating: 5,
      comment: 'Workload Identity eliminou necessidade de chaves de serviço.',
      daysAgo: 75,
    },
  ]),
  3_450
);

const azureBlob = connector(
  {
    id: 'azure-blob',
    name: 'Azure Blob Storage',
    version: '2.0.0',
    description:
      'Conector para Azure Blob Storage — operações em blobs, containers, SAS tokens e Event Grid triggers.',
    category: 'Armazenamento em nuvem',
    author: 'Seltriva Partners',
    license: 'Apache-2.0',
    keywords: ['azure', 'blob', 'storage', 'cloud', 'microsoft'],
    compatibility: { atlasVersion: '^1.0.0', nodeVersion: '>=20' },
    permissions: ['access:network', 'access:credentials'],
    resourceLimits: { cpuCores: 0.25, memoryMb: 128 },
  },
  [
    {
      version: '2.0.0',
      releasedAt: daysAgo(33),
      changelog: 'Event Grid triggers e Managed Identity.',
      breaking: false,
    },
    {
      version: '1.4.0',
      releasedAt: daysAgo(100),
      changelog: 'SAS tokens de duração configurável.',
      breaking: false,
    },
  ],
  reviews([
    {
      author: 'Tiago L.',
      rating: 4,
      comment: 'Event Grid + Managed Identity: produção-pronto.',
      daysAgo: 38,
    },
    { author: 'Sandra F.', rating: 4, comment: 'SAS tokens bem implementados.', daysAgo: 85 },
  ]),
  2_780
);

// ─── Export ───────────────────────────────────────────────────────────────────

export const CONNECTOR_CATALOG: MarketplaceConnector[] = [
  // ERP
  erpSeltrivas,
  sapBusinessOne,
  totvsProtheus,
  oracleNetsuite,
  // CRM
  salesforce,
  hubspot,
  pipedrive,
  // E-commerce
  shopify,
  woocommerce,
  vtex,
  // Marketplace
  mercadoLivre,
  amazonSeller,
  shopee,
  magazineLuiza,
  // WMS
  inforWms,
  manhattanWms,
  // Banco de dados
  postgresql,
  mysql,
  sqlServer,
  mongodb,
  // APIs REST
  genericRest,
  openapi,
  // GraphQL
  apolloGraphql,
  hasura,
  // Mensageria
  rabbitmq,
  apacheKafka,
  awsSqs,
  // Armazenamento em nuvem
  awsS3,
  googleCloudStorage,
  azureBlob,
];

export function getConnector(id: string): MarketplaceConnector | undefined {
  return CONNECTOR_CATALOG.find((c) => c.manifest.id === id);
}

export function listByCategory(category: string): MarketplaceConnector[] {
  return CONNECTOR_CATALOG.filter((c) => c.manifest.category === category);
}

export function searchConnectors(query: string, limit = 20): MarketplaceConnector[] {
  const q = query.toLowerCase();
  return CONNECTOR_CATALOG.filter((c) => {
    const m = c.manifest;
    return (
      m.id.includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.includes(q))
    );
  }).slice(0, limit);
}
