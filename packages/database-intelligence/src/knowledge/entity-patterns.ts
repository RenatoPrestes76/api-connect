/**
 * Entity pattern dictionaries — the core knowledge base of ATHENA.
 *
 * Each entry covers:
 *  - exact: table names that almost certainly match the entity (weight 100)
 *  - strong: high-confidence fragments (weight 80)
 *  - medium: moderate-confidence fragments (weight 50)
 *  - weak: low-confidence hints (weight 20)
 *
 * All strings are lower-case; the scorer normalises input before matching.
 * Patterns cover Portuguese-Brazilian ERP conventions ("tb_", "cad_", "mov_")
 * and English equivalents.
 */
import type { EntityType } from '../types/index.js';

export interface EntityPatternSet {
  readonly exact: readonly string[];
  readonly strong: readonly string[];
  readonly medium: readonly string[];
  readonly weak: readonly string[];
}

export const ENTITY_PATTERNS: Readonly<Record<EntityType, EntityPatternSet>> = {
  PRODUCT: {
    exact: [
      'produto',
      'produtos',
      'product',
      'products',
      'tb_produto',
      'tb_produtos',
      'cad_produto',
      'cad_produtos',
      'tb_product',
      'tbl_produto',
    ],
    strong: [
      'prod',
      'item',
      'items',
      'article',
      'articles',
      'material',
      'materiais',
      'mercadoria',
      'mercadorias',
      'bem',
      'bens',
      'sku',
      'catalogo',
      'catalog',
      'cadprod',
      'cad_prod',
      'tb_prod',
      'tbl_prod',
      'caditem',
      'cad_item',
      'tb_item',
    ],
    medium: [
      'peca',
      'pecas',
      'part',
      'parts',
      'component',
      'components',
      'insumo',
      'insumos',
      'supply',
      'supplies',
      'embalagem',
      'packaging',
      'estocavel',
      'stockable',
    ],
    weak: ['codigo', 'descricao', 'ean', 'gtin'],
  },

  SUPPLIER: {
    exact: [
      'fornecedor',
      'fornecedores',
      'supplier',
      'suppliers',
      'tb_fornecedor',
      'cad_fornecedor',
    ],
    strong: [
      'vendor',
      'vendors',
      'fabricante',
      'fabricantes',
      'manufacturer',
      'manufacturers',
      'distribuidora',
      'distribuidor',
      'fornec',
      'tb_fornec',
      'cad_fornec',
    ],
    medium: ['parceiro', 'partner', 'prestador', 'provider', 'transportadora', 'carrier', 'forn'],
    weak: ['cnpj', 'razao_social', 'fornecimento'],
  },

  CATEGORY: {
    exact: [
      'categoria',
      'categorias',
      'category',
      'categories',
      'grupo',
      'grupos',
      'group',
      'groups',
      'tb_categoria',
      'cad_categoria',
      'tb_grupo',
      'cad_grupo',
    ],
    strong: [
      'tipo',
      'tipos',
      'type',
      'types',
      'classe',
      'classes',
      'classification',
      'classificacao',
      'familia',
      'familias',
      'family',
      'families',
      'linha',
      'linhas',
      'line',
      'lines',
      'secao',
      'section',
      'departamento',
      'department',
      'segmento',
      'segment',
    ],
    medium: [
      'subgrupo',
      'subgroup',
      'subcategoria',
      'subcategory',
      'divisao',
      'division',
      'area',
      'setor',
      'sector',
    ],
    weak: ['cod_grupo', 'cod_tipo'],
  },

  PRICE: {
    exact: [
      'preco',
      'precos',
      'price',
      'prices',
      'tabela_preco',
      'tabela_precos',
      'price_list',
      'lista_preco',
      'tb_preco',
      'cad_preco',
      'tb_price',
    ],
    strong: [
      'pricing',
      'cotacao',
      'cotacoes',
      'quote',
      'quotes',
      'valor',
      'valores',
      'value',
      'values',
      'promocao',
      'promotion',
    ],
    medium: ['tarifa', 'tariff', 'taxa', 'rate', 'aliquota'],
    weak: ['vlr', 'prc', 'vl_preco'],
  },

  INVENTORY: {
    exact: [
      'estoque',
      'estoques',
      'stock',
      'inventory',
      'saldo',
      'saldos',
      'balance',
      'tb_estoque',
      'cad_estoque',
      'posicao_estoque',
    ],
    strong: [
      'armazem',
      'warehouse',
      'deposito',
      'deposit',
      'localizacao',
      'location',
      'bin',
      'posicao',
      'estoque_filial',
      'stock_location',
      'inventario',
    ],
    medium: ['almoxarifado', 'storehouse', 'reserva', 'reservation', 'disponivel', 'available'],
    weak: ['saldo_estoque', 'qtd_estoque', 'qt_saldo'],
  },

  MOVEMENT: {
    exact: [
      'movimento',
      'movimentos',
      'movement',
      'movements',
      'movimentacao',
      'movimentacoes',
      'mov_estoque',
    ],
    strong: [
      'transacao',
      'transacoes',
      'transaction',
      'transactions',
      'lancamento',
      'lancamentos',
      'posting',
      'postings',
      'entrada',
      'entradas',
      'saida',
      'saidas',
      'transferencia',
      'transfer',
      'ajuste',
      'adjustment',
    ],
    medium: ['operacao', 'operation', 'movto', 'mov'],
    weak: ['tipo_movimento', 'dt_movimento'],
  },

  SALE: {
    exact: [
      'venda',
      'vendas',
      'sale',
      'sales',
      'pedido',
      'pedidos',
      'order',
      'orders',
      'tb_venda',
      'tb_pedido',
      'tb_sales',
      'tb_orders',
    ],
    strong: [
      'fatura',
      'faturas',
      'invoice',
      'invoices',
      'nota_fiscal',
      'notas_fiscais',
      'nf',
      'nfe',
      'orcamento',
      'budget',
      'proposta',
      'proposal',
      'item_pedido',
      'order_item',
      'item_venda',
      'sale_item',
    ],
    medium: ['cupom', 'coupon', 'romaneio', 'packing_list', 'entrega', 'delivery'],
    weak: ['dt_venda', 'nr_pedido'],
  },

  PURCHASE: {
    exact: [
      'compra',
      'compras',
      'purchase',
      'purchases',
      'ordem_compra',
      'purchase_order',
      'tb_compra',
      'oc',
    ],
    strong: [
      'requisicao',
      'requisicoes',
      'request',
      'requests',
      'cotacao_compra',
      'purchase_quote',
      'recebimento',
      'receipt',
      'nota_entrada',
      'receiving',
    ],
    medium: ['autorizacao_compra', 'aprovacao', 'approval'],
    weak: ['dt_compra', 'nr_oc'],
  },

  CUSTOMER: {
    exact: ['cliente', 'clientes', 'customer', 'customers', 'tb_cliente', 'cad_cliente'],
    strong: [
      'consumidor',
      'consumer',
      'buyer',
      'buyers',
      'pessoa',
      'pessoas',
      'person',
      'people',
      'contato',
      'contact',
      'contacts',
    ],
    medium: ['prospect', 'lead', 'parceiro_comercial'],
    weak: ['cpf', 'cnpj_cliente'],
  },

  USER: {
    exact: ['usuario', 'usuarios', 'user', 'users', 'tb_usuario', 'cad_usuario'],
    strong: [
      'operador',
      'operadores',
      'operator',
      'operators',
      'funcionario',
      'funcionarios',
      'employee',
      'employees',
      'colaborador',
      'colaboradores',
      'staff',
      'login',
      'account',
      'conta',
    ],
    medium: ['pessoa_fisica', 'responsavel', 'atendente'],
    weak: ['email', 'senha', 'password'],
  },

  BRANCH: {
    exact: ['filial', 'filiais', 'branch', 'branches', 'tb_filial', 'cad_filial'],
    strong: [
      'loja',
      'lojas',
      'store',
      'stores',
      'unidade',
      'unidades',
      'unit',
      'units',
      'empresa',
      'empresas',
      'company',
      'companies',
      'estabelecimento',
      'establishment',
    ],
    medium: ['sede', 'headquarters', 'regional', 'region', 'centro_distribuicao', 'cd'],
    weak: ['cnpj', 'cod_filial'],
  },

  EXPIRY: {
    exact: [
      'validade',
      'validades',
      'expiry',
      'expiration',
      'vencimento',
      'vencimentos',
      'tb_validade',
      'estoque_validade',
      'saldo_validade',
    ],
    strong: [
      'prazo',
      'prazos',
      'expire',
      'expires',
      'data_validade',
      'dt_validade',
      'dt_vencimento',
    ],
    medium: ['vida_util', 'shelf_life'],
    weak: ['dt_fab', 'dt_fabricacao'],
  },

  LOT: {
    exact: ['lote', 'lotes', 'lot', 'lots', 'tb_lote', 'cad_lote'],
    strong: ['batch', 'batches', 'serie', 'series', 'numero_serie', 'serial_number', 'nr_serie'],
    medium: ['rastreabilidade', 'traceability'],
    weak: ['nr_lote', 'cod_lote'],
  },

  PROMOTION: {
    exact: ['promocao', 'promocoes', 'promotion', 'promotions', 'tb_promocao'],
    strong: [
      'desconto',
      'descontos',
      'discount',
      'discounts',
      'oferta',
      'ofertas',
      'offer',
      'offers',
      'campanha',
      'campanhas',
      'campaign',
      'campaigns',
      'cupom',
      'cupons',
      'coupon',
      'coupons',
    ],
    medium: ['bonificacao', 'bonus', 'fidelidade', 'loyalty'],
    weak: ['perc_desconto', 'pct_desc'],
  },

  FISCAL: {
    exact: ['nfe', 'nf_e', 'nota_fiscal_eletronica', 'sped', 'tb_nfe', 'tb_nf', 'cfop', 'cst'],
    strong: [
      'fiscal',
      'tributario',
      'tax',
      'imposto',
      'impostos',
      'ncm',
      'icms',
      'ipi',
      'pis',
      'cofins',
      'csosn',
      'cean',
      'origem_produto',
    ],
    medium: ['regime', 'tributacao', 'taxation'],
    weak: ['cod_fiscal', 'cod_tributario'],
  },

  LOG: {
    exact: ['log', 'logs', 'tb_log'],
    strong: [
      'logging',
      'trace',
      'traces',
      'historico',
      'historicos',
      'history',
      'timeline',
      'event',
      'events',
      'evento',
      'eventos',
    ],
    medium: ['tracking', 'rastreio', 'footprint'],
    weak: ['dt_log', 'dt_registro'],
  },

  AUDIT: {
    exact: ['auditoria', 'audit', 'change_log', 'changelog', 'tb_auditoria'],
    strong: [
      'versao',
      'versoes',
      'version',
      'versions',
      'revisao',
      'revision',
      'alteracao',
      'change',
      'historico_alteracao',
      'audit_trail',
    ],
    medium: ['backup', 'snapshot'],
    weak: ['usuario_alteracao', 'dt_alteracao'],
  },

  PERMISSION: {
    exact: [
      'permissao',
      'permissoes',
      'permission',
      'permissions',
      'tb_permissao',
      'perfil',
      'perfis',
    ],
    strong: [
      'role',
      'roles',
      'acesso',
      'acessos',
      'access',
      'privilegio',
      'privilege',
      'autorizacao',
      'authorization',
      'grupo_usuario',
      'user_group',
      'profile',
    ],
    medium: ['policy', 'politica', 'regra', 'rule'],
    weak: ['cod_perfil', 'nivel_acesso'],
  },

  CONFIGURATION: {
    exact: [
      'configuracao',
      'configuracoes',
      'configuration',
      'configurations',
      'config',
      'configs',
      'tb_config',
      'tb_configuracao',
    ],
    strong: [
      'parametro',
      'parametros',
      'parameter',
      'parameters',
      'setting',
      'settings',
      'preference',
      'preferences',
      'opcao',
      'opcoes',
      'option',
      'options',
    ],
    medium: ['sistema', 'system', 'setup'],
    weak: ['chave', 'key', 'valor_config'],
  },

  LOOKUP: {
    exact: ['tipo', 'tipos', 'situacao', 'situacoes', 'status', 'motivo', 'motivos'],
    strong: [
      'reason',
      'reasons',
      'origin',
      'origins',
      'origem',
      'origens',
      'natureza',
      'unidade_medida',
      'uom',
      'unidade',
      'dominio',
      'domain',
      'lookup',
      'auxiliar',
    ],
    medium: ['referencia', 'reference', 'tabela_auxiliar', 'aux'],
    weak: ['cod_status', 'ds_status'],
  },

  UNKNOWN: {
    exact: [],
    strong: [],
    medium: [],
    weak: [],
  },
};

