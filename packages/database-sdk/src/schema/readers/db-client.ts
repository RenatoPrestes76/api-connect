export interface DbRow {
  [key: string]: unknown;
}

export interface DbQueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: DbRow[] }>;
}
