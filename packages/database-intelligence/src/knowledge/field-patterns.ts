/**
 * Field (column) pattern dictionaries.
 *
 * Maps column name fragments → FieldRole with weights.
 * Also covers Brazilian ERP column prefixes: cd_, ds_, vl_, qt_, dt_, fl_, nr_, in_.
 */
import type { FieldRole } from '../types/index.js';

export interface FieldPattern {
  readonly role:   FieldRole;
  readonly weight: number;
}

/** Ordered list — first match wins when multiple patterns fire on the same column. */
export const FIELD_PATTERNS: ReadonlyArray<{
  readonly patterns: readonly string[];
  readonly role:     FieldRole;
  readonly weight:   number;
}> = [
  // ─── Identifiers ──────────────────────────────────────────────────────────
  {
    patterns: ['_id', 'id', 'pk', 'chave', 'key', 'uuid', 'guid', 'oid', 'seq', 'sequencia'],
    role: 'IDENTIFIER', weight: 90,
  },

  // ─── EAN / Barcode ────────────────────────────────────────────────────────
  {
    patterns: ['ean', 'gtin', 'barcode', 'cod_barras', 'codigo_barra', 'codigo_barras', 'cean'],
    role: 'EAN', weight: 95,
  },

  // ─── SKU ──────────────────────────────────────────────────────────────────
  {
    patterns: ['sku', 'cod_sku', 'referencia', 'reference', 'ref', 'cod_ref'],
    role: 'SKU', weight: 85,
  },

  // ─── Code / Primary code ──────────────────────────────────────────────────
  {
    patterns: [
      'codigo', 'cod', 'code', 'cd_', 'nr_',
      'numero', 'number', 'cod_produto', 'cod_item', 'cod_art',
    ],
    role: 'CODE', weight: 70,
  },

  // ─── Name ─────────────────────────────────────────────────────────────────
  {
    patterns: [
      'nome', 'name', 'razao', 'razao_social', 'fantasia',
      'denominacao', 'titulo', 'title',
    ],
    role: 'NAME', weight: 75,
  },

  // ─── Description ──────────────────────────────────────────────────────────
  {
    patterns: [
      'descricao', 'descr', 'description', 'desc', 'ds_',
      'observacao', 'obs', 'detalhes', 'detail', 'complemento',
    ],
    role: 'DESCRIPTION', weight: 65,
  },

  // ─── Cost Price ───────────────────────────────────────────────────────────
  {
    patterns: [
      'custo', 'cost', 'preco_custo', 'price_cost',
      'vl_custo', 'vl_cost', 'valor_custo', 'cst',
    ],
    role: 'COST_PRICE', weight: 90,
  },

  // ─── Sale Price ───────────────────────────────────────────────────────────
  {
    patterns: [
      'preco_venda', 'sale_price', 'pvenda', 'vl_venda', 'valor_venda',
      'preco_varejo', 'retail_price',
    ],
    role: 'SALE_PRICE', weight: 88,
  },

  // ─── Generic Price ────────────────────────────────────────────────────────
  {
    patterns: [
      'preco', 'price', 'valor', 'value', 'vl_', 'vlr',
      'amount', 'importancia', 'total',
    ],
    role: 'PRICE', weight: 60,
  },

  // ─── Margin ───────────────────────────────────────────────────────────────
  {
    patterns: [
      'margem', 'margin', 'markup', 'lucro', 'profit',
      'perc_margem', 'pct_margem',
    ],
    role: 'MARGIN', weight: 88,
  },

  // ─── Quantity / Balance ───────────────────────────────────────────────────
  {
    patterns: [
      'saldo', 'balance', 'estoque', 'stock',
      'qt_saldo', 'qtd_saldo', 'saldo_atual',
    ],
    role: 'BALANCE', weight: 85,
  },
  {
    patterns: [
      'quantidade', 'qtd', 'qty', 'qt_', 'quantity',
      'volume', 'unidade', 'unit',
    ],
    role: 'QUANTITY', weight: 70,
  },

  // ─── Weight ───────────────────────────────────────────────────────────────
  {
    patterns: ['peso', 'weight', 'massa', 'mass', 'kg', 'gramas'],
    role: 'WEIGHT', weight: 88,
  },

  // ─── Expiry Date ─────────────────────────────────────────────────────────
  {
    patterns: [
      'validade', 'expiry', 'expiration', 'vencimento',
      'dt_validade', 'data_validade', 'dt_venc', 'data_vencimento',
    ],
    role: 'EXPIRY_DATE', weight: 95,
  },

  // ─── Manufacture Date ─────────────────────────────────────────────────────
  {
    patterns: [
      'fabricacao', 'manufacture', 'dt_fab', 'data_fabricacao',
      'dt_producao', 'production_date',
    ],
    role: 'MANUFACTURE_DATE', weight: 88,
  },

  // ─── Status / Flag ────────────────────────────────────────────────────────
  {
    patterns: [
      'ativo', 'active', 'inativo', 'inactive',
      'fl_ativo', 'in_ativo', 'habilitado', 'enabled',
    ],
    role: 'FLAG', weight: 70,
  },
  {
    patterns: [
      'status', 'situacao', 'state', 'estado', 'condicao',
      'ds_status', 'cd_status', 'tipo_status',
    ],
    role: 'STATUS', weight: 65,
  },

  // ─── Brand ────────────────────────────────────────────────────────────────
  {
    patterns: ['marca', 'brand', 'fabricante', 'manufacturer', 'fabricao'],
    role: 'BRAND', weight: 85,
  },

  // ─── Soft Delete ─────────────────────────────────────────────────────────
  {
    patterns: [
      'deleted_at', 'excluido_em', 'dt_exclusao', 'removido_em',
      'deleted', 'removed', 'excluido', 'fl_excluido',
    ],
    role: 'SOFT_DELETE', weight: 90,
  },

  // ─── Timestamps ───────────────────────────────────────────────────────────
  {
    patterns: [
      'updated_at', 'atualizado_em', 'dt_atualizacao', 'dt_alteracao',
      'modified_at', 'changed_at', 'modificado_em',
    ],
    role: 'TIMESTAMP_UPDATED', weight: 80,
  },
  {
    patterns: [
      'created_at', 'criado_em', 'dt_criacao', 'dt_cadastro', 'dt_inclusao',
      'dt_registro', 'data_inclusao', 'inserted_at',
    ],
    role: 'TIMESTAMP_CREATED', weight: 80,
  },

  // ─── FK Roles ─────────────────────────────────────────────────────────────
  {
    patterns: [
      'id_fornecedor', 'fornecedor_id', 'supplier_id', 'fk_fornecedor',
      'cod_fornecedor', 'cd_fornecedor',
    ],
    role: 'SUPPLIER_FK', weight: 92,
  },
  {
    patterns: [
      'id_categoria', 'categoria_id', 'category_id', 'fk_categoria',
      'cod_categoria', 'cod_grupo', 'grupo_id', 'id_grupo',
      'cd_grupo', 'cd_tipo',
    ],
    role: 'CATEGORY_FK', weight: 90,
  },
  {
    patterns: [
      'id_filial', 'filial_id', 'branch_id', 'fk_filial',
      'cod_filial', 'cd_filial', 'id_loja', 'loja_id',
      'id_empresa', 'empresa_id',
    ],
    role: 'BRANCH_FK', weight: 90,
  },
  {
    patterns: [
      'id_cliente', 'cliente_id', 'customer_id', 'fk_cliente',
      'cod_cliente', 'cd_cliente',
    ],
    role: 'CUSTOMER_FK', weight: 92,
  },
  {
    patterns: [
      'id_produto', 'produto_id', 'product_id', 'fk_produto',
      'cod_produto', 'cd_produto', 'item_id', 'id_item',
    ],
    role: 'PRODUCT_FK', weight: 92,
  },

  // ─── Generic FK ───────────────────────────────────────────────────────────
  {
    patterns: ['_fk', 'fk_', '_id', 'id_'],
    role: 'FOREIGN_KEY', weight: 30,
  },
];