// ─── Table prefix/suffix heuristics ───────────────────────────────────────────

/** Prefixes that carry no semantic meaning and should be stripped before matching. */
export const NOISE_PREFIXES: readonly string[] = [
  'tb_',
  'tbl_',
  'cad_',
  'mov_',
  'rel_',
  'aux_',
  'tmp_',
  'temp_',
  'vw_',
  'mv_',
  'fn_',
  'sp_',
  'proc_',
  'v_',
];

/** Suffixes that carry no semantic meaning and should be stripped. */
export const NOISE_SUFFIXES: readonly string[] = [
  '_new',
  '_old',
  '_bkp',
  '_backup',
  '_copia',
  '_hist',
  '_temp',
  '_tmp',
  '_v2',
  '_v1',
  '_v3',
  '_copy',
];

/**
 * Strip noisy prefixes and suffixes so "tb_produto_v2" becomes "produto".
 * Returns lower-case.
 */
export function normalizeTableName(raw: string): string {
  let name = raw.toLowerCase().trim();

  for (const pfx of NOISE_PREFIXES) {
    if (name.startsWith(pfx)) {
      name = name.slice(pfx.length);
      break; // only strip one prefix
    }
  }

  for (const sfx of NOISE_SUFFIXES) {
    if (name.endsWith(sfx)) {
      name = name.slice(0, name.length - sfx.length);
      break;
    }
  }

  return name;
}
