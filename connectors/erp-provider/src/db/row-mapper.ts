import type { ErpProduct, ErpCustomer, ErpInventoryItem } from '../mapper.js';

type Row = Record<string, unknown>;

function str(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined) return String(v);
  }
  return '';
}

function num(row: Row, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function bool(row: Row, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined) return Boolean(v);
  }
  return true;
}

export function rowToErpProduct(row: Row): ErpProduct {
  return {
    sku:       str(row, 'codigo',        'sku',   'code',   'id'),
    name:      str(row, 'descricao',     'nome',  'name',   'description'),
    price:     num(row, 'preco_venda',   'preco', 'price',  'valor'),
    category:  str(row, 'cod_grupo',     'grupo', 'category', 'categoria'),
    active:    bool(row, 'ativo',        'active', 'status'),
    updatedAt: row['dt_alteracao'] ? String(row['dt_alteracao']) : undefined,
  };
}

export function rowToErpCustomer(row: Row): ErpCustomer {
  return {
    code:        str(row, 'codigo',          'code',         'id'),
    name:        str(row, 'razao_social',    'nome_fantasia', 'nome', 'name'),
    email:       str(row, 'email'),
    taxId:       str(row, 'cnpj_cpf',        'cnpj',         'cpf',  'tax_id'),
    creditLimit: num(row, 'limite_credito',  'credit_limit', 'limite'),
    active:      bool(row, 'ativo',          'active'),
    updatedAt:   row['dt_alteracao'] ? String(row['dt_alteracao']) : undefined,
  };
}

export function rowToErpInventory(row: Row): ErpInventoryItem {
  const qty      = num(row, 'qtd_atual',     'quantity', 'qty', 'qtd');
  const reserved = num(row, 'qtd_reservada', 'reserved', 'qtd_reserva');
  return {
    productSku: str(row, 'produto_codigo', 'sku',     'codigo',   'product_code'),
    warehouse:  str(row, 'deposito',       'warehouse', 'cod_deposito'),
    quantity:   qty,
    reserved,
    updatedAt:  row['dt_ultima_saida'] ? String(row['dt_ultima_saida']) : undefined,
  };
}