// ─── Data-type hints ──────────────────────────────────────────────────────────

/**
 * When a column has one of these data types, these roles become more likely.
 * Used as secondary signal; weight is lower than name-based patterns.
 */
export const DATA_TYPE_ROLE_HINTS: ReadonlyArray<{
  readonly types:  readonly string[];
  readonly roles:  readonly FieldRole[];
  readonly weight: number;
}> = [
  { types: ['uuid', 'guid'],                              roles: ['IDENTIFIER'],        weight: 60 },
  { types: ['boolean', 'bool', 'bit'],                    roles: ['FLAG', 'STATUS'],    weight: 30 },
  { types: ['timestamp', 'timestamptz', 'datetime'],      roles: ['TIMESTAMP_CREATED', 'TIMESTAMP_UPDATED', 'EXPIRY_DATE'], weight: 20 },
  { types: ['numeric', 'decimal', 'float', 'real'],       roles: ['PRICE', 'QUANTITY', 'WEIGHT'], weight: 20 },
  { types: ['char', 'varchar', 'text'],                   roles: ['DESCRIPTION', 'NAME', 'CODE'], weight: 10 },
  { types: ['bigint', 'integer', 'int', 'smallint'],      roles: ['QUANTITY', 'BALANCE', 'IDENTIFIER'], weight: 10 },
];

// ─── EAN sample value patterns ────────────────────────────────────────────────

/** Regex patterns that detect EAN/barcode values in sampled data. */
export const EAN_VALUE_PATTERNS: readonly RegExp[] = [
  /^\d{8}$/,    // EAN-8
  /^\d{12}$/,   // UPC-A
  /^\d{13}$/,   // EAN-13
  /^\d{14}$/,   // GTIN-14
];

/** Price-like numeric value (up to 12 digits, 2 decimal places). */
export const PRICE_VALUE_PATTERN = /^\d{1,10}([.,]\d{1,4})?$/;
