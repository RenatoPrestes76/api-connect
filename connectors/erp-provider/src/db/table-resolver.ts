const ENTITY_PATTERNS: Record<string, string[]> = {
  products: ['produtos', 'products', 'itens', 'items', 'product', 'item', 'mercadorias'],
  customers: ['clientes', 'customers', 'client', 'cliente', 'parceiros'],
  inventory: ['estoque', 'inventory', 'stock', 'estoques'],
  sales: ['pedidos', 'orders', 'sales', 'vendas', 'order'],
  suppliers: ['fornecedores', 'suppliers', 'vendor', 'fornecedor', 'vendors'],
  users: ['usuarios', 'users', 'user', 'usuario', 'operadores'],
};

export function resolveTable(entity: string, tables: string[]): string | null {
  const lower = tables.map((t) => t.toLowerCase());
  for (const candidate of ENTITY_PATTERNS[entity] ?? [entity]) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return tables[idx]!;
  }
  return null;
}

export function detectEntities(tables: string[]): string[] {
  return Object.keys(ENTITY_PATTERNS).filter((entity) => resolveTable(entity, tables) !== null);
}
